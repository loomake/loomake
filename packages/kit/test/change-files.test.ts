import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { findChangeDir, specFiles, toPosix } from '@loomake/kit';

/** 一時ディレクトリに files を置いて fn を実行し、終わったら消す */
function withDir<T>(files: string[], fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'loomake-change-files-'));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), '');
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('specFiles', () => {
  it('specs/ の下の spec.md を名前の順に返し、node_modules とドットで始まる名前は見ない', () => {
    const files = ['specs/b/spec.md', 'specs/a/spec.md', 'specs/a/notes.md', 'specs/.draft/spec.md', 'specs/node_modules/x/spec.md'];
    withDir(files, (root) => {
      expect(specFiles(root).map((f) => toPosix(relative(root, f)))).toEqual(['specs/a/spec.md', 'specs/b/spec.md']);
    });
  });

  it('specs/ がなければ空の配列を返す', () => withDir([], (root) => expect(specFiles(root)).toEqual([])));
});

describe('findChangeDir', () => {
  it('進行中の change を、archive より先に返す', () =>
    withDir(['c1/trace.md', 'archive/2026-10-23-c1/trace.md'], (root) => expect(findChangeDir(root, 'c1')).toBe(join(root, 'c1'))));

  it('進行中になければ、archive の <日付>-<change-id> のうち新しいものを返す', () =>
    withDir(['archive/2026-10-22-c1/trace.md', 'archive/2026-10-23-c1/trace.md', 'archive/2026-10-24-c10/trace.md'], (root) =>
      expect(findChangeDir(root, 'c1')).toBe(join(root, 'archive', '2026-10-23-c1')),
    ));

  it('探すファイルを持たないディレクトリは返さない', () =>
    withDir(['c1/proposal.md', 'archive/2026-10-23-c1/proposal.md'], (root) => {
      expect(findChangeDir(root, 'c1')).toBeUndefined();
      expect(findChangeDir(root, 'c1', 'proposal.md')).toBe(join(root, 'c1'));
    }));

  it('archive という名前の change は探さない', () => withDir(['archive/trace.md'], (root) => expect(findChangeDir(root, 'archive')).toBeUndefined()));
});
