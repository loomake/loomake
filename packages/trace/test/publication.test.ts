import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageError } from '@loomake/kit';
import { publishEvidence } from '../src/publication.js';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, mkdirSync: vi.fn(fs.mkdirSync), openSync: vi.fn(fs.openSync), closeSync: vi.fn(fs.closeSync), writeFileSync: vi.fn(fs.writeFileSync), fsyncSync: vi.fn(fs.fsyncSync), linkSync: vi.fn(fs.linkSync), unlinkSync: vi.fn(fs.unlinkSync) };
});
afterEach(() => vi.clearAllMocks());

function fixture(action: (root: string, file: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-publication-'));
  try { action(root, join(root, 'evidence.json')); } finally { rmSync(root, { recursive: true, force: true }); }
}
const failure = (code: string) => Object.assign(new Error(`test ${code}`), { code });

describe('上書きしない証拠の公開', () => {
  it('[REQ-175] 完全な内容を公開し一時ファイルを残さない', () => fixture((root, file) => {
    expect(publishEvidence(file, '{"ok":true}\n')).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('{"ok":true}\n');
    expect(readdirSync(root)).toEqual(['evidence.json']);
  }));

  it('[REQ-175] 既存の最終ファイルは上書きしない', () => fixture((root, file) => {
    writeFileSync(file, 'existing');
    expect(publishEvidence(file, 'replacement')).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe('existing');
    expect(readdirSync(root)).toEqual(['evidence.json']);
  }));

  it('[REQ-175] 部分書き込みで失敗しても最終名を作らず一時ファイルを片付ける', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root, file) => {
      vi.mocked(writeFileSync).mockImplementationOnce((target) => {
        actual.writeFileSync(target, 'partial');
        expect(existsSync(file)).toBe(false);
        throw failure('ENOSPC');
      });
      expect(() => publishEvidence(file, 'complete')).toThrow(UsageError);
      expect(existsSync(file)).toBe(false);
      expect(readdirSync(root)).toEqual([]);
    });
  });

  it('[REQ-175] 同期が失敗したら公開しない', () => fixture((root, file) => {
    vi.mocked(fsyncSync).mockImplementationOnce(() => { throw failure('EIO'); });
    expect(() => publishEvidence(file, 'complete')).toThrow(UsageError);
    expect(existsSync(file)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  }));

  it('[REQ-175] linkを使えない保存先で直接書き込みに切り替えない', () => fixture((root, file) => {
    vi.mocked(linkSync).mockImplementationOnce(() => { throw failure('EPERM'); });
    expect(() => publishEvidence(file, 'complete')).toThrow(UsageError);
    expect(existsSync(file)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  }));

  it('[REQ-175] 公開時点では一時ファイル全体が書かれハンドルが閉じている', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((_root, file) => {
      vi.mocked(linkSync).mockImplementationOnce((source, target) => {
        const fd = vi.mocked(openSync).mock.results.at(-1)!.value as number;
        expect(() => actual.fstatSync(fd)).toThrow();
        expect(readFileSync(source, 'utf8')).toBe('complete');
        expect(existsSync(file)).toBe(false);
        actual.linkSync(source, target);
      });
      expect(publishEvidence(file, 'complete')).toBe(true);
      expect(vi.mocked(closeSync).mock.calls).toHaveLength(1);
    });
  });

  it('[REQ-175] 自分が作れなかった一時名は削除しない', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root, file) => {
      vi.mocked(openSync).mockImplementationOnce((temporary) => {
        actual.writeFileSync(temporary, 'foreign', { flag: 'wx' });
        throw failure('EEXIST');
      });
      expect(() => publishEvidence(file, 'complete')).toThrow(UsageError);
      expect(existsSync(file)).toBe(false);
      const left = readdirSync(root);
      expect(left).toHaveLength(1);
      expect(readFileSync(join(root, left[0]), 'utf8')).toBe('foreign');
    });
  });

  it('[REQ-176] 保存先作成の失敗も対象付きのUsageErrorにする', () => fixture((_root, file) => {
    vi.mocked(mkdirSync).mockImplementationOnce(() => { throw failure('EACCES'); });
    let error: unknown;
    try { publishEvidence(file, 'complete'); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(UsageError);
    expect((error as Error).message).toContain(file);
    expect(existsSync(file)).toBe(false);
  }));

  it('[REQ-176] 公開後の片付け失敗では完全な証拠と一時名を保ち対象を示す', () => fixture((root, file) => {
    vi.mocked(unlinkSync).mockImplementationOnce(() => { throw failure('EACCES'); });
    expect(() => publishEvidence(file, 'complete')).toThrow(/片付け.*loomake-evidence/);
    expect(readFileSync(file, 'utf8')).toBe('complete');
    expect(readdirSync(root)).toHaveLength(2);
  }));
});
