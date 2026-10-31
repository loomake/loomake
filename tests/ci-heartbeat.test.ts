import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { HEARTBEAT_LIMIT, markPhase, renderHeartbeatSummary, runHeartbeat, stopHeartbeat, summarizeHeartbeat } from '../scripts/ci-heartbeat.mjs';

const root = join(import.meta.dirname, '..');
const script = join(root, 'scripts/ci-heartbeat.mjs');
const dirs: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'loomake-heartbeat-')); dirs.push(dir); return dir; };
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const rows = (file: string) => readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
const beat = (n: number, gapMs: number | null) => JSON.stringify({ type: 'beat', n, at: 1000 * n, gapMs, tempWriteMs: 1, runnerTempWriteMs: 2 });

describe('macOS と Windows の実行環境の記録', () => {
  it('[REQ-345] 心拍は各行に時刻・間隔・2 つの書き込み時間を、決めた回ごとに node と git の起動時間を書く', async () => {
    const dir = fixture();
    const runnerTemp = fixture();
    await runHeartbeat(dir, { intervalMs: 10, spawnEvery: 2, beats: 3, env: { RUNNER_TEMP: runnerTemp } });
    const beats = rows(join(dir, 'heartbeat.jsonl'));
    expect(beats.map((row) => row.n)).toEqual([0, 1, 2]);
    expect(beats[0]!.gapMs).toBeNull();
    for (const row of beats) {
      expect(row.type).toBe('beat');
      expect(Number.isFinite(row.at)).toBe(true);
      expect(typeof row.tempWriteMs).toBe('number');
      expect(typeof row.runnerTempWriteMs).toBe('number');
    }
    expect(beats[1]!.gapMs).toBeGreaterThanOrEqual(0);
    expect(beats.map((row) => 'nodeSpawnMs' in row)).toEqual([true, false, true]);
    expect(typeof beats[0]!.nodeSpawnMs).toBe('number');
    expect(typeof beats[0]!.gitSpawnMs).toBe('number');
    // 書き込みに使った一時ファイルは残さない
    expect(readdirSync(runnerTemp)).toEqual([]);
    // RUNNER_TEMP がなければ null と書く
    const other = fixture();
    await runHeartbeat(other, { beats: 1, env: {} });
    expect(rows(join(other, 'heartbeat.jsonl'))[0]!.runnerTempWriteMs).toBeNull();
  });

  it('[REQ-345] 記録は上限で印を残して止める', async () => {
    const dir = fixture();
    expect(HEARTBEAT_LIMIT).toBe(8 * 1024 * 1024);
    await runHeartbeat(dir, { intervalMs: 0, spawnEvery: 1000, beats: 50, limit: 600, env: {} });
    const all = rows(join(dir, 'heartbeat.jsonl'));
    expect(all.at(-1)!.type).toBe('truncated');
    expect(all.filter((row) => row.type === 'truncated')).toHaveLength(1);
    expect(all.length).toBeLessThan(50);
    expect(summarizeHeartbeat(readFileSync(join(dir, 'heartbeat.jsonl'), 'utf8')).truncated).toBe(true);
  });

  it('[REQ-345] 止まった区間を要約し、記録の数・間隔の最大値・5 秒を超えた回数を出す', () => {
    const text = [beat(0, null), beat(1, 1000), beat(2, 7000), beat(3, 1000), beat(4, 12000), 'broken', ''].join('\n');
    const summary = summarizeHeartbeat(text);
    expect(summary).toMatchObject({ beats: 5, maxGapMs: 12000, gapsOverThreshold: 2, maxTempWriteMs: 1, maxRunnerTempWriteMs: 2, unreadable: 1, truncated: false });
    const markdown = renderHeartbeatSummary(summary);
    expect(markdown).toContain('| 記録の数 | 5 |');
    expect(markdown).toContain('| 間隔の最大値 | 12.0 秒 |');
    expect(markdown).toContain('| 5 秒を超えた間隔 | 2 回 |');
    expect(markdown).toContain('| node の起動の最大 | 記録なし |');
    expect(markdown).toContain('読めない行が 1 行');
  });

  it('[REQ-345] 停止は心拍を終わらせ、要約をファイルとジョブの要約に書く', () => {
    const dir = fixture();
    const stepSummary = join(dir, 'step-summary.md');
    writeFileSync(join(dir, 'heartbeat.jsonl'), [beat(0, null), beat(1, 6000)].join('\n') + '\n');
    const sleeper = spawnSync(process.execPath, ['-e', 'const c=require("node:child_process").spawn(process.execPath,["-e","setTimeout(()=>{},60000)"],{detached:true,stdio:"ignore"});c.unref();console.log(c.pid)'], { encoding: 'utf8' });
    const pid = Number(sleeper.stdout.trim());
    writeFileSync(join(dir, 'heartbeat.pid'), String(pid));
    const summary = stopHeartbeat(dir, { GITHUB_STEP_SUMMARY: stepSummary });
    expect(summary).toMatchObject({ beats: 2, maxGapMs: 6000, gapsOverThreshold: 1 });
    expect(JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))).toMatchObject({ beats: 2 });
    expect(readFileSync(stepSummary, 'utf8')).toContain('## 実行環境の心拍');
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) {
      try { process.kill(pid, 0); spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},20)']); } catch { alive = false; }
    }
    expect(alive).toBe(false);
  });

  it('[REQ-345] 記録先を作れなくても、開始・停止・段階の記録は例外を投げず終了コード 0 で終わる', async () => {
    const dir = fixture();
    const blocked = join(dir, 'blocked');
    writeFileSync(blocked, 'file');
    await expect(runHeartbeat(blocked, { beats: 1, env: {} })).resolves.toBeUndefined();
    expect(stopHeartbeat(blocked, {})).toBeNull();
    expect(() => markPhase('package-reference', 'prepare-start', {}, { LOOMAKE_CI_HEARTBEAT_DIR: blocked })).not.toThrow();
    for (const mode of ['start', 'stop', 'unknown']) {
      const result = spawnSync(process.execPath, [script, mode, blocked], { encoding: 'utf8' });
      expect(result.status, mode + result.stderr).toBe(0);
    }
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).toBe(0);
  });

  it('[REQ-345] 開始は裏で心拍を起動してすぐに終わり、停止で止まる', () => {
    const dir = join(fixture(), 'heartbeat');
    const started = spawnSync(process.execPath, [script, 'start', dir], { encoding: 'utf8', timeout: 20_000 });
    expect(started.status, started.stderr).toBe(0);
    expect(existsSync(join(dir, 'heartbeat.pid'))).toBe(true);
    for (let i = 0; i < 200 && !existsSync(join(dir, 'heartbeat.jsonl')); i++) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},25)']);
    const stopped = spawnSync(process.execPath, [script, 'stop', dir], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });
    expect(stopped.status, stopped.stderr).toBe(0);
    expect(stopped.stdout).toContain('ci-heartbeat: 記録');
    expect(JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')).beats).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('[REQ-345] 段階の記録は指定があるときだけ、固定の形の値だけを書く', () => {
    const dir = fixture();
    markPhase('package-reference', 'prepare-start', {}, {});
    expect(readdirSync(dir)).toEqual([]);
    const env = { LOOMAKE_CI_HEARTBEAT_DIR: dir };
    markPhase('package-reference', 'prepare-start', {}, env);
    markPhase('package-smoke', 'command', { kind: 'npm', durationMs: 12.34, stdout: 'secret-output', args: ['secret-arg'] } as Record<string, unknown>, env);
    markPhase('Bad Label', 'prepare-start', {}, env);
    markPhase('package-reference', 'x'.repeat(41), {}, env);
    markPhase('package-smoke', 'command', { kind: 'npm install --token', durationMs: -1 }, env);
    const file = join(dir, `phases-${process.pid}.jsonl`);
    const written = rows(file);
    expect(written.map((row) => [row.label, row.event])).toEqual([['package-reference', 'prepare-start'], ['package-smoke', 'command'], ['package-smoke', 'command']]);
    expect(written[1]).toMatchObject({ kind: 'npm', durationMs: 12.3 });
    expect('kind' in written[2]!).toBe(false);
    expect('durationMs' in written[2]!).toBe(false);
    expect(readFileSync(file, 'utf8')).not.toMatch(/secret|token/);
  });

  it('[REQ-345] シャードのあるジョブと隔離のジョブで、テストの前に心拍を起動し、キャンセルされていなければ停止して 7 日保存する。ubuntu では起動しない', () => {
    const readLf = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
    const ci = readLf('.github/workflows/ci.yml');
    const quality = ci.slice(ci.indexOf('\n  quality:'), ci.indexOf('\n  node20:')).replace(/^ *#.*\n/gm, '');
    const steps = quality.split(/\n(?= {6}- )/);
    const byId = (list: string[], id: string) => list.find((step) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(step))!;
    const condition = (step: string) => step.match(/^ {6}(?:- | {2})if: (.*)$/m)![1]!;
    const evaluate = (expression: string, context: Record<string, unknown>) => Boolean(runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 }));
    const context = (shard: string, cancelled = false) => ({ matrix: { shard }, steps: { changes: { outputs: { docs_only: 'false' } } }, cancelled: () => cancelled });
    const start = byId(steps, 'heartbeat'); const test = byId(steps, 'test_shard'); const stop = byId(steps, 'heartbeat_stop'); const upload = byId(steps, 'heartbeat_upload');
    expect(start).toContain('run: node scripts/ci-heartbeat.mjs start "$RUNNER_TEMP/loomake-ci-heartbeat"');
    expect(stop).toContain('run: node scripts/ci-heartbeat.mjs stop "$RUNNER_TEMP/loomake-ci-heartbeat"');
    expect(test).toContain('LOOMAKE_CI_HEARTBEAT_DIR: ${{ runner.temp }}/loomake-ci-heartbeat');
    expect(steps.indexOf(start)).toBeLessThan(steps.indexOf(test));
    expect(steps.indexOf(stop)).toBeGreaterThan(steps.indexOf(test));
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(stop));
    expect(evaluate(condition(start), context('1/2'))).toBe(true);
    expect(evaluate(condition(start), context(''))).toBe(false);
    for (const step of [stop, upload]) {
      expect(evaluate(condition(step), context('2/2'))).toBe(true);
      expect(evaluate(condition(step), context(''))).toBe(false);
      expect(evaluate(condition(step), context('2/2', true))).toBe(false);
    }
    expect(upload).toContain('actions/upload-artifact@');
    expect(upload).toContain('path: ${{ runner.temp }}/loomake-ci-heartbeat/');
    expect(upload).toContain('retention-days: 7');
    const name = upload.match(/^ {10}name: (.*)$/m)![1]!;
    const names = new Set(['macos-latest', 'windows-latest'].flatMap((os) => ['1/2', '2/2'].map((shard) =>
      name.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(runInNewContext(expression, { github: { run_id: 1, run_attempt: 1 }, matrix: { os, shard } }))))));
    expect(names.size).toBe(4);
    for (const value of names) expect(value).not.toContain('/');

    const quarantine = readLf('.github/workflows/quality-quarantine.yml');
    const job = quarantine.slice(quarantine.indexOf('\n  quality-quarantine:'));
    const qSteps = job.split(/\n(?= {6}- )/);
    const qStart = byId(qSteps, 'heartbeat'); const qTest = byId(qSteps, 'test'); const qStop = byId(qSteps, 'heartbeat_stop'); const qUpload = byId(qSteps, 'upload');
    expect(qStart).toContain('ci-heartbeat.mjs start "$RUNNER_TEMP/loomake-quarantine/heartbeat"');
    expect(qTest).toContain('LOOMAKE_CI_HEARTBEAT_DIR: ${{ runner.temp }}/loomake-quarantine/heartbeat');
    expect(qStop).toContain('ci-heartbeat.mjs stop "$RUNNER_TEMP/loomake-quarantine/heartbeat"');
    expect(condition(qStop)).toBe('${{ !cancelled() }}');
    expect(qSteps.indexOf(qStart)).toBeLessThan(qSteps.indexOf(qTest));
    expect(qSteps.indexOf(qStop)).toBeGreaterThan(qSteps.indexOf(qTest));
    expect(qSteps.indexOf(qUpload)).toBeGreaterThan(qSteps.indexOf(qStop));
    expect(qUpload).toContain('${{ runner.temp }}/loomake-quarantine/');
  });
});
