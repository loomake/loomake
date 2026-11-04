import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { DOCUMENT_LIMITS } from '../packages/kit/src/runtime/input.js';

const probe = vi.hoisted(() => ({ calls: [] as { args: readonly string[]; input: unknown; stdio: unknown; maxBuffer: number | undefined }[] }));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn((...args: Parameters<typeof actual.execFileSync>) => {
    const [file, argv, options] = args;
    if (file === 'git' && argv?.[0] === '--no-replace-objects') {
      probe.calls.push({ args: [...argv].slice(4), input: options?.input, stdio: options?.stdio, maxBuffer: options?.maxBuffer });
    }
    return actual.execFileSync(...args);
  }) };
});
const roots: string[] = [];
afterEach(() => { probe.calls.length = 0; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
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
const commands = () => probe.calls.map((call) => call.args.slice(0, 2).join(' '));

it('[REQ-376] 複数文書の全path・本文・oid・modeと同じ値の予算を保持する', { timeout: 60_000 }, () => {
  const f = fixture(); f.git('update-index', '--chmod=+x', 'docs/d'); f.git('commit', '-qm', 'executable'); f.commit = f.git('rev-parse', 'HEAD');
  const expected = ['a', 'c', 'd', 'nested/b'].map((file) => ({ file: `docs/${file}`, text: file === 'd' ? 'last' : file === 'nested/b' ? '' : '\uFEFF基準',
    oid: f.git('rev-parse', `${f.commit}:docs/${file}`), mode: file === 'd' ? '100755' : '100644' }));
  expect(read(f)).toEqual(expected);
  expect(read(f, { ...DOCUMENT_LIMITS })).toEqual(expected);
  expect(read(f, { ...DOCUMENT_LIMITS, maxEntries: 4095 })).toEqual(expected);
});

it('[REQ-376] 重複blobを合計へ加算し既定16MiB等値を読み1 byte超の本文を読まない', { timeout: 60_000 }, () => {
  const text = 'x'.repeat(DOCUMENT_LIMITS.maxFileBytes);
  const f = fixture(Object.fromEntries([...Array.from({ length: 16 }, (_, index) => [`a${String(index).padStart(2, '0')}`, text]), ['z', '']]));
  const documents = read(f);
  expect(documents).toHaveLength(17);
  expect(documents.reduce((total, doc) => total + Buffer.byteLength(doc.text), 0)).toBe(DOCUMENT_LIMITS.maxTotalBytes);
  expect(new Set(documents.slice(0, 16).map((doc) => doc.oid)).size).toBe(1);
  expect(documents.map((doc) => doc.file)).toEqual([...Array.from({ length: 16 }, (_, index) => `docs/a${String(index).padStart(2, '0')}`), 'docs/z']);
  writeFileSync(join(f.root, 'docs/z'), 'z'); f.git('commit', '-qam', 'one byte over'); f.commit = f.git('rev-parse', 'HEAD');
  const z = f.git('rev-parse', `${f.commit}:docs/z`);
  expect(() => read(f)).toThrow('Git の入力が文書のバイト上限を超えています');
  expect(probe.calls.filter((call) => call.args[1] === 'blob')).toHaveLength(16);
  expect(probe.calls.some((call) => call.args[1] === 'blob' && call.args[2] === z)).toBe(false);
});

it.each(['symlink', 'depth', 'size'] as const)('[REQ-376] 先行UTF-8の失敗を後方%sより先に返す', { timeout: 60_000 }, (kind) => {
  const f = fixture({ a: Buffer.from([0xc3, 0x28]), z: 'later' });
  if (kind === 'symlink') f.git('update-index', '--cacheinfo', `120000,${f.git('rev-parse', `${f.commit}:docs/z`)},docs/z`);
  if (kind === 'depth') {
    const file = join(f.root, 'docs', ...Array<string>(32).fill('zz'), 'leaf'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'later'); f.git('add', '--', 'docs');
  }
  if (kind === 'size') { writeFileSync(join(f.root, 'docs/z'), 'x'.repeat(2 * DOCUMENT_LIMITS.maxFileBytes)); f.git('add', '--', 'docs'); }
  f.git('commit', '-qm', 'later invalid row'); f.commit = f.git('rev-parse', 'HEAD');
  expect(() => read(f)).toThrow('Git の文書は正しい UTF-8 で記述してください');
});

it('[REQ-376] 先行ファイル上限超過の本文を取得しない', { timeout: 60_000 }, () => {
  const f = fixture({ a: 'x'.repeat(2 * DOCUMENT_LIMITS.maxFileBytes), z: '' });
  expect(() => read(f)).toThrow('Git の入力が文書のバイト上限を超えています');
  expect(commands().filter((command) => command === 'cat-file blob')).toHaveLength(0);
});

it('[REQ-376] 単一文書とtiny・custom・巨大な安全整数予算を読める', { timeout: 60_000 }, () => {
  const f = fixture({ a: 'x' });
  const expected = read(f);
  for (const limits of [DOCUMENT_LIMITS, { ...DOCUMENT_LIMITS, maxFileBytes: 1, maxTotalBytes: 1 },
    { ...DOCUMENT_LIMITS, maxFileBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER }]) {
    expect(read(f, limits)).toEqual(expected);
    expect(commands()).toEqual(['cat-file -t', 'ls-tree -rz', 'cat-file -s', 'cat-file blob']);
  }
});
