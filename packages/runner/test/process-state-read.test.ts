import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { processState } from './process-state.js';

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

describe.runIf(process.platform === 'linux')('試験用のプロセス状態判定での読み取りエラー', () => {
  afterEach(() => { vi.mocked(readFileSync).mockReset(); });

  function failStatusRead(code: string): Error {
    const error = Object.assign(new Error(`${code}: status read`), { code });
    vi.mocked(readFileSync).mockImplementationOnce((path) => {
      expect(path).toBe(`/proc/${process.pid}/status`);
      throw error;
    });
    return error;
  }

  it('[REQ-212] status の read が ESRCH になったら missing と判定する', () => {
    failStatusRead('ESRCH');
    expect(processState(process.pid)).toBe('missing');
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith(`/proc/${process.pid}/status`, 'utf8');
  });

  it('[REQ-212] status の read が ENOENT になったら missing と判定する', () => {
    failStatusRead('ENOENT');
    expect(processState(process.pid)).toBe('missing');
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith(`/proc/${process.pid}/status`, 'utf8');
  });

  it.each(['EACCES', 'EIO'])('[REQ-212] status の read の %s は同じエラーのまま送出する', (code) => {
    const error = failStatusRead(code);
    let caught: unknown;
    try { processState(process.pid); } catch (cause) { caught = cause; }
    expect(caught).toBe(error);
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith(`/proc/${process.pid}/status`, 'utf8');
  });
});
