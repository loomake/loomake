import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { DOCUMENT_LIMITS } from '../packages/kit/src/runtime/input.js';

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
