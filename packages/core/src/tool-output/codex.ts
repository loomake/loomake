import type { ParseResult } from '../parse.js';
import { OutputReader, readJson } from './json.js';
import type { AgentCause, ToolObservation } from './types.js';

type TurnState = 'none' | 'open' | 'completed' | 'failed';

export function parseCodexEvents(file: string, text: string): ParseResult<ToolObservation | null> {
  const input = text.replace(/^\uFEFF/, '');
  let r = new OutputReader(file);
  if (!input.trim()) return { value: null, errors: [{ file, line: 1, message: '出力が空です' }] };
  let state: TurnState = 'none';
  let threadSeen = false;
  let sessionId: string | null = null;
  let turns = 0;
  let output: string | null = null;
  let errors: string[] = [];
  let streamError = false;
  for (const [i, line] of input.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const read = readJson(file, line, i + 1); r = read.reader;
    const event = r.object(read.value, 'event');
    const type = r.string(event.type, 'type');
    switch (type) {
      case 'thread.started':
        sessionId = r.string(event.thread_id, 'thread_id');
        if (threadSeen || turns > 0) r.fail('type', 'イベントの順序が違います');
        threadSeen = true;
        break;
      case 'turn.started':
        if (state === 'open') r.fail('type', 'イベントの順序が違います');
        state = 'open'; turns++; output = null; errors = []; streamError = false;
        break;
      case 'turn.completed':
        r.object(event.usage, 'usage');
        if (state !== 'open') r.fail('type', 'イベントの順序が違います');
        state = 'completed';
        break;
      case 'turn.failed': {
        const failure = r.object(event.error, 'error');
        errors.push(r.string(failure.message, 'error.message'));
        if (state !== 'open') r.fail('type', 'イベントの順序が違います');
        state = 'failed';
        break;
      }
      case 'error':
        errors.push(r.string(event.message, 'message')); streamError = true;
        break;
      case 'item.started': case 'item.updated': case 'item.completed': {
        const item = r.object(event.item, 'item');
        r.string(item.id, 'item.id');
        const itemType = r.string(item.type, 'item.type');
        if (type === 'item.completed' && itemType === 'agent_message') {
          const message = r.string(item.text, 'item.text');
          if (state === 'open') output = message;
        }
        break;
      }
    }
    if (r.errors.length) return { value: null, errors: r.errors };
  }
  if (!streamError && (state === 'none' || state === 'open')) r.fail('type', '終端のイベントがありません');
  const cause: AgentCause | null = streamError ? 'stream_error' : state === 'failed' ? 'reported_error' : null;
  return r.finish({ tool: 'codex', kind: 'agent-result', result: {
    terminal: cause === null ? 'success' : 'error', cause, text: output, sessionId, turns, errors,
  } });
}
