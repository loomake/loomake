#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROFILE_LIMIT = 1024 * 1024;
export const CASE_IDS = ['journeys-temp', 'journeys-repo', 'deadline-push', 'deadline-create', 'shared-package-build'];
const EVENTS = ['test-start', 'test-outcome', 'test-end', 'run-start', 'stall-start', 'run-end', 'retry-start', 'retry-end', 'cleanup-start', 'cleanup-end', 'prepare-start', 'prepare-end', 'command-timing', 'package-build-start', 'package-build-end'];
const KINDS = ['npm', 'git', 'cli'];
const processFile = `${process.pid}-${randomUUID()}.jsonl`;
const capped = new Set();
const writeFailures = new Set();
let failureFlushRegistered = false;
function flushWriteFailures() {
  for (const directory of writeFailures) {
    try {
      mkdirSync(directory, { recursive: true });
      const file = join(directory, processFile);
      let size = 0;
      try { size = statSync(file).size; } catch { /* 未作成なら新規作成する。 */ }
      const marker = JSON.stringify({ event: 'write-failed' }) + '\n';
      if (size + Buffer.byteLength(marker) <= PROFILE_LIMIT) {
        appendFileSync(file, marker);
        writeFailures.delete(directory);
      }
    } catch { /* 保存先自体が利用不能なら、元の終了結果を維持する。 */ }
  }
}
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** 記録は任意。失敗しても対象の試験へ例外を返さない。 */
export function profileEvent(caseId, event, details = {}, env = process.env) {
  const directory = env.LOOMAKE_TEST_PHASE_PROFILE_DIR;
  if (!directory || !CASE_IDS.includes(caseId) || !EVENTS.includes(event) || capped.has(directory)) return;
  const record = { caseId, event, at: details.at ?? Date.now() };
  if (event === 'test-outcome' && ['passed', 'failed'].includes(details.outcome)) record.outcome = details.outcome;
  if (event === 'command-timing') {
    if (KINDS.includes(details.kind)) record.kind = details.kind;
    if (finite(details.durationMs)) record.durationMs = details.durationMs;
  }
  try {
    mkdirSync(directory, { recursive: true });
    const file = join(directory, processFile);
    let size = 0;
    try { size = statSync(file).size; } catch { /* 初回は新規作成する。 */ }
    const line = JSON.stringify(record) + '\n';
    const marker = JSON.stringify({ event: 'limit-reached' }) + '\n';
    const failureMarker = writeFailures.has(directory) ? JSON.stringify({ event: 'write-failed' }) + '\n' : '';
    if (size + Buffer.byteLength(failureMarker) + Buffer.byteLength(line) + Buffer.byteLength(marker) > PROFILE_LIMIT) {
      if (size + Buffer.byteLength(marker) <= PROFILE_LIMIT) appendFileSync(file, marker);
      capped.add(directory);
      return;
    }
    if (failureMarker) {
      appendFileSync(file, failureMarker);
      writeFailures.delete(directory);
    }
    appendFileSync(file, line);
  } catch {
    writeFailures.add(directory);
    if (!failureFlushRegistered) {
      process.once('exit', flushWriteFailures);
      failureFlushRegistered = true;
    }
  }
}

function validEvent(row) {
  return row && CASE_IDS.includes(row.caseId) && EVENTS.includes(row.event) && finite(row.at)
    && (row.event !== 'test-outcome' || ['passed', 'failed'].includes(row.outcome))
    && (row.event !== 'command-timing' || (KINDS.includes(row.kind) && finite(row.durationMs)));
}

/** @param {Array<Record<string, any>>} events @param {Record<string, any>} context @param {string[]} issues */
export function aggregateProfile(events, context = {}, issues = []) {
  const problems = [...issues];
  const valid = events.filter((row) => {
    if (validEvent(row)) return true;
    problems.push('不正なイベント');
    return false;
  });
  const cases = CASE_IDS.map((caseId) => {
    const rows = valid.filter((row) => row.caseId === caseId);
    const missing = [];
    const intervals = [];
    const point = (name) => {
      const values = rows.filter((row) => row.event === name);
      if (values.length !== 1) { missing.push(`${name}: ${values.length ? '重複' : '未計測'}`); return null; }
      return values[0].at;
    };
    const interval = (name, start, end) => {
      if (start === null || end === null) return;
      if (end < start) { missing.push(`${name}: 不正な時刻`); return; }
      intervals.push({ name, start, end, durationMs: end - start });
    };
    const phases = [];
    let totalMs = null;
    let outcome = 'unknown';
    if (caseId === 'shared-package-build') {
      interval('shared-build-pack', point('package-build-start'), point('package-build-end'));
      if (intervals.length) totalMs = intervals[0].durationMs;
    } else {
      const start = point('test-start');
      const end = point('test-end');
      if (start !== null && end !== null && end >= start) totalMs = end - start;
      else if (start !== null && end !== null) missing.push('total: 不正な時刻');
      const outcomes = rows.filter((row) => row.event === 'test-outcome');
      if (outcomes.length === 1) outcome = outcomes[0].outcome;
      else missing.push('test-outcome: 未計測または重複');
      if (caseId.startsWith('deadline-')) {
        const runStart = point('run-start');
        const stall = point('stall-start');
        const runEnd = point('run-end');
        interval('prepare', start, runStart);
        interval('before-stall', runStart, stall);
        interval('stall-and-stop', stall, runEnd);
        interval('retry', point('retry-start'), point('retry-end'));
      } else {
        interval('prepare', point('prepare-start'), point('prepare-end'));
      }
      interval('cleanup', point('cleanup-start'), point('cleanup-end'));
      for (const part of intervals) {
        if (start !== null && end !== null && (part.start < start || part.end > end)) missing.push(`${part.name}: 総時間の範囲外`);
      }
    }
    const ordered = [...intervals].sort((a, b) => a.start - b.start);
    if (ordered.some((part, i) => i > 0 && part.start < ordered[i - 1].end)) missing.push('区間の重複');
    for (const part of intervals) phases.push({ name: part.name, durationMs: part.durationMs });
    if (caseId.startsWith('journeys-')) {
      for (const kind of KINDS) {
        const commands = rows.filter((row) => row.event === 'command-timing' && row.kind === kind);
        if (!commands.length) missing.push(`${kind}: 未計測`);
        phases.push({ name: kind, durationMs: commands.length ? commands.reduce((sum, row) => sum + row.durationMs, 0) : null });
      }
    }
    const measuredMs = phases.reduce((sum, part) => sum + (part.durationMs ?? 0), 0);
    if (totalMs !== null && measuredMs > totalMs) missing.push('区間の合計が総時間を超過');
    phases.push({ name: 'other', durationMs: totalMs !== null && !missing.length ? totalMs - measuredMs : null });
    return { caseId, outcome, totalMs, phases, missing, complete: missing.length === 0 };
  });
  return { schemaVersion: 1, context, complete: problems.length === 0 && cases.every((row) => row.complete), issues: [...new Set(problems)], cases };
}

export function escapeSummaryText(value) {
  return [...String(value ?? '')].slice(0, 200).join('').replace(/[\r\n\t]/g, ' ')
    .replace(/[&<>\\`*_{}[\]()#+.!|~=:"'-]/g, (char) => `&#${char.codePointAt(0)};`);
}

export function renderSummary(profile) {
  const escape = escapeSummaryText;
  let output = '# テスト区間の計測\n\n';
  output += `計測：${profile.complete ? '完備' : '不足あり（未計測を0秒や成功として扱いません）'}\n\n`;
  for (const [key, value] of Object.entries(profile.context)) output += `${escape(key)}：${escape(value)}\n\n`;
  const labels = { prepare: '準備', 'before-stall': '停止前の処理', 'stall-and-stop': '停止待ちと停止処理', retry: '再実行', cleanup: '後片付け', npm: 'npm導入', git: 'Git操作', cli: 'CLI操作', other: 'その他', 'shared-build-pack': '共有build・pack' };
  for (const row of profile.cases) {
    output += `## ${escape(row.caseId)}\n\n結果：${escape(row.outcome)} / 総時間：${row.totalMs === null ? '未計測' : `${row.totalMs} ms`}\n\n`;
    for (const part of row.phases) output += `- ${escape(labels[part.name] ?? part.name)}：${part.durationMs === null ? '未計測' : `${part.durationMs} ms`}\n`;
    for (const item of row.missing) output += `- 不足：${escape(item)}\n`;
    output += '\n';
  }
  for (const issue of profile.issues.slice(0, 20)) output += `- 計測の問題：${escape(issue)}\n`;
  return Buffer.byteLength(output) <= 32 * 1024 ? output : '# テスト区間の計測\n\n表示上限に達しました。profile.json を確認してください。\n';
}

/** @param {string} directory @param {Record<string, string | undefined>} env @param {string} cwd */
export function collectProfile(directory, env = process.env, cwd = process.cwd()) {
  const events = [];
  const issues = [];
  try {
    const files = readdirSync(directory).filter((file) => file.endsWith('.jsonl'));
    if (!files.length) issues.push('記録ファイルが未計測');
    if (files.length > 128) issues.push('記録ファイル数が上限を超過');
    for (const file of files.slice(0, 128)) {
      try {
        if (statSync(join(directory, file)).size > PROFILE_LIMIT) { issues.push('記録ファイルが上限を超過'); continue; }
        for (const line of readFileSync(join(directory, file), 'utf8').split('\n').filter(Boolean)) {
          try {
            const row = JSON.parse(line);
            if (row.event === 'limit-reached') issues.push('記録が上限に到達');
            else if (row.event === 'write-failed') issues.push('記録の書き込みに失敗');
            else events.push(row);
          } catch { issues.push('不正なJSONL'); }
        }
      } catch { issues.push('記録ファイルを読めません'); }
    }
  } catch { issues.push('記録ディレクトリが未計測'); }
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (git.status !== 0) issues.push('checkout SHAが未計測');
  const context = {
    runId: env.GITHUB_RUN_ID || 'unknown', runAttempt: env.GITHUB_RUN_ATTEMPT || '1',
    sample: env.LOOMAKE_TEST_PHASE_SAMPLE || 'unknown', checkoutSha: git.status === 0 ? git.stdout.trim() : 'unknown',
    os: env.RUNNER_OS || process.platform, node: process.version,
    testOutcome: ['success', 'failure'].includes(env.TEST_PHASE_OUTCOME) ? env.TEST_PHASE_OUTCOME : 'unknown',
  };
  const profile = aggregateProfile(events, context, issues);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'profile.json'), JSON.stringify(profile, null, 2) + '\n');
  writeFileSync(join(directory, 'summary.md'), renderSummary(profile));
  return profile;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const directory = process.env.LOOMAKE_TEST_PHASE_PROFILE_DIR;
    if (!directory) throw new Error('LOOMAKE_TEST_PHASE_PROFILE_DIRを指定してください');
    if (!collectProfile(directory).complete) process.exitCode = 1;
  } catch { console.error('計測結果を保存できませんでした'); process.exitCode = 1; }
}
