import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeSync, fstatSync, mkdirSync, mkdtempSync, openSync, readSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInputReader, UsageError } from '@loomake/kit';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, openSync: vi.fn(fs.openSync), closeSync: vi.fn(fs.closeSync), fstatSync: vi.fn(fs.fstatSync), readSync: vi.fn(fs.readSync) };
});
afterEach(() => vi.clearAllMocks());

function fixture(action: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-input-'));
  try { action(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const directoryLink = (target: string, link: string) => symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');

describe('入力の探索予算', () => {
  it('[REQ-170] ファイルを整列し、見つからない探索先を空として扱う', () => fixture((root) => {
    writeFileSync(join(root, 'z.md'), 'z'); writeFileSync(join(root, 'a.md'), 'a');
    expect(createInputReader().walk(root)).toEqual([join(root, 'a.md'), join(root, 'z.md')]);
    expect(createInputReader().walk(join(root, 'missing'))).toEqual([]);
  }));

  it('[REQ-170] 項目数の上限ちょうどを認め、超えたら止める', () => fixture((root) => {
    writeFileSync(join(root, 'a'), 'a'); writeFileSync(join(root, 'b'), 'b');
    expect(createInputReader({ maxEntries: 2 }).walk(root)).toHaveLength(2);
    writeFileSync(join(root, 'c'), 'c');
    expect(() => createInputReader({ maxEntries: 2 }).walk(root)).toThrow(/項目.*2/);
  }));

  it('[REQ-170] 深さの上限を超えるディレクトリへ進まない', () => fixture((root) => {
    mkdirSync(join(root, 'a/b'), { recursive: true });
    expect(() => createInputReader({ maxDepth: 1 }).walk(root)).toThrow(/深さ.*1/);
    expect(createInputReader({ maxDepth: 2 }).walk(root)).toEqual([]);
  }));

  it('[REQ-170] verify用の除外を維持しても訪問項目数は制限する', () => fixture((root) => {
    mkdirSync(join(root, 'node_modules')); mkdirSync(join(root, '.hidden'));
    writeFileSync(join(root, 'visible'), 'x');
    expect(createInputReader().walk(root, { skipIgnored: true })).toEqual([join(root, 'visible')]);
    expect(() => createInputReader({ maxEntries: 2 }).walk(root, { skipIgnored: true })).toThrow('項目');
  }));

  it('[REQ-170] 除外した名前のリンクもたどらずverifyの互換性を保つ', () => fixture((root) => {
    directoryLink(root, join(root, 'node_modules'));
    expect(createInputReader().walk(root, { skipIgnored: true })).toEqual([]);
  }));

  it('[REQ-170] 親へ戻るリンクをたどらない', () => fixture((root) => {
    directoryLink(root, join(root, 'back'));
    expect(() => createInputReader().walk(root)).toThrow(/リンク.*back/);
  }));
});

describe('入力のバイト予算とファイル型', () => {
  it('[REQ-171] UTF-8のバイト数で境界を判定する', () => fixture((root) => {
    const path = join(root, 'text'); writeFileSync(path, 'あい');
    expect(createInputReader({ maxFileBytes: 6 }).read(path)).toBe('あい');
    expect(() => createInputReader({ maxFileBytes: 5 }).read(path)).toThrow(/ファイル.*5/);
  }));

  it('[REQ-171] 各ファイルが小さくても読み取り合計を制限する', () => fixture((root) => {
    const a = join(root, 'a'); const b = join(root, 'b');
    writeFileSync(a, '1234'); writeFileSync(b, '56789');
    const reader = createInputReader({ maxTotalBytes: 8 });
    expect(reader.read(a)).toBe('1234');
    expect(() => reader.read(b)).toThrow(/合計.*8/);
  }));

  it('[REQ-171] 最終要素がリンクかディレクトリなら読み取らない', () => fixture((root) => {
    directoryLink(root, join(root, 'link'));
    expect(() => createInputReader().read(join(root, 'link'))).toThrow(/リンク/);
    expect(() => createInputReader().read(root)).toThrow(/通常のファイル/);
  }));

  it('[REQ-171] 既定の1MiBを超えた疎なファイルを一括確保せず拒否する', () => fixture((root) => {
    const path = join(root, 'large'); writeFileSync(path, ''); truncateSync(path, 1024 * 1024 + 1);
    expect(() => createInputReader().read(path)).toThrow(/ファイル.*1048576/);
  }));

  it('[REQ-171] 開いた後のサイズ情報が古くても実際の読み取り量で止めて閉じる', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root) => {
      const path = join(root, 'changed'); writeFileSync(path, '123456789');
      vi.mocked(fstatSync).mockImplementationOnce((fd) => Object.assign(actual.fstatSync(fd), { size: 0 }));
      expect(() => createInputReader({ maxFileBytes: 8 }).read(path)).toThrow('ファイル');
      const fd = vi.mocked(openSync).mock.results.at(-1)!.value as number;
      expect(() => actual.fstatSync(fd)).toThrow();
      expect(vi.mocked(closeSync).mock.calls.some(([closed]) => closed === fd)).toBe(true);
    });
  });

  it('[REQ-171] 読み取りの例外でも開いたハンドルを閉じる', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root) => {
      const path = join(root, 'text'); writeFileSync(path, 'text');
      vi.mocked(readSync).mockImplementationOnce(() => { throw new Error('read failed'); });
      expect(() => createInputReader().read(path)).toThrow(UsageError);
      const fd = vi.mocked(openSync).mock.results.at(-1)!.value as number;
      expect(() => actual.fstatSync(fd)).toThrow();
    });
  });

  it.each([{ maxFileBytes: 0 }, { maxTotalBytes: -1 }, { maxEntries: 1.5 }, { maxDepth: -1 }, { maxFileBytes: Infinity }])('[REQ-171] 不正な予算 %j は使わない', (limits) => {
    expect(() => createInputReader(limits)).toThrow(UsageError);
  });
});

describe('ファイルの先頭の読み取り', () => {
  it('[REQ-171] 先頭の指定したバイトまでを読み、読んだ分だけを合計に数える', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-head-'));
    try {
      const file = join(dir, 'a.json');
      writeFileSync(file, 'x'.repeat(100));
      const reader = createInputReader({ maxTotalBytes: 25 });
      expect(reader.readHead(file, 10)).toBe('x'.repeat(10));
      expect(reader.readHead(file, 10)).toBe('x'.repeat(10));
      expect(() => reader.readHead(file, 10)).toThrow(/読み取り合計の上限は25バイト/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('[REQ-171] 途中で切れた複数バイト文字は捨て、シンボリックリンクは読まない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-head-'));
    try {
      const file = join(dir, 'a.json');
      writeFileSync(file, 'ああ');
      expect(createInputReader().readHead(file, 4)).toBe('あ');
      symlinkSync(file, join(dir, 'link.json'));
      expect(() => createInputReader().readHead(join(dir, 'link.json'), 4)).toThrow(/シンボリックリンク/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
