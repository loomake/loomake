import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { UsageError, RuntimeFailure, runExternal } from '@loomake/kit';
import { runEffortRecord } from '../src/index.js';
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, mkdirSync: vi.fn(fs.mkdirSync), unlinkSync: vi.fn(fs.unlinkSync) };
});
vi.mock('@loomake/kit', async (original) => {
  const kit = await original<typeof import('@loomake/kit')>();
  return { ...kit, runExternal: vi.fn(kit.runExternal) };
});
const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const git = (root: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=loomake-test', '-c', 'user.email=test@example.com', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
function repo(archived = false) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-effort-')); roots.push(root);
  const write = (path: string, content: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
  // 文書は置かず、品質コマンドには実行されたら失敗する値を置く。
  write('loomake.config.json', JSON.stringify({ commands: { test: 'exit 99', lint: 'exit 99' } }));
  write(`${archived ? 'openspec/changes/archive/2026-11-05-' : 'openspec/changes/'}add-x/.keep`, '');
  write('.gitignore', '*.ignored\n');
  git(root, 'init', '-q'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'initial');
  const dir = join(root, '.loomake/evidence/add-x/effort');
  const outputs: string[] = [];
  const record = (options: Partial<Parameters<typeof runEffortRecord>[0]> = {}) => runEffortRecord({ root, changeId: 'add-x', effort: '1.5h', stdout: (text) => outputs.push(text), now: () => new Date('2026-11-06T00:00:00.000Z'), ...options });
  const files = () => existsSync(dir) ? readdirSync(dir).sort() : [];
  return { root, write, dir, outputs, record, files };
}
it('[REQ-466][REQ-066][REQ-127][REQ-128] 独立したEffort 1だけを書き品質や文書を作らない', () => {
  const r = repo();
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('offline'); });
  const now = '2026-11-06T00:00:00.000Z';
  expect(r.record({ decisions: 0, attempts: 2, cost: [{ kind: 'tokens', count: 10 }], note: '再開' })).toBe(0);
  const [file] = r.files(); expect(file).toBe(`20261106T000000Z-${git(r.root, 'rev-parse', 'HEAD').slice(0, 12)}.json`);
  const raw = readFileSync(join(r.dir, file), 'utf8');
  const value = JSON.parse(raw);
  expect(value).toEqual({ schemaVersion: 1, kind: 'loomake-effort', change: 'add-x', sha: git(r.root, 'rev-parse', 'HEAD'), recordedAt: now, totalMinutes: 90, decisions: 0, attempts: 2, cost: [{ kind: 'tokens', count: 10 }], note: '再開' });
  expect(raw).toBe(JSON.stringify(value, null, 2) + '\n');
  expect(r.outputs.join('\n')).toContain('git にコミットしてください');
  expect(r.outputs.join('\n')).not.toMatch(/合格|ローカル完了/);
  expect(readdirSync(join(r.root, '.loomake'))).toEqual(['evidence']);
  expect(network).not.toHaveBeenCalled();
});
it('[REQ-466] 欠測を補わず0と内数を保存し、再オープン後の旧記録を保つ', () => {
  const r = repo();
  expect(r.record({ effort: 'review=0m' })).toBe(0);
  const [first] = r.files(); const original = readFileSync(join(r.dir, first), 'utf8');
  const firstValue = JSON.parse(original);
  expect(firstValue.minutes).toEqual({ review: 0 });
  for (const key of ['totalMinutes', 'cost', 'decisions', 'attempts', 'note']) expect(firstValue).not.toHaveProperty(key);
  expect(r.record()).toBe(1);
  git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'effort');
  expect(r.record({ effort: 'instruct=30m,review=20m,rework=0m,run=10m,wait=5m,search=8m', now: () => new Date('2026-11-06T00:00:01Z') })).toBe(0);
  expect(r.files()).toHaveLength(2); expect(readFileSync(join(r.dir, first), 'utf8')).toBe(original);
});
it('[REQ-466] tracked/untrackedのdirtyを拒否しignoredだけは受け付ける', () => {
  const r = repo(); r.write('a.ignored', 'ignored'); expect(r.record()).toBe(0);
  git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'saved');
  r.write('new.txt', 'untracked'); expect(r.record()).toBe(1); expect(r.files()).toHaveLength(1);
  rmSync(join(r.root, 'new.txt')); r.write('loomake.config.json', '{}'); expect(r.record()).toBe(1);
});
it('[REQ-466] 同じ保存名を上書きせず衝突を1として返す', () => {
  const r = repo();
  // ignoredにした既存名を使い、dirty拒否とは別に原子的な衝突を実行する。
  writeFileSync(join(r.root, '.git/info/exclude'), '.loomake/evidence/\n');
  expect(r.record()).toBe(0); const [file] = r.files(); const raw = readFileSync(join(r.dir, file), 'utf8');
  expect(r.record({ effort: '5m' })).toBe(1); expect(readFileSync(join(r.dir, file), 'utf8')).toBe(raw);
  expect(r.files()).toEqual([file]);
});
it('[REQ-466] active/archive優先・missing・ambiguous・不正idを既存探索で判定する', () => {
  const archived = repo(true); expect(archived.record()).toBe(0);
  const r = repo(); r.write('openspec/changes/archive/2026-11-04-add-x/.keep', ''); r.write('openspec/changes/archive/2026-11-05-add-x/.keep', '');
  git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'archives'); expect(r.record()).toBe(0);
  git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'effort'); rmSync(join(r.root, 'openspec/changes/add-x'), { recursive: true }); git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'remove active');
  expect(() => r.record()).toThrow();
  for (const changeId of ['missing', 'archive', '../add-x', '', 'add-x\n']) expect(() => r.record({ changeId })).toThrow();
});
it('[REQ-466] raw入力やcauseを残さず共有置換し、元のnoteの長さも検査する', () => {
  const r = repo(); const token = 'sk-' + 'a'.repeat(20);
  expect(r.record({ note: token })).toBe(0);
  expect(readFileSync(join(r.dir, r.files()[0]), 'utf8')).toContain('"note": "***"');
  for (const options of [{ effort: token }, { note: token.repeat(22) }, { note: 'line\nnext' }, { decisions: -1 }, { attempts: Infinity }, { cost: [{ kind: 'tokens' as const, count: 1.5 }] }]) {
    try { r.record(options); throw new Error('expected rejection'); } catch (error) {
      expect(error).toBeInstanceOf(UsageError); expect((error as Error).message).not.toContain(token); expect((error as Error).cause).toBeUndefined();
    }
  }
  git(r.root, 'add', '.'); git(r.root, 'commit', '-qm', 'effort'); r.write(token, 'dirty'); expect(r.record()).toBe(1);
  expect(r.outputs.join('\n')).not.toContain(token); expect(r.outputs.join('\n')).toContain('***');
});
it('[REQ-466] git不在と保存失敗は日本語UsageErrorで公開しない', () => {
  const r = repo(); rmSync(join(r.root, '.git'), { recursive: true }); expect(() => r.record()).toThrow(); expect(r.files()).toEqual([]);
  const p = repo(); p.write('.loomake/evidence/add-x/effort', 'file');
  writeFileSync(join(p.root, '.git/info/exclude'), '.loomake/\n'); expect(() => p.record()).toThrow(); expect(readFileSync(p.dir, 'utf8')).toBe('file');
});

it('[REQ-466] 同じEffort名へ同時公開して成功1件と衝突1件を返す', async () => {
  const r = repo(); const file = join(r.dir, '20261106T000000Z-aaaaaaaaaaaa.json');
  const module = pathToFileURL(join(import.meta.dirname, '../dist/publication.js')).href;
  const code = `import { publishEvidence } from ${JSON.stringify(module)}; process.stdin.once('data', () => { process.exitCode = publishEvidence(process.argv[1], process.argv[2]) ? 0 : 1; });`;
  const children = ['first', 'second'].map((content) => spawn(process.execPath, ['--input-type=module', '-e', code, file, content], { stdio: ['pipe', 'pipe', 'pipe'] }));
  const results = children.map((child) => new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }));
  for (const child of children) child.stdin.end('start');
  expect((await Promise.all(results)).sort()).toEqual([0, 1]);
  expect(['first', 'second']).toContain(readFileSync(file, 'utf8'));
  expect(readdirSync(r.dir)).toEqual(['20261106T000000Z-aaaaaaaaaaaa.json']);
});

const thrown = (action: () => unknown): Error => {
  try { action(); } catch (error) { return error as Error; }
  throw new Error('expected rejection');
};
it('[REQ-466] 保存前の入力・サイズ・change・git・保存を固定文とcauseなしで区別する', () => {
  const r = repo(); const token = 'sk-' + 'a'.repeat(20);
  const cases: [() => unknown, string][] = [
    [() => r.record({ effort: token }), '実作業時間の入力が不正です。時間・区分・回数・費用・メモの書式を確認してください。'],
    [() => r.record({ changeId: 'x'.repeat(65536) }), '実績記録の上限は65536バイトです。記録していません。'],
    [() => r.record({ changeId: 'missing' }), 'change が見つからないか、archive で一意に決まりません。記録していません。'],
    [() => { vi.mocked(runExternal).mockImplementationOnce(() => { throw new UsageError(token, { cause: new Error(token) }); }); return r.record(); }, 'git の状態を確認できません。記録していません。'],
    [() => { vi.mocked(mkdirSync).mockImplementationOnce(() => { throw new UsageError(token, { cause: new Error(token) }); }); return r.record(); }, '実績を保存できませんでした。保存先と作業状態を確認してから、もう一度実行してください。'],
    [() => r.record({ cost: [] }), '実作業時間の入力が不正です。時間・区分・回数・費用・メモの書式を確認してください。'],
  ];
  for (const [action, message] of cases) {
    const error = thrown(action); expect(error).toBeInstanceOf(UsageError); expect(error.message).toBe(message);
    expect(error.message).not.toContain(token); expect(error.cause).toBeUndefined(); expect(r.files()).toEqual([]);
  }
});
it.each(['cleanup', 'stdout'] as const)('[REQ-466] 保存後%sの失敗は完全なファイルを残し再実行しないRuntimeFailureにする', (phase) => {
  const r = repo(); const token = 'sk-' + 'a'.repeat(20);
  if (phase === 'cleanup') vi.mocked(unlinkSync).mockImplementationOnce(() => { throw new UsageError(token, { cause: new Error(token) }); });
  const error = thrown(() => r.record(phase === 'stdout' ? { stdout: () => { throw new UsageError(token, { cause: new Error(token) }); } } : {}));
  expect(error).toBeInstanceOf(RuntimeFailure); expect(error).not.toBeInstanceOf(UsageError); expect(error.cause).toBeUndefined();
  const files = r.files(); const final = files.find((name) => name.endsWith('.json'))!;
  expect(JSON.parse(readFileSync(join(r.dir, final), 'utf8')).totalMinutes).toBe(90);
  expect(error.message).toBe(`実績は保存しました：.loomake/evidence/add-x/effort/${final}。${phase === 'cleanup' ? '一時ファイルの片付け' : '結果の表示'}に失敗しました。もう一度記録せず、このファイルを git にコミットしてください。`);
  expect(error.message).not.toContain(token); expect(error.message).not.toContain(r.root);
  expect(files).toHaveLength(phase === 'cleanup' ? 2 : 1);
});
it.each([UsageError, RuntimeFailure])('[REQ-466] 保存していないdirty通知失敗は元のUsageErrorやcauseを外へ再送しない（%s）', (ErrorType) => {
  const r = repo(); r.write('dirty', ''); const token = 'sk-' + 'a'.repeat(20);
  const error = thrown(() => r.record({ stdout: () => { throw new ErrorType(token, { cause: new Error(token) }); } }));
  expect(error).toBeInstanceOf(UsageError); expect(error).not.toBeInstanceOf(RuntimeFailure);
  expect(error.message).toBe('実績を記録できません。入力、change の所在、git と保存先の作業状態を確認してください。');
  expect(error.cause).toBeUndefined(); expect(r.files()).toEqual([]);
});
