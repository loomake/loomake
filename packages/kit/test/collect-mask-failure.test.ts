import { expect, it, vi } from 'vitest';

const secret = 'sk-' + 'a'.repeat(30);
vi.mock('../src/runtime/redact.js', async importOriginal => {
  const original = await importOriginal<typeof import('../src/runtime/redact.js')>();
  return { ...original, maskValue: () => { throw new Error(secret); } };
});
import { collectToolOutput } from '../src/collect/collect.js';
import * as runtime from '../src/runtime/process.js';

it('[REQ-450] maskValue が失敗したら固定の reason で unreadable にする', () => {
  const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue({ status: 1, signal: null, stdout: '[]', stderr: '' });
  try {
    expect(collectToolOutput({ tool: 'gh', command: secret, args: [secret], timeoutMs: 1000 })).toEqual({
      tool: 'gh', outcome: 'unreadable', exit: { status: 1, signal: null }, diagnostics: '', reason: '出力を安全に置換できません。',
    });
  } finally { spy.mockRestore(); }
});
