import type { ParseResult } from '../parse.js';
import { readJson } from './json.js';
import type { AgentCause, ToolObservation } from './types.js';

export function parseClaudeResult(file: string, text: string): ParseResult<ToolObservation | null> {
  const { reader: r, value } = readJson(file, text);
  const result = r.object(value, 'result');
  if (result.type !== 'result') r.fail('type');
  const subtype = r.string(result.subtype, 'subtype');
  if (typeof result.is_error !== 'boolean') r.fail('is_error');
  const output = r.optionalString(result.result, 'result');
  const sessionId = r.optionalString(result.session_id, 'session_id');
  const turns = result.num_turns == null ? null : r.integer(result.num_turns, 'num_turns');
  const errors = r.array(result.errors, 'errors', true).map((error, i) => r.string(error, `errors[${i}]`));
  let cause: AgentCause | null;
  if (subtype === 'success') cause = result.is_error === true ? 'flagged_error' : output === null ? 'missing_result' : null;
  else cause = subtype.startsWith('error_') ? 'reported_error' : 'unknown_subtype';
  return r.finish({ tool: 'claude', kind: 'agent-result', result: {
    terminal: cause === null ? 'success' : 'error', cause, text: output, sessionId, turns, errors,
  } });
}
