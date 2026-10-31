#!/usr/bin/env node
// macOS・Windows の CI で、実行環境が止まった区間を見つけるための心拍の記録（REQ-345）。
//
//   node scripts/ci-heartbeat.mjs start <dir>   … 心拍を裏で起動して、すぐに終わる
//   node scripts/ci-heartbeat.mjs stop <dir>    … 心拍を止め、要約を GITHUB_STEP_SUMMARY と <dir>/summary.json に書く
//
// 心拍は 1 秒ごとに、時刻・前の記録からの間隔・一時ディレクトリと RUNNER_TEMP への 4KiB の書き込みと fsync の時間を、
// 10 秒ごとに `node -e 0` と `git --version` の起動時間を <dir>/heartbeat.jsonl に書く。8MiB で止める。
// 試験は markPhase で、LOOMAKE_CI_HEARTBEAT_DIR があるときだけ段階を <dir>/phases-<pid>.jsonl に書ける。
// どの失敗も例外にせず、終了コードは常に 0 にする（試験とジョブの成否を変えない）。生の出力・引数・環境値は書かない。

import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const HEARTBEAT_LIMIT = 8 * 1024 * 1024;
export const PHASE_LIMIT = 64 * 1024;
export const GAP_THRESHOLD_MS = 5000;
const BLOCK = Buffer.alloc(4096, 0x61);
const SAFE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const round = (value) => Math.round(value * 10) / 10;

/** 4KiB を書いて fsync し、かかった時間（ミリ秒）を返す。書けなければ null。 */
export function measureWrite(directory) {
  if (!directory) return null;
  const file = join(directory, `loomake-heartbeat-${process.pid}.tmp`);
  const start = performance.now();
  try {
    const fd = openSync(file, 'w');
    try { writeSync(fd, BLOCK); fsyncSync(fd); } finally { closeSync(fd); }
    return round(performance.now() - start);
  } catch { return null; } finally {
    try { rmSync(file, { force: true }); } catch { /* 消せなくても続ける */ }
  }
}

/** コマンドを起動して終わるまでの時間（ミリ秒）。起動できなければ null。出力は捨てる。 */
export function measureSpawn(command, args) {
  const start = performance.now();
  try {
    const result = spawnSync(command, args, { stdio: 'ignore', timeout: 60_000, windowsHide: true });
    return result.error ? null : round(performance.now() - start);
  } catch { return null; }
}

/** 1 行を上限内で追記する。上限に達したら truncated の印を 1 度だけ残して false を返す。 */
function appendLimited(file, row, limit) {
  try {
    const size = existsSync(file) ? statSync(file).size : 0;
    const line = JSON.stringify(row) + '\n';
    if (size + Buffer.byteLength(line) + 64 > limit) {
      appendFileSync(file, JSON.stringify({ type: 'truncated', at: Date.now() }) + '\n');
      return false;
    }
    appendFileSync(file, line);
    return true;
  } catch { return false; }
}

/**
 * 心拍を n 回まで（既定は上限に達するまで）記録する。
 * @param {string} directory
 * @param {{ intervalMs?: number; spawnEvery?: number; beats?: number; limit?: number; env?: NodeJS.ProcessEnv }} [options]
 */
export async function runHeartbeat(directory, { intervalMs = 1000, spawnEvery = 10, beats = Infinity, limit = HEARTBEAT_LIMIT, env = process.env } = {}) {
  try { mkdirSync(directory, { recursive: true }); } catch { return; }
  const file = join(directory, 'heartbeat.jsonl');
  const temp = tmpdir();
  const runnerTemp = env.RUNNER_TEMP;
  let previous;
  for (let n = 0; n < beats; n++) {
    const at = Date.now();
    const row = { type: 'beat', n, at, gapMs: previous === undefined ? null : at - previous, tempWriteMs: measureWrite(temp), runnerTempWriteMs: measureWrite(runnerTemp) };
    if (n % spawnEvery === 0) {
      row.nodeSpawnMs = measureSpawn(process.execPath, ['-e', '0']);
      row.gitSpawnMs = measureSpawn('git', ['--version']);
    }
    previous = at;
    if (!appendLimited(file, row, limit)) return;
    if (n + 1 < beats) await sleep(intervalMs);
  }
}

/** 心拍の記録を要約する。読めない行は数えるだけにする。 */
export function summarizeHeartbeat(text) {
  const summary = { beats: 0, maxGapMs: null, gapsOverThreshold: 0, maxTempWriteMs: null, maxRunnerTempWriteMs: null, maxNodeSpawnMs: null, maxGitSpawnMs: null, truncated: false, unreadable: 0 };
  const max = (key, value) => { if (typeof value === 'number' && Number.isFinite(value) && (summary[key] === null || value > summary[key])) summary[key] = value; };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { summary.unreadable++; continue; }
    if (row?.type === 'truncated') { summary.truncated = true; continue; }
    if (row?.type !== 'beat') { summary.unreadable++; continue; }
    summary.beats++;
    max('maxGapMs', row.gapMs);
    if (typeof row.gapMs === 'number' && row.gapMs > GAP_THRESHOLD_MS) summary.gapsOverThreshold++;
    max('maxTempWriteMs', row.tempWriteMs);
    max('maxRunnerTempWriteMs', row.runnerTempWriteMs);
    max('maxNodeSpawnMs', row.nodeSpawnMs);
    max('maxGitSpawnMs', row.gitSpawnMs);
  }
  return summary;
}

/** ジョブの要約に出す日本語の表。 */
export function renderHeartbeatSummary(summary) {
  const ms = (value) => (value === null ? '記録なし' : `${(value / 1000).toFixed(1)} 秒`);
  return [
    '## 実行環境の心拍',
    '',
    '| 項目 | 値 |',
    '|---|---|',
    `| 記録の数 | ${summary.beats} |`,
    `| 間隔の最大値 | ${ms(summary.maxGapMs)} |`,
    `| ${GAP_THRESHOLD_MS / 1000} 秒を超えた間隔 | ${summary.gapsOverThreshold} 回 |`,
    `| 一時ディレクトリへの書き込みの最大 | ${ms(summary.maxTempWriteMs)} |`,
    `| RUNNER_TEMP への書き込みの最大 | ${ms(summary.maxRunnerTempWriteMs)} |`,
    `| node の起動の最大 | ${ms(summary.maxNodeSpawnMs)} |`,
    `| git の起動の最大 | ${ms(summary.maxGitSpawnMs)} |`,
    ...(summary.truncated ? ['', '記録が上限に達したため、途中で止めました。'] : []),
    ...(summary.unreadable ? ['', `読めない行が ${summary.unreadable} 行ありました。`] : []),
    '',
  ].join('\n');
}

/** 心拍を裏で起動する。pid を <dir>/heartbeat.pid に書く。 */
export function startHeartbeat(directory) {
  try {
    mkdirSync(directory, { recursive: true });
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'run', directory], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => { /* 起動できなくても試験は続ける */ });
    if (child.pid) writeFileSync(join(directory, 'heartbeat.pid'), String(child.pid));
    child.unref();
  } catch { /* 心拍がなくても試験は続ける */ }
}

/** 心拍を止めて要約を書く。要約を返す（読めなければ null）。 */
export function stopHeartbeat(directory, env = process.env) {
  try {
    const pidFile = join(directory, 'heartbeat.pid');
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, 'utf8'));
      if (Number.isSafeInteger(pid) && pid > 0) try { process.kill(pid); } catch { /* もう終わっている */ }
    }
    const file = join(directory, 'heartbeat.jsonl');
    if (!existsSync(file)) return null;
    const summary = summarizeHeartbeat(readFileSync(file, 'utf8'));
    writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, renderHeartbeatSummary(summary));
    return summary;
  } catch { return null; }
}

/**
 * 試験の段階を記録する。LOOMAKE_CI_HEARTBEAT_DIR があるときだけ書き、ラベルと段階名は英小文字・数字・- の 40 文字以内に限る。
 * durationMs だけを数値として残す。失敗しても例外を投げない。
 */
export function markPhase(label, event, details = {}, env = process.env) {
  const directory = env.LOOMAKE_CI_HEARTBEAT_DIR;
  if (!directory || !SAFE.test(String(label)) || !SAFE.test(String(event))) return;
  try {
    mkdirSync(directory, { recursive: true });
    const row = { type: 'phase', label, event, at: Date.now(), pid: process.pid };
    if (typeof details.durationMs === 'number' && Number.isFinite(details.durationMs) && details.durationMs >= 0) row.durationMs = round(details.durationMs);
    if (typeof details.kind === 'string' && SAFE.test(details.kind)) row.kind = details.kind;
    appendLimited(join(resolve(directory), `phases-${process.pid}.jsonl`), row, PHASE_LIMIT);
  } catch { /* 診断だけを欠く */ }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory] = process.argv.slice(2);
  try {
    if (!directory) console.error('ci-heartbeat: 使い方：node scripts/ci-heartbeat.mjs start|stop <dir>');
    else if (mode === 'start') startHeartbeat(resolve(directory));
    else if (mode === 'stop') {
      const summary = stopHeartbeat(resolve(directory));
      console.log(summary ? `ci-heartbeat: 記録 ${summary.beats} 件、間隔の最大 ${summary.maxGapMs ?? '-'}ms、${GAP_THRESHOLD_MS / 1000} 秒超 ${summary.gapsOverThreshold} 回` : 'ci-heartbeat: 心拍の記録がありません');
    } else if (mode === 'run') await runHeartbeat(resolve(directory));
    else console.error(`ci-heartbeat: 知らないモードです：${mode}`);
  } catch { /* 成否を変えない */ }
  process.exitCode = 0;
}
