import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSON_LIMITS, RuntimeFailure, UsageError } from '@loomake/kit';
import { acquireEvalLock, appendQualityRows, EVAL_LOCK, ensureQualityPaths, ownsEvalLock, parseQualityStorage, QUALITY_FILES, readQualitySnapshot, readQualityStorage, releaseOwnEvalLock, replaceQualityIndex, sameQualitySnapshot, type OwnedEvalLock } from '../src/quality-files.js';
import { qualityWorktreeClean } from '../src/quality-worktree.js';
import { at, uuid, evaluation, accepted, started, event, lines } from './quality-test-fixtures.js';

vi.setConfig({ testTimeout: 15_000 });
vi.mock('node:fs', async (original) => {
  const actual = await original<typeof import('node:fs')>();
  return { ...actual, writeSync: vi.fn(actual.writeSync), fsyncSync: vi.fn(actual.fsyncSync), renameSync: vi.fn(actual.renameSync) };
});
afterEach(() => vi.clearAllMocks());
const failure = () => Object.assign(new Error('fixture failure'), { code: 'EIO' });
const token = (n = 1) => ({ runId: uuid(100 + n), requestId: uuid(n), pid: process.pid, createdAt: at });
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(git = false): { root: string; lock: OwnedEvalLock; path: (key: keyof typeof QUALITY_FILES) => string } {
  const root = mkdtempSync(join(tmpdir(), 'loomake-quality-files-')); roots.push(root);
  if (git) {
    runGit(root, 'init', '-q'); runGit(root, 'config', 'user.name', 'Loomake fixture'); runGit(root, 'config', 'user.email', 'fixture@example.invalid');
    runGit(root, 'config', 'commit.gpgsign', 'false'); runGit(root, 'commit', '--allow-empty', '-q', '-m', 'fixture');
  }
  const lock = acquireEvalLock(root, token()); if (!lock) throw new Error('fixture lock unavailable');
  return { root, lock, path: (key) => join(root, QUALITY_FILES[key]) };
}
function runGit(root: string, ...args: string[]): string { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function seed(root: string, count = 1) {
  const reports = Array.from({ length: count }, (_, i) => evaluation(i + 1));
  writeFileSync(join(root, QUALITY_FILES.requests), lines(reports.flatMap((_, i) => [accepted(i + 1), started(i + 1), event('evaluated', i + 1)])));
  writeFileSync(join(root, QUALITY_FILES.history), lines(reports));
  return reports;
}

describe('評価の所有権と安全な保存', () => {
  it('[REQ-434] 競合は未受付で既存lockのbytes/mtimeを変えない', () => {
    const { root, lock } = fixture(); const file = join(root, EVAL_LOCK), before = readFileSync(file), mtime = statSync(file).mtimeMs;
    expect(acquireEvalLock(root, token(2))).toBeUndefined(); expect(readFileSync(file)).toEqual(before); expect(statSync(file).mtimeMs).toBe(mtime);
    expect(ownsEvalLock(lock)).toBe(true); expect(releaseOwnEvalLock(lock)).toBe(true); expect(existsSync(file)).toBe(false); expect(releaseOwnEvalLock(lock)).toBe(false);
  });
  it('[REQ-434] tokenを失った実行者は全帳簿へ書かず他tokenを残す', () => {
    const { root, lock } = fixture(); const foreign = JSON.stringify(token(2)); writeFileSync(join(root, EVAL_LOCK), foreign);
    const before = readQualitySnapshot(root);
    expect(() => appendQualityRows(lock, 'history', [evaluation()])).toThrow(RuntimeFailure);
    expect(() => replaceQualityIndex(lock, evaluation())).toThrow(RuntimeFailure);
    expect(releaseOwnEvalLock(lock)).toBe(false); expect(readFileSync(join(root, EVAL_LOCK), 'utf8')).toBe(foreign);
    expect(sameQualitySnapshot(before, readQualitySnapshot(root))).toBe(true);
  });
  it('[REQ-434] ロック作成の途中で別tokenになったら削除しない', async () => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-quality-acquire-')); roots.push(root);
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs'); const foreign = JSON.stringify(token(2));
    vi.mocked(writeSync).mockImplementationOnce(() => { actual.writeFileSync(join(root, EVAL_LOCK), foreign); throw failure(); });
    expect(() => acquireEvalLock(root, token())).toThrow(UsageError); expect(readFileSync(join(root, EVAL_LOCK), 'utf8')).toBe(foreign);
  });
  it('[REQ-434] 保存先の途中のリンクとfile位置のdirectoryを拒否する', () => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-quality-link-')), outside = mkdtempSync(join(tmpdir(), 'loomake-quality-outside-')); roots.push(root, outside);
    symlinkSync(outside, join(root, 'reports'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => ensureQualityPaths(root, true)).toThrow(UsageError); expect(readdirSync(outside)).toEqual([]);
    rmSync(join(root, 'reports')); mkdirSync(join(root, 'reports', 'quality'), { recursive: true }); mkdirSync(join(root, QUALITY_FILES.history));
    expect(() => ensureQualityPaths(root)).toThrow(UsageError);
  });
  it('[REQ-433][REQ-432] history確定後だけ最新索引を完全な一時ファイルから置換する', () => {
    const { root, lock, path } = fixture(); appendQualityRows(lock, 'requests', [accepted(), started()]); appendQualityRows(lock, 'history', [evaluation()]);
    const before = readFileSync(path('history')); expect(readQualityStorage(root).repairIndex).toBe(true);
    replaceQualityIndex(lock, evaluation()); const state = readQualityStorage(root);
    expect(state.repairIndex).toBe(false); expect(state.index).toEqual(evaluation()); expect(readFileSync(path('history'))).toEqual(before);
    expect(readdirSync(join(root, 'reports/quality')).some((name) => name.endsWith('.tmp'))).toBe(false);
  });
  it('[REQ-433] 部分write失敗は自分の末尾だけ戻し既存行を全bytes保持する', async () => {
    const { lock, path } = fixture(); const original = lines([accepted()]); writeFileSync(path('requests'), original);
    const addition = Buffer.from(lines([started()])); const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.mocked(writeSync).mockImplementationOnce((fd) => { actual.writeSync(fd, addition.subarray(0, 7)); throw failure(); });
    expect(() => appendQualityRows(lock, 'requests', [started()])).toThrow(UsageError); expect(readFileSync(path('requests'), 'utf8')).toBe(original);
  });
  it('[REQ-433] fsync失敗も既存行へ戻す', () => {
    const { lock, path } = fixture(); const original = lines([accepted()]); writeFileSync(path('requests'), original);
    vi.mocked(fsyncSync).mockImplementationOnce(() => { throw failure(); });
    expect(() => appendQualityRows(lock, 'requests', [started()])).toThrow(UsageError); expect(readFileSync(path('requests'), 'utf8')).toBe(original);
  });
  it('[REQ-433] 他の追記が混ざったときはtruncateせず不完全の可能性を知らせる', async () => {
    const { lock, path } = fixture(); const original = lines([accepted()]); writeFileSync(path('requests'), original);
    const addition = Buffer.from(lines([started()])); const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.mocked(writeSync).mockImplementationOnce((fd) => { actual.writeSync(fd, addition.subarray(0, 7)); actual.writeSync(fd, Buffer.from('foreign\n')); throw failure(); });
    expect(() => appendQualityRows(lock, 'requests', [started()])).toThrow(/不完全な末尾/);
    expect(readFileSync(path('requests'), 'utf8')).toBe(original + addition.subarray(0, 7).toString() + 'foreign\n');
  });
  it('[REQ-432] indexのrename失敗はhistoryと旧indexを保持する', () => {
    const { root, lock, path } = fixture(); const reports = seed(root, 2); writeFileSync(path('index'), JSON.stringify(reports[0]));
    const oldIndex = readFileSync(path('index')), oldHistory = readFileSync(path('history'));
    vi.mocked(renameSync).mockImplementationOnce(() => { throw failure(); });
    expect(() => replaceQualityIndex(lock, reports[1])).toThrow(UsageError);
    expect(readFileSync(path('index'))).toEqual(oldIndex); expect(readFileSync(path('history'))).toEqual(oldHistory); expect(readQualityStorage(root).repairIndex).toBe(true);
  });
  it('[REQ-433] 古いindexは復旧候補、出どころ不明や同組改変は拒否する', () => {
    const { root, path } = fixture(); const reports = seed(root, 2); writeFileSync(path('index'), JSON.stringify(reports[0]));
    expect(readQualityStorage(root).repairIndex).toBe(true);
    for (const value of [{ ...reports[0], runId: uuid(999) }, { ...reports[1], future: 'tampered' }]) {
      writeFileSync(path('index'), JSON.stringify(value)); const original = readFileSync(path('index'));
      expect(() => readQualityStorage(root)).toThrow(/出どころ/); expect(readFileSync(path('index'))).toEqual(original);
    }
  });
  it('[REQ-433] file予算超過と不正UTF-8を読取時に拒否する', () => {
    const { root, path } = fixture(); writeFileSync(path('history'), ''); truncateSync(path('history'), JSON_LIMITS.maxFileBytes + 1);
    expect(() => readQualitySnapshot(root)).toThrow(UsageError); writeFileSync(path('history'), Buffer.from([0xf0, 0x9f, 0x92]));
    const snapshot = readQualitySnapshot(root); expect(snapshot.history).toEqual(Buffer.from([0xf0, 0x9f, 0x92]));
    expect(() => parseQualityStorage(snapshot)).toThrow(/UTF-8/);
  });
  it('[REQ-442] snapshotは存在の違い・全bytesの変更を隠さない', () => {
    const { root, path } = fixture(); const empty = readQualitySnapshot(root); writeFileSync(path('requests'), ''); const created = readQualitySnapshot(root);
    expect(sameQualitySnapshot(empty, created)).toBe(false); writeFileSync(path('requests'), lines([accepted()])); const changed = readQualitySnapshot(root);
    expect(sameQualitySnapshot(created, changed)).toBe(false); expect(sameQualitySnapshot(changed, readQualitySnapshot(root))).toBe(true);
  });
});

describe('評価の作業ツリーの厳密な許可', () => {
  it('[REQ-442] ignored/unignoredいずれのown lockも検査して許可する', () => {
    const { root, lock } = fixture(true); expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(true);
    writeFileSync(join(root, '.gitignore'), '.loomake/\n'); runGit(root, 'add', '.gitignore'); runGit(root, 'commit', '-q', '-m', 'ignore');
    expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(true);
  });
  it('[REQ-442] 未コミットの正しい追記/索引だけ許可し、staged/他pathを拒否する', () => {
    const { root, lock, path } = fixture(true); seed(root); replaceQualityIndex(lock, evaluation());
    expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(true);
    runGit(root, 'add', 'reports'); expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(false);
    runGit(root, 'commit', '-q', '-m', 'ledger');
    appendQualityRows(lock, 'requests', [accepted(2), started(2)]); appendQualityRows(lock, 'history', [evaluation(2)]); replaceQualityIndex(lock, evaluation(2));
    expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(true);
    writeFileSync(join(root, 'source.ts'), '// changed\n'); expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(false); rmSync(join(root, 'source.ts'));
    const original = readFileSync(path('history')); writeFileSync(path('history'), Buffer.from(original.toString().replaceAll('0.0.0', '9.9.9')));
    const snapshot = readQualitySnapshot(root); expect(() => qualityWorktreeClean(lock, snapshot)).toThrow(UsageError);
  });
  it('[REQ-442] 内容をそろえて改変してもHEADの原文prefixとは一致しない', () => {
    const { root, lock, path } = fixture(true); seed(root); replaceQualityIndex(lock, evaluation()); runGit(root, 'add', 'reports'); runGit(root, 'commit', '-q', '-m', 'ledger');
    const changed = { ...evaluation(), evaluator: { name: 'loomake' as const, version: '9.9.9' } };
    writeFileSync(path('history'), lines([changed])); writeFileSync(path('index'), JSON.stringify(changed));
    expect(qualityWorktreeClean(lock, readQualitySnapshot(root))).toBe(false);
    expect(lstatSync(join(root, EVAL_LOCK)).isFile()).toBe(true);
  });
});
