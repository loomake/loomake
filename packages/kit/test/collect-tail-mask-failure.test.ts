import { expect, it, vi } from 'vitest';

vi.mock('../src/runtime/redact.js', async importOriginal => {
  const original = await importOriginal<typeof import('../src/runtime/redact.js')>();
  return { ...original, maskSecrets: () => { throw new Error('synthetic replacement failure'); } };
});
import { collectToolOutput } from '../src/collect/collect.js';
import { RuntimeFailure } from '../src/runtime/errors.js';
import * as runtime from '../src/runtime/process.js';

it('[REQ-450] 切り出し後の置換に失敗しても生の診断と cause を例外へ含めない', () => {
  const stderr = 'prefix '.repeat(900) + 'task-' + 'a'.repeat(20) + ' '.repeat(4096 - 23);
  const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue({ status: 0, signal: null, stdout: '[]', stderr });
  try {
    expect(() => collectToolOutput({ tool: 'gh', command: 'node', args: [], timeoutMs: 1000 })).toThrow(RuntimeFailure);
    try { collectToolOutput({ tool: 'gh', command: 'node', args: [], timeoutMs: 1000 }); expect.fail('例外になる'); }
    catch (error) {
      expect(error).toBeInstanceOf(RuntimeFailure);
      expect((error as Error).message).toBe('外部ツールの出力を収集できません。');
      expect((error as Error).cause).toBeUndefined();
    }
  } finally { spy.mockRestore(); }
});
