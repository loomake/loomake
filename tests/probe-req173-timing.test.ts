// PROBE（使い捨て・マージしない）：REQ-173 と REQ-172 の通常 run のテストの段階ごとの時間を測る。
// 元のテスト（tests/input-boundaries.test.ts）と同じ手順をなぞり、段階の区切りで時刻を記録する。期待は確かめるが、時間の上限は測るために 120 秒にしている。
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { UsageError, runExternal } from '../packages/kit/src/index.js';
import { runRun } from '../packages/runner/src/index.js';
import { maskSecrets } from '../packages/runner/src/mask.js';
import { makeRepo, CHANGE } from '../packages/runner/test/helpers.js';

type Mark = { label: string; at: number; data?: unknown };
let marks: Mark[] = [];
const g = globalThis as { __loomakeProbe?: (label: string, data?: unknown) => void };
g.__loomakeProbe = (label, data) => { marks.push({ label, at: performance.now(), data }); };
const mark = (label: string) => g.__loomakeProbe!(label);
const rows: unknown[] = [];
const out = process.env.LOOMAKE_PROBE_OUT ?? join(tmpdir(), 'probe-req173.jsonl');
const ITER = Number(process.env.LOOMAKE_PROBE_ITER ?? 3);
const tooLarge = ' '.repeat(1024 * 1024 + 1);

type Sup = { boot: number; spawn?: number; spawned?: number; firstData?: number; lastData?: number; exit?: number; killStart?: number; killEnd?: number; close?: number; finish?: number; flushed?: number };
type Ext = { command: string; args: string[]; t0: number; end: number; bytes: number; sup?: Sup };
const d = (a?: number, b?: number) => (a === undefined || b === undefined ? null : b - a);

function summarize(name: string, iteration: number) {
  const stages: [string, number][] = [];
  const exts: Record<string, unknown>[] = [];
  let prev: Mark | undefined;
  for (const m of marks) {
    if (m.label === 'ext') {
      const e = m.data as Ext; const s = e.sup;
      exts.push({
        after: prev?.label, cmd: `${e.command} ${e.args.join(' ')}`.slice(0, 40), total: e.end - e.t0, bytes: e.bytes,
        nodeBoot: d(e.t0, s?.boot), bootToSpawn: d(s?.boot, s?.spawn), spawnCall: d(s?.spawn, s?.spawned), childRun: d(s?.spawned, s?.exit),
        killAfterExit: d(s?.killStart, s?.killEnd), exitToFinish: d(s?.exit, s?.finish), flush: d(s?.finish, s?.flushed), returnToParent: d(s?.flushed, e.end),
        dataSpan: d(s?.firstData, s?.lastData),
      });
      continue;
    }
    if (prev) stages.push([`${prev.label} → ${m.label}`, Math.round(m.at - prev.at)]);
    prev = m;
  }
  const total = Math.round(marks.at(-1)!.at - marks[0].at);
  const extTotal = exts.reduce((sum, e) => sum + (e.total as number), 0);
  const killTotal = exts.reduce((sum, e) => sum + ((e.killAfterExit as number | null) ?? 0), 0);
  const bootTotal = exts.reduce((sum, e) => sum + ((e.nodeBoot as number | null) ?? 0), 0);
  const row = { name, iteration, platform: process.platform, total, extCount: exts.length, extTotal, killTotal, bootTotal, stages, exts };
  rows.push(row);
  appendFileSync(out, JSON.stringify(row) + '\n');
  const lines = [`PROBE ${process.platform} ${name} #${iteration} total=${total}ms ext=${exts.length}件 ${extTotal}ms (nodeBoot計 ${bootTotal}ms, 終了後のkill計 ${killTotal}ms)`];
  for (const [label, ms] of stages) lines.push(`  ${String(ms).padStart(6)}ms  ${label}`);
  for (const e of exts) lines.push(`    ext ${String(e.total).padStart(5)}ms boot=${e.nodeBoot} spawn=${e.spawnCall} run=${e.childRun} kill=${e.killAfterExit} exit→fin=${e.exitToFinish} flush=${e.flush} ret=${e.returnToParent} bytes=${e.bytes} [${e.cmd}] after=${e.after}`);
  console.log(lines.join('\n'));
}

beforeEach(() => { marks = []; });
afterAll(() => { console.log(`PROBE rows=${rows.length} file=${out}`); });

describe('PROBE 基本の時間', () => {
  it('子プロセスの起動と、監視役・taskkill・16MiB の転送の時間', () => {
    const dir = mkdtempSync(join(tmpdir(), 'probe-'));
    try {
      writeFileSync(join(dir, 'write-report.mjs'), `process.stdout.write('x'.repeat(${16 * 1024 * 1024}), () => { process.exitCode = 1; });\n`);
      const time = (label: string, f: () => unknown) => { const t = performance.now(); f(); const ms = Math.round(performance.now() - t); return [label, ms] as const; };
      const results: (readonly [string, number])[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(time('spawnSync node -e 0', () => spawnSync(process.execPath, ['-e', '0'])));
        results.push(time('spawnSync git --version', () => spawnSync('git', ['--version'])));
        results.push(time('runExternal git --version', () => runExternal('git', ['--version'], { cwd: dir })));
        if (process.platform === 'win32') results.push(time('spawnSync taskkill 存在しないpid /T /F', () => spawnSync('taskkill', ['/pid', '999999', '/T', '/F'], { stdio: 'ignore', timeout: 1000, killSignal: 'SIGKILL' })));
        results.push(time('spawnSync shell node write-report.mjs (16MiB)', () => spawnSync('node write-report.mjs', { cwd: dir, shell: true, maxBuffer: 64 * 1024 * 1024 })));
        results.push(time('runExternal shell node write-report.mjs (16MiB)', () => runExternal('node write-report.mjs', [], { cwd: dir, shell: true, qualityCommand: true, timeoutMs: 60_000, maxBuffer: 64 * 1024 * 1024 })));
        const big = JSON.stringify({ results: [{ check: 'command: test', status: 'fail', detail: 'x'.repeat(16 * 1024 * 1024) }] }, null, 2);
        results.push(time('maskSecrets 16MiB JSON', () => maskSecrets(big)));
        results.push(time('writeFileSync 16MiB', () => writeFileSync(join(dir, 'big.json'), big)));
        results.push(time('readFileSync+JSON.parse 16MiB', () => JSON.parse(readFileSync(join(dir, 'big.json'), 'utf8'))));
      }
      const agg = new Map<string, number[]>();
      for (const [label, ms] of results) agg.set(label, [...(agg.get(label) ?? []), ms]);
      const lines = [`PROBE ${process.platform} 基本の時間（5回）`];
      for (const [label, list] of agg) lines.push(`  ${label}: ${list.join(', ')} ms`);
      console.log(lines.join('\n'));
      appendFileSync(out, JSON.stringify({ name: 'baseline', platform: process.platform, results: Object.fromEntries(agg) }) + '\n');
      const ext = marks.filter((m) => m.label === 'ext').map((m) => m.data as Ext);
      const lines2 = ['PROBE 基本の時間の runExternal の内訳'];
      for (const e of ext) { const s = e.sup; lines2.push(`    ext ${e.end - e.t0}ms boot=${d(e.t0, s?.boot)} spawn=${d(s?.spawn, s?.spawned)} run=${d(s?.spawned, s?.exit)} kill=${d(s?.killStart, s?.killEnd)} exit→fin=${d(s?.exit, s?.finish)} flush=${d(s?.finish, s?.flushed)} ret=${d(s?.flushed, e.end)} data=${d(s?.firstData, s?.lastData)} bytes=${e.bytes} [${e.command} ${e.args.join(' ')}]`); }
      console.log(lines2.join('\n'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 120_000);
});

describe('PROBE REQ-173 の手順', () => {
  it.each(Array.from({ length: ITER }, (_, i) => i + 1))('REQ-173 #%i', async (iteration) => {
    mark('test:start');
    const tasks = '- [ ] 完了ゲート（REQ-012） <!-- loomake:gate=done -->\n';
    const repo = makeRepo({ tasks });
    mark('test:makeRepo');
    try {
      const failureBytes = 16 * 1024 * 1024;
      repo.write('write-report.mjs', `process.stdout.write('x'.repeat(${failureBytes}), () => { process.exitCode = 1; });\n`);
      repo.git('add', 'write-report.mjs'); repo.git('commit', '-qm', 'large verification diagnostic');
      const before = repo.git('rev-parse', 'HEAD');
      mark('test:write+add+commit+rev-parse');
      for (const file of ['AGENTS.md', 'proposal.md', 'tasks.md', 'trace.md', 'specs/x/spec.md']) {
        const path = file === 'AGENTS.md' ? join(repo.root, file) : join(repo.root, 'openspec/changes', CHANGE, file);
        expect(statSync(path).size).toBeLessThanOrEqual(1024 * 1024);
      }
      const output: string[] = [];
      mark('test:statSync');
      const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => output.push(text), env: repo.env, fileExists: () => false });
      mark('test:runRun returned');
      expect(code).toBe(1);
      expect(output.join('\n')).toContain('エンジンへの指示の上限は16777216バイト');
      const runs = join(repo.root, '.loomake/runs');
      const directories = readdirSync(runs).filter((name) => name !== '.gitignore');
      expect(directories).toHaveLength(1);
      const run = join(runs, directories[0]);
      const verify = JSON.parse(readFileSync(join(run, '00-verify.json'), 'utf8'));
      mark('test:read+parse 00-verify.json');
      expect(verify.results.find((result: { check: string }) => result.check === 'command: test')).toMatchObject({ status: 'fail', detail: 'x'.repeat(failureBytes) });
      mark('test:expect detail');
      expect(JSON.parse(readFileSync(join(run, 'summary.json'), 'utf8'))).toMatchObject({ status: 'stopped', doneTasks: [], remainingTasks: ['完了ゲート（REQ-012）'], reason: expect.stringContaining('指示の上限は16777216バイト') });
      expect(readFileSync(join(repo.root, 'openspec/changes', CHANGE, 'tasks.md'), 'utf8')).toBe(tasks);
      mark('test:summary+tasks');
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.calls()).toEqual([]);
      expect(repo.prs()).toEqual([]);
      expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
      expect(repo.git('ls-remote', 'origin')).toBe('');
      mark('test:final git checks');
    } finally { repo.cleanup(); mark('test:cleanup'); }
    summarize('REQ-173', iteration);
  }, 120_000);
});

describe('PROBE REQ-172 の通常runの手順', () => {
  const cases = ['trace.md', 'specs/x/spec.md'].flatMap((name) => Array.from({ length: ITER }, (_, i) => [name, i + 1] as const));
  it.each(cases)('REQ-172 %s #%i', async (name, iteration) => {
    mark('test:start');
    const repo = makeRepo();
    mark('test:makeRepo');
    try {
      const relative = `openspec/changes/${CHANGE}/${name}`;
      repo.write(relative, readFileSync(join(repo.root, relative), 'utf8') + tooLarge);
      repo.git('add', relative); repo.git('commit', '-qm', 'oversized document');
      const before = repo.git('rev-parse', 'HEAD');
      const branches = repo.git('branch', '--list');
      mark('test:write+add+commit+rev-parse+branch');
      const error = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: () => {}, env: repo.env, fileExists: () => false }).catch((value: unknown) => value);
      mark('test:runRun returned');
      expect(error).toBeInstanceOf(UsageError);
      expect(String(error)).toContain('1048576');
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.git('branch', '--list')).toBe(branches);
      expect(repo.calls()).toEqual([]);
      expect(repo.prs()).toEqual([]);
      expect(repo.git('ls-remote', 'origin')).toBe('');
      mark('test:final git checks');
    } finally { repo.cleanup(); mark('test:cleanup'); }
    summarize(`REQ-172 ${name}`, iteration);
  }, 120_000);
});
