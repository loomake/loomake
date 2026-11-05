import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClaudeResult } from '../../src/tool-output/claude.js';

const base = { type: 'result', subtype: 'success', is_error: false, result: '応答' };
const parse = (value: unknown) => parseClaudeResult('claude', JSON.stringify(value));
describe('Claude result', () => {
  it('[REQ-448] stream-json の型と docs から合成した fixture を変換する', () => {
    const text = readFileSync(new URL('./fixtures/claude.json', import.meta.url), 'utf8');
    expect(parseClaudeResult('claude', text)).toEqual({ value: { tool: 'claude', kind: 'agent-result', result: {
      terminal: 'success', cause: null, text: '合成の応答', sessionId: 'synthetic-session', turns: 2, errors: [],
    } }, errors: [] });
  });
  it.each([
    [{ ...base }, 'success', null],
    [{ ...base, result: '' }, 'success', null],
    [{ ...base, is_error: true, result: null }, 'error', 'flagged_error'],
    [{ ...base, result: undefined }, 'error', 'missing_result'],
    [{ ...base, result: null }, 'error', 'missing_result'],
    [{ ...base, subtype: 'error_max_turns', is_error: false }, 'error', 'reported_error'],
    [{ ...base, subtype: 'error_x', is_error: true }, 'error', 'reported_error'],
    [{ ...base, subtype: 'future', is_error: true }, 'error', 'unknown_subtype'],
  ])('[REQ-448] 正しい形の終端を分類する: %j', (input, terminal, cause) => {
    expect(parse(input)).toMatchObject({ value: { result: { terminal, cause } }, errors: [] });
  });
  it('[REQ-448] 任意欄の欠落と null を正規化し、未知欄を捨てる', () => {
    const expected = { terminal: 'success', cause: null, text: '応答', sessionId: null, turns: null, errors: [] };
    expect(parse(base).value).toEqual({ tool: 'claude', kind: 'agent-result', result: expected });
    expect(parse({ ...base, errors: null, session_id: null, num_turns: null, unknown: { result: 'x' } }).value).toEqual({
      tool: 'claude', kind: 'agent-result', result: expected,
    });
    expect(parse({ ...base, errors: ['一', '二'], num_turns: 0, session_id: '' }).value).toMatchObject({
      result: { errors: ['一', '二'], turns: 0, sessionId: '' },
    });
  });
  it.each([[], null, { ...base, type: 'system' }, { ...base, type: undefined }, { ...base, subtype: 1 },
    { ...base, subtype: undefined }, { ...base, is_error: undefined }, { ...base, is_error: 'false' },
    { ...base, result: false }, { ...base, errors: 'error' }, { ...base, errors: [1] }, { ...base, session_id: [] },
    ...[-1, 0.5, 2 ** 53].map(num_turns => ({ ...base, num_turns })),
  ])('[REQ-448] 不正な形と整数の境界を拒否する: %j', input => {
    const result = parse(input); expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
  });
  it('[REQ-448] 解析失敗の診断に秘密の値と未知 key を含めない', () => {
    const secret = 'ghp_' + 'a'.repeat(25);
    expect(parse({ ...base, errors: [{ [secret]: secret }] }).errors).toEqual([
      { file: 'claude', line: 1, message: '出力の形が違います：errors[0]' },
    ]);
    expect(parse({ ...base, num_turns: Number.MAX_SAFE_INTEGER }).errors).toEqual([]);
  });
});
