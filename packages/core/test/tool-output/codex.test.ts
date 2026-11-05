import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCodexEvents } from '../../src/tool-output/codex.js';

const started = { type: 'turn.started' };
const completed = { type: 'turn.completed', usage: {} };
const message = (text: string) => ({ type: 'item.completed', item: { id: '1', type: 'agent_message', text } });
const failed = { type: 'turn.failed', error: { message: '失敗' } };
const error = { type: 'error', message: '致命的' };
const parse = (...events: unknown[]) => parseCodexEvents('codex', events.map(e => JSON.stringify(e)).join('\n'));
describe('Codex events', () => {
  it('[REQ-448] 固定版からの合成 fixture、BOM・CRLF・空行・末尾改行なしを受け付ける', () => {
    const text = readFileSync(new URL('./fixtures/codex.jsonl', import.meta.url), 'utf8').trimEnd();
    expect(parseCodexEvents('codex', '\uFEFF \r\n' + text.replaceAll('\n', '\r\n') + '\r\n\t')).toEqual({
      value: { tool: 'codex', kind: 'agent-result', result: {
        terminal: 'success', cause: null, text: '合成の応答', sessionId: 'synthetic-thread', turns: 1, errors: [],
      } }, errors: [],
    });
  });
  it('[REQ-448] turn 前や open 中の致命的エラーを parsed にする', () => {
    for (const events of [[error], [started, error], [started, completed, error]]) {
      expect(parse(...events)).toMatchObject({ value: { result: { terminal: 'error', cause: 'stream_error', errors: ['致命的'] } }, errors: [] });
    }
    expect(parse(error).value).toMatchObject({ result: { turns: 0, text: null, sessionId: null } });
  });
  it('[REQ-448] 最後の turn の text と失敗だけを出現順に残す', () => {
    expect(parse(error, started, message('old'), failed, started, message('first'), message('last'), completed).value).toMatchObject({
      result: { terminal: 'success', cause: null, text: 'last', turns: 2, errors: [] },
    });
    expect(parse(started, error, failed, error).value).toMatchObject({
      result: { terminal: 'error', cause: 'stream_error', errors: ['致命的', '失敗', '致命的'] },
    });
    expect(parse(started, failed).value).toMatchObject({ result: { terminal: 'error', cause: 'reported_error', errors: ['失敗'] } });
  });
  it('[REQ-448] thread と text の省略、未知 event/item、turn 外の item を無視する', () => {
    expect(parse(message('outside'), { type: 'future' }, started,
      { type: 'item.started', item: { id: '', type: 'agent_message' } },
      { type: 'item.updated', item: { id: '', type: 'future' } },
      { type: 'item.completed', item: { id: '', type: 'error', message: 'nonfatal' } },
      completed, message('after')).value).toEqual({ tool: 'codex', kind: 'agent-result', result: {
      terminal: 'success', cause: null, text: null, sessionId: null, turns: 1, errors: [],
    } });
  });
  it.each([
    [[completed], 1], [[started, started], 2], [[started], 1], [[{ type: 'future' }], 1],
    [[started, { type: 'turn.completed' }], 2], [[started, { type: 'turn.completed', usage: [] }], 2],
    [[{ type: 'thread.started' }], 1], [[{ type: 'thread.started', thread_id: '' }, { type: 'thread.started', thread_id: '' }], 2],
    [[started, completed, { type: 'thread.started', thread_id: '' }], 3],
    [[failed], 1], [[started, { type: 'turn.failed', error: {} }], 2], [[{ type: 'error' }], 1],
    [[{ type: 'item.completed' }], 1], [[{ type: 'item.started', item: { type: 'future' } }], 1],
    [[{ type: 'item.updated', item: { id: 'x' } }], 1], [[started, { type: 'item.completed', item: { id: '', type: 'agent_message' } }], 2],
    [[[], started], 1], [[null], 1], [[{}], 1],
  ])('[REQ-448] 順序・終端・必須 payload の誤りの行を返す: %j', (events, line) => {
    const result = parse(...events); expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(line);
  });
  it('[REQ-448] JSONL の途中行と 2 個目以降の BOM を拒否し、入力断片を出さない', () => {
    for (const suffix of ['{"type":', '\uFEFF{"type":"turn.completed","usage":{}}']) {
      const result = parseCodexEvents('codex', '{"type":"turn.started"}\n'+suffix);
      expect(result.errors).toEqual([{ file: 'codex', line: 2, message: 'JSON として読めません' }]);
    }
    expect(parseCodexEvents('codex', '\uFEFF\uFEFF{}').value).toBeNull();
  });
  it('[REQ-448] 未知欄や usage の中身を返さず、深くても再帰しない', () => {
    expect(parse(started, { ...completed, usage: { unknown: 'secret' }, unknown: true }).value).toEqual({
      tool: 'codex', kind: 'agent-result', result: { terminal: 'success', cause: null, text: null, sessionId: null, turns: 1, errors: [] },
    });
  });
});
