import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { DOCUMENT_LIMITS } from '../packages/kit/src/runtime/input.js';

const probe = vi.hoisted(() => ({
  calls: [] as { args: readonly string[]; input: unknown; stdio: unknown; maxBuffer: number | undefined }[],
  batch: null as ((output: Buffer) => Buffer) | null, listing: null as ((output: Buffer) => Buffer) | null, failure: null as Error | null, shrink: false,
}));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn((...args: Parameters<typeof actual.execFileSync>) => {
    const [file, argv, options] = args;
    if (file === 'git' && argv?.[0] === '--no-replace-objects') {
      probe.calls.push({ args: [...argv].slice(4), input: options?.input, stdio: options?.stdio, maxBuffer: options?.maxBuffer });
      if (argv[5]?.startsWith('--batch-check')) {
        if (probe.failure) throw probe.failure;
        const output = actual.execFileSync(file, argv, { ...options, ...(probe.shrink ? { maxBuffer: 1 } : {}) }) as Buffer;
        return probe.batch ? probe.batch(output) : output;
      }
      if (argv[4] === 'ls-tree' && probe.listing) return probe.listing(actual.execFileSync(...args) as Buffer);
    }
    return actual.execFileSync(...args);
  }) };
});
const roots: string[] = [];
afterEach(() => { probe.batch = null; probe.listing = null; probe.failure = null; probe.shrink = false; probe.calls.length = 0; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const fixture = (files: Record<string, string | Buffer> = { a: '\uFEFF基準', 'nested/b': '', c: '\uFEFF基準', d: 'last' }) => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-object-sizes-')); roots.push(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  appendFileSync(join(root, '.git', 'config'), '\n[user]\n name = fixture\n email = fixture@example.invalid\n[commit]\n gpgsign = false\n[core]\n autocrlf = false\n');
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, 'docs', file)), { recursive: true }); writeFileSync(join(root, 'docs', file), body);
  }
  git('add', '--', 'docs'); git('commit', '-qm', 'fixture');
  return { root, git, commit: git('rev-parse', 'HEAD') };
};
const read = (f: ReturnType<typeof fixture>, limits = DOCUMENT_LIMITS) => { probe.calls.length = 0; return readGitDocuments(f.root, f.commit, 'docs', limits); };
const batches = () => probe.calls.filter((call) => call.args[1]?.startsWith('--batch-check'));
const commands = () => probe.calls.map((call) => call.args.slice(0, 2).join(' '));

it('[REQ-376][REQ-418] 複数文書の全path・本文・oid・modeと同じ値の予算を保持する', { timeout: 60_000 }, () => {
  const f = fixture(); f.git('update-index', '--chmod=+x', 'docs/d'); f.git('commit', '-qm', 'executable'); f.commit = f.git('rev-parse', 'HEAD');
  const expected = ['a', 'c', 'd', 'nested/b'].map((file) => ({ file: `docs/${file}`, text: file === 'd' ? 'last' : file === 'nested/b' ? '' : '\uFEFF基準',
    oid: f.git('rev-parse', `${f.commit}:docs/${file}`), mode: file === 'd' ? '100755' : '100644' }));
  writeFileSync(join(f.root, 'docs/a'), 'replacement'); f.git('commit', '-qam', 'replacement'); f.git('replace', f.commit, f.git('rev-parse', 'HEAD'));
  writeFileSync(join(f.root, 'docs/a'), 'dirty checkout');
  expect(read(f)).toEqual(expected);
  expect(batches()).toHaveLength(1);
  expect(probe.calls.filter((call) => call.args[1] === '-s')).toHaveLength(0);
  expect(batches()[0]).toMatchObject({ input: expected.map((doc) => doc.oid).join('\n') + '\n', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: DOCUMENT_LIMITS.maxTotalBytes });
  expect(read(f, { ...DOCUMENT_LIMITS })).toEqual(expected);
  expect(batches()).toHaveLength(1);
  expect(read(f, { ...DOCUMENT_LIMITS, maxEntries: 4095 })).toEqual(expected);
  expect(batches()).toHaveLength(0);
});

it('[REQ-376][REQ-418] 重複blobを合計へ加算し既定16MiB等値を読み1 byte超の本文を読まない', { timeout: 60_000 }, () => {
  const text = 'x'.repeat(DOCUMENT_LIMITS.maxFileBytes);
  const f = fixture(Object.fromEntries([...Array.from({ length: 16 }, (_, index) => [`a${String(index).padStart(2, '0')}`, text]), ['z', '']]));
  const documents = read(f);
  expect(documents).toHaveLength(17);
  expect(batches()).toHaveLength(1);
  expect(documents.reduce((total, doc) => total + Buffer.byteLength(doc.text), 0)).toBe(DOCUMENT_LIMITS.maxTotalBytes);
  expect(new Set(documents.slice(0, 16).map((doc) => doc.oid)).size).toBe(1);
  expect(documents.map((doc) => doc.file)).toEqual([...Array.from({ length: 16 }, (_, index) => `docs/a${String(index).padStart(2, '0')}`), 'docs/z']);
  writeFileSync(join(f.root, 'docs/z'), 'z'); f.git('commit', '-qam', 'one byte over'); f.commit = f.git('rev-parse', 'HEAD');
  const z = f.git('rev-parse', `${f.commit}:docs/z`);
  expect(() => read(f)).toThrow('Git の入力が文書のバイト上限を超えています');
  expect(batches()).toHaveLength(1);
  expect(probe.calls.filter((call) => call.args[1] === 'blob')).toHaveLength(16);
  expect(probe.calls.some((call) => call.args[1] === 'blob' && call.args[2] === z)).toBe(false);
});

it.each(['symlink', 'depth', 'size'] as const)('[REQ-376][REQ-418] 先行UTF-8の失敗を後方%sより先に返す', { timeout: 60_000 }, (kind) => {
  const f = fixture({ a: Buffer.from([0xc3, 0x28]), z: 'later' });
  if (kind === 'symlink') f.git('update-index', '--cacheinfo', `120000,${f.git('rev-parse', `${f.commit}:docs/z`)},docs/z`);
  if (kind === 'depth') {
    const file = join(f.root, 'docs', ...Array<string>(32).fill('zz'), 'leaf'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'later'); f.git('add', '--', 'docs');
  }
  if (kind === 'size') { writeFileSync(join(f.root, 'docs/z'), 'x'.repeat(2 * DOCUMENT_LIMITS.maxFileBytes)); f.git('add', '--', 'docs'); }
  f.git('commit', '-qm', 'later invalid row'); f.commit = f.git('rev-parse', 'HEAD');
  expect(() => read(f)).toThrow('Git の文書は正しい UTF-8 で記述してください');
  expect(batches()).toHaveLength(kind === 'size' ? 1 : 0);
});

it('[REQ-376][REQ-418] 先行ファイル上限超過の本文を取得しない', { timeout: 60_000 }, () => {
  const f = fixture({ a: 'x'.repeat(2 * DOCUMENT_LIMITS.maxFileBytes), z: '' });
  expect(() => read(f)).toThrow('Git の入力が文書のバイト上限を超えています');
  expect(commands().filter((command) => command === 'cat-file blob')).toHaveLength(0);
});

it('[REQ-376][REQ-418] 単一文書とtiny・custom・巨大な安全整数予算を読める', { timeout: 60_000 }, () => {
  const f = fixture({ a: 'x' });
  const expected = read(f);
  for (const limits of [DOCUMENT_LIMITS, { ...DOCUMENT_LIMITS, maxFileBytes: 1, maxTotalBytes: 1 },
    { ...DOCUMENT_LIMITS, maxFileBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER }]) {
    expect(read(f, limits)).toEqual(expected);
    expect(commands()).toEqual(['cat-file -t', 'ls-tree -rz', 'cat-file -s', 'cat-file blob']);
  }
});

it.each([
  ['missing row', (s: string) => s.slice(s.indexOf('\n') + 1)], ['extra row', (s: string) => s + s.split('\n')[0] + '\n'],
  ['no LF', (s: string) => s.slice(0, -1)], ['order', (s: string) => s.trimEnd().split('\n').reverse().join('\n') + '\n'],
  ['oid', (s: string) => '0'.repeat(40) + s.slice(40)], ['type', (s: string) => s.replace(' blob ', ' tree ')],
  ...['-1', '01', '9007199254740993', 'é'].map((size) => [size, (s: string) => s.replace(/blob \d+/, `blob ${size}`)] as const),
  ['invalid UTF8', () => Buffer.from([0xc3, 0x28])],
] as const)('[REQ-418][REQ-376] 不正なbatch応答%sを全体の旧照会へ戻す', { timeout: 60_000 }, (_label, mutate) => {
  const f = fixture(); const expected = read(f, { ...DOCUMENT_LIMITS, maxEntries: 4095 });
  probe.batch = (output) => Buffer.from(mutate(output.toString('utf8')));
  expect(read(f)).toEqual(expected);
  expect(batches()).toHaveLength(1);
  expect(commands().slice(3)).toEqual(expected.flatMap(() => ['cat-file -s', 'cat-file blob']));
});

it('[REQ-418][REQ-376] batch固有のnative非0失敗でも旧方式で読める', { timeout: 60_000 }, () => {
  const f = fixture(); const expected = read(f);
  try { f.git('cat-file', '--loomake-unsupported-batch-option'); } catch (error) { probe.failure = error as Error; }
  expect(probe.failure).toMatchObject({ status: expect.any(Number), signal: null });
  expect(read(f)).toEqual(expected);
  expect(batches()).toHaveLength(1);
  expect(commands().slice(3)).toEqual(expected.flatMap(() => ['cat-file -s', 'cat-file blob']));
});

it.each([
  { signal: 'SIGTERM', status: null }, { signal: 'SIGTERM', status: null, code: 'ETIMEDOUT' }, { status: null, code: 'ENOENT' },
])('[REQ-418][REQ-376] 中断・起動失敗%jでは後続操作を始めない', { timeout: 60_000 }, (details) => {
  const f = fixture(); probe.failure = Object.assign(new Error('operation stopped'), details);
  expect(() => read(f)).toThrow(probe.failure);
  let stopped: unknown; try { read(f); } catch (error) { stopped = error; }
  expect(stopped).toBe(probe.failure);
  expect(batches()).toHaveLength(1);
  expect(commands()).toHaveLength(3);
});

it('[REQ-418][REQ-376] batchのnative ENOBUFSを既存の上限エラーにする', { timeout: 60_000 }, () => {
  const f = fixture(); probe.shrink = true;
  expect(() => read(f)).toThrow('Git のメタデータが読取りの上限を超えています');
  expect(batches()).toHaveLength(1);
  expect(commands()).toHaveLength(3);
});

it('[REQ-418][REQ-376] 欠落objectは旧ループの先行本文のあとで失敗する', { timeout: 60_000 }, () => {
  const f = fixture({ a: 'first', z: 'missing' }); const oid = f.git('rev-parse', `${f.commit}:docs/z`);
  unlinkSync(join(f.root, '.git/objects', oid.slice(0, 2), oid.slice(2)));
  let old: unknown; try { read(f, { ...DOCUMENT_LIMITS, maxEntries: 4095 }); } catch (error) { old = error; }
  expect(old).toMatchObject({ status: expect.any(Number) });
  expect(() => read(f)).toThrow((old as Error).message);
  expect(batches()).toHaveLength(1);
  expect(commands().slice(3)).toEqual(['cat-file -s', 'cat-file blob', 'cat-file -s']);
});

it.each(['docs/../z', 'outside/z'])('[REQ-418][REQ-376] 後方path%sの不正より先行UTF8を返す', { timeout: 60_000 }, (path) => {
  const f = fixture({ a: Buffer.from([0xc3, 0x28]), z: 'later' });
  probe.listing = (output) => Buffer.from(output.toString('utf8').replace('docs/z', path));
  expect(() => read(f)).toThrow('Git の文書は正しい UTF-8 で記述してください');
  expect(batches()).toHaveLength(0);
});

it('[REQ-418][REQ-376] 一括sizeも実blobの長さと照合する', { timeout: 60_000 }, () => {
  const f = fixture(); probe.batch = (output) => Buffer.from(output.toString('utf8').replace(/blob \d+/, 'blob 0'));
  expect(() => read(f)).toThrow('Git の blob の大きさが一致しません');
  expect(batches()).toHaveLength(1);
});

it('[REQ-418][REQ-377] 原14文書を17起動で照合する', { timeout: 60_000 }, () => {
  const root = join(import.meta.dirname, '..'); const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  probe.calls.length = 0;
  const documents = readGitDocuments(root, commit, ORIGINAL_C001_SNAPSHOT_DIR);
  expect(documents).toHaveLength(14);
  expect(verifyOriginalSnapshot(documents, sha256Hex).problems).toEqual([]);
  expect(probe.calls).toHaveLength(17);
  expect(batches()).toHaveLength(1);
});

it('[REQ-418][REQ-376] 既定予算の比較でgetterの再読取りを増やさない', { timeout: 60_000 }, () => {
  const f = fixture();
  const observed = (maxEntries: number) => {
    const counts = { maxFileBytes: 0, maxTotalBytes: 0, maxEntries: 0, maxDepth: 0 }; const limits = { ...DOCUMENT_LIMITS, maxEntries };
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      const value = limits[key]; Object.defineProperty(limits, key, { get: () => { counts[key]++; return value; }, enumerable: true });
    }
    read(f, limits); return counts;
  };
  expect(observed(DOCUMENT_LIMITS.maxEntries)).toEqual(observed(4095));
});
