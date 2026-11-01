import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { DOCUMENT_LIMITS } from '../packages/kit/src/runtime/input.js';

const metadataProbe = vi.hoisted(() => ({
  calls: [] as { args: readonly string[]; maxBuffer: number | undefined }[],
  shrink: null as string | null,
}));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn((...args: Parameters<typeof actual.execFileSync>) => {
    const [file, argv, options] = args;
    if (file === 'git' && argv?.[0] === '--no-replace-objects') {
      metadataProbe.calls.push({ args: [...argv], maxBuffer: options?.maxBuffer });
      if (metadataProbe.shrink === argv.slice(4, 6).join(' ')) {
        return actual.execFileSync(file, argv, { ...options, maxBuffer: 1 });
      }
    }
    return actual.execFileSync(...args);
  }) };
});
afterEach(() => { metadataProbe.calls.length = 0; metadataProbe.shrink = null; });

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-trusted-git-')); roots.push(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'core.autocrlf', 'false');
  mkdirSync(join(root, 'docs'));
  const body = '基準\n'; writeFileSync(join(root, 'docs', 'spec.md'), body);
  git('add', '--', 'docs/spec.md'); git('commit', '-qm', 'fixture');
  return { root, git, commit: git('rev-parse', 'HEAD'), body };
};

describe('固定commitのGit object読取り', () => {
  it.each([{ maxFileBytes: 1 }, { maxTotalBytes: 1 }, { maxFileBytes: 1, maxTotalBytes: 1 }])(
    '[REQ-376] メタデータとは別の本文予算%jで1 byteと空文書を読める', (overrides) => {
      const { root, git } = fixture();
      for (const text of ['x', '']) {
        writeFileSync(join(root, 'docs', 'spec.md'), text); git('commit', '-qam', 'tiny document');
        const commit = git('rev-parse', 'HEAD');
        metadataProbe.calls.length = 0;
        expect(readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, ...overrides })).toEqual([
          { file: 'docs/spec.md', mode: '100644', oid: git('rev-parse', `${commit}:docs/spec.md`), text },
        ]);
        const metadata = metadataProbe.calls.filter((call) => call.args.slice(4, 6).join(' ') !== 'cat-file blob');
        expect(metadata.map((call) => call.args.slice(4, 6).join(' '))).toEqual(['cat-file -t', 'ls-tree -rz', 'cat-file -s']);
        expect(metadata.every((call) => Number.isSafeInteger(call.maxBuffer) && call.maxBuffer === DOCUMENT_LIMITS.maxTotalBytes)).toBe(true);
      }
    },
  );

  it('[REQ-376] 1 byteのファイル上限を超える本文は読まない', () => {
    const { root, git } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), 'xx'); git('commit', '-qam', 'oversized tiny file');
    metadataProbe.calls.length = 0;
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs', { ...DOCUMENT_LIMITS, maxFileBytes: 1 }))
      .toThrow('文書のバイト上限');
    expect(metadataProbe.calls.filter((call) => call.args.slice(4, 6).join(' ') === 'cat-file blob')).toHaveLength(0);
  });

  it('[REQ-376] 各1 byteの2文書は合計2で読み、合計1では2番目を読まない', () => {
    const { root, git } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), 'x'); writeFileSync(join(root, 'docs', 'two.md'), 'y');
    git('add', '--', 'docs/two.md'); git('commit', '-qam', 'tiny aggregate');
    const commit = git('rev-parse', 'HEAD');
    expect(readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxFileBytes: 1, maxTotalBytes: 2 }))
      .toEqual(['spec.md', 'two.md'].map((file, position) => ({ file: `docs/${file}`, mode: '100644',
        oid: git('rev-parse', `${commit}:docs/${file}`), text: position === 0 ? 'x' : 'y' })));
    metadataProbe.calls.length = 0;
    expect(() => readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxFileBytes: 1, maxTotalBytes: 1 }))
      .toThrow('文書のバイト上限');
    expect(metadataProbe.calls.filter((call) => call.args.slice(4, 6).join(' ') === 'cat-file blob')).toHaveLength(1);
  });

  it.each(['cat-file -t', 'ls-tree -rz', 'cat-file -s'])(
    '[REQ-376] %sの実ENOBUFSをメタデータの上限として区別する', (command) => {
      const { root, git } = fixture();
      writeFileSync(join(root, 'docs', 'spec.md'), 'x'); git('commit', '-qam', 'metadata overflow');
      metadataProbe.shrink = command;
      expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs'))
        .toThrow('Git のメタデータが読取りの上限を超えています');
    },
  );

  it('[REQ-376] ファイルと合計のバイト予算を本文の読取り前に判定する', () => {
    const { root, git } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), 'x'.repeat(64));
    git('commit', '-qam', 'file byte limit');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs', { ...DOCUMENT_LIMITS, maxFileBytes: 32 }))
      .toThrow('文書のバイト上限');
    writeFileSync(join(root, 'docs', 'spec.md'), '基準\n');
    writeFileSync(join(root, 'docs', 'two.md'), 'x'.repeat(200));
    git('add', '--', 'docs/two.md'); git('commit', '-qam', 'total byte limit');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs', { ...DOCUMENT_LIMITS, maxTotalBytes: 150 }))
      .toThrow('文書のバイト上限');
  });

  it('[REQ-376][REQ-370][REQ-371] dirty checkoutや現在HEADではなく指定commitの本文を読む', () => {
    const { root, git, commit, body } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), '別のcommit\n'); git('commit', '-qam', 'next');
    writeFileSync(join(root, 'docs', 'spec.md'), 'dirty\n');
    expect(readGitDocuments(root, commit, 'docs')).toEqual([{ file: 'docs/spec.md', mode: '100644', oid: git('rev-parse', `${commit}:docs/spec.md`), text: body }]);
    expect(git('status', '--porcelain')).toContain('docs/spec.md');
  });

  it('[REQ-376][REQ-370][REQ-371] replacement refで同じSHAの内容を差し替えない', () => {
    const { root, git, commit, body } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), '差替え\n'); git('commit', '-qam', 'replacement');
    git('replace', commit, git('rev-parse', 'HEAD'));
    expect(readGitDocuments(root, commit, 'docs')[0].text).toBe(body);
  });

  it('[REQ-376][REQ-370][REQ-371] UTF-8のBOMを本文から消さず、不正なバイトを置換して読まない', () => {
    const { root, git } = fixture();
    writeFileSync(join(root, 'docs', 'spec.md'), '\uFEFF基準'); git('commit', '-qam', 'bom');
    expect(readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs')[0].text).toBe('\uFEFF基準');
    writeFileSync(join(root, 'docs', 'spec.md'), Buffer.from([0xc3, 0x28])); git('commit', '-qam', 'invalid');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs')).toThrow('正しい UTF-8');
  });

  it('[REQ-376][REQ-370][REQ-371] symlinkとsubmoduleのGit modeを通常blobとして読まない', () => {
    const { root, git, commit } = fixture();
    const oid = git('rev-parse', `${commit}:docs/spec.md`);
    git('update-index', '--add', '--cacheinfo', `120000,${oid},docs/link`);
    git('commit', '-qm', 'symlink');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs')).toThrow('通常ファイル');
    git('update-index', '--force-remove', 'docs/link');
    git('update-index', '--add', '--cacheinfo', `160000,${commit},docs/submodule`);
    git('commit', '-qm', 'submodule');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs')).toThrow('通常ファイル');
  });

  it('[REQ-376][REQ-370][REQ-371] literalなpathを使い、pathspec記法や親参照で読取り範囲を広げない', () => {
    const { root, commit } = fixture();
    for (const path of ['../docs', '/docs', 'docs/../docs', 'docs\\spec.md', ':(glob)**', '.git/config', 'docs\0spec.md']) {
      expect(() => readGitDocuments(root, commit, path)).toThrow('path');
    }
    expect(readGitDocuments(root, commit, '*')).toEqual([]);
    for (const ref of ['HEAD', '--all', commit.slice(0, 7), `${commit}:docs`]) expect(() => readGitDocuments(root, ref, 'docs')).toThrow('commit SHA');
  });

  it('[REQ-376][REQ-370][REQ-371] 文書のファイル・合計・項目・深さの上限を超えて読まない', () => {
    const { root, git, commit } = fixture();
    expect(() => readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxFileBytes: 1 })).toThrow();
    expect(() => readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxTotalBytes: 1 })).toThrow();
    expect(() => readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxDepth: 0 })).toThrow('深さ');
    writeFileSync(join(root, 'docs', 'two.md'), '二番目'); git('add', '.'); git('commit', '-qm', 'two');
    expect(() => readGitDocuments(root, git('rev-parse', 'HEAD'), 'docs', { ...DOCUMENT_LIMITS, maxEntries: 1 })).toThrow('探索項目');
    expect(() => readGitDocuments(root, commit, 'docs', { ...DOCUMENT_LIMITS, maxEntries: -1 })).toThrow('予算');
  });
});
