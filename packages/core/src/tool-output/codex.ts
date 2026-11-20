import type { ParseResult } from '../parse.js';
import { OutputReader, readJson } from './json.js';
import type { AgentCause, AgentResult, ToolObservation } from './types.js';

type TurnState = 'none' | 'open' | 'completed' | 'failed';
type CodexState = {
  state: TurnState; threadSeen: boolean; sessionId: string | null;
  turns: number; output: string | null; errors: string[]; streamError: boolean;
};
type CodexEvent = Record<string, unknown>;
type EventLine = { line: number; text: string };
type EventHandler = (s: CodexState, event: CodexEvent, r: OutputReader, type: string) => void;

const UNFINISHED: readonly TurnState[] = ['none', 'open'];

export function parseCodexEvents(file: string, text: string): ParseResult<ToolObservation | null> {
  const input = text.replace(/^\uFEFF/, '');
  if (!input.trim()) return { value: null, errors: [{ file, line: 1, message: '出力が空です' }] };
  const s = initialState();
  return finishEvents(readEvents(file, input, s), s);
}

function initialState(): CodexState {
  return { state: 'none', threadSeen: false, sessionId: null, turns: 0, output: null, errors: [], streamError: false };
}

function eventLines(input: string): EventLine[] {
  return input.split(/\r?\n/).map((text, i) => ({ line: i + 1, text })).filter(({ text }) => text.trim() !== '');
}

/** 最初の誤りが出た行で止まり、その行の reader を返す。誤りがなければ最後の行の reader を返す */
function readEvents(file: string, input: string, s: CodexState): OutputReader {
  let r = new OutputReader(file);
  for (const event of eventLines(input)) {
    r = readEvent(file, event, s);
    if (r.errors.length) break;
  }
  return r;
}

function readEvent(file: string, { line, text }: EventLine, s: CodexState): OutputReader {
  const { reader: r, value } = readJson(file, text, line);
  const event = r.object(value, 'event');
  const type = r.string(event.type, 'type');
  HANDLERS.get(type)?.(s, event, r, type);
  return r;
}

function requireOrder(r: OutputReader, ok: boolean): void {
  if (!ok) r.fail('type', 'イベントの順序が違います');
}

function onThreadStarted(s: CodexState, event: CodexEvent, r: OutputReader): void {
  s.sessionId = r.string(event.thread_id, 'thread_id');
  requireOrder(r, !s.threadSeen && s.turns === 0);
  s.threadSeen = true;
}

function onTurnStarted(s: CodexState, _event: CodexEvent, r: OutputReader): void {
  requireOrder(r, s.state !== 'open');
  Object.assign(s, { state: 'open', turns: s.turns + 1, output: null, errors: [], streamError: false });
}

function onTurnCompleted(s: CodexState, event: CodexEvent, r: OutputReader): void {
  r.object(event.usage, 'usage');
  requireOrder(r, s.state === 'open');
  s.state = 'completed';
}

function onTurnFailed(s: CodexState, event: CodexEvent, r: OutputReader): void {
  const failure = r.object(event.error, 'error');
  s.errors.push(r.string(failure.message, 'error.message'));
  requireOrder(r, s.state === 'open');
  s.state = 'failed';
}

function onError(s: CodexState, event: CodexEvent, r: OutputReader): void {
  s.errors.push(r.string(event.message, 'message'));
  s.streamError = true;
}

function onItem(s: CodexState, event: CodexEvent, r: OutputReader, type: string): void {
  const item = r.object(event.item, 'item');
  r.string(item.id, 'item.id');
  const itemType = r.string(item.type, 'item.type');
  if (type === 'item.completed' && itemType === 'agent_message') keepMessage(s, r.string(item.text, 'item.text'));
}

/** turn の外の agent_message は text に残さない */
function keepMessage(s: CodexState, message: string): void {
  if (s.state === 'open') s.output = message;
}

// 未知の event は無視する。constructor などの名前を既定の処理と取り違えないよう Map で引く
const HANDLERS: ReadonlyMap<string, EventHandler> = new Map([
  ['thread.started', onThreadStarted], ['turn.started', onTurnStarted], ['turn.completed', onTurnCompleted],
  ['turn.failed', onTurnFailed], ['error', onError],
  ['item.started', onItem], ['item.updated', onItem], ['item.completed', onItem],
]);

function finishEvents(r: OutputReader, s: CodexState): ParseResult<ToolObservation | null> {
  if (!s.streamError && UNFINISHED.includes(s.state)) r.fail('type', '終端のイベントがありません');
  return r.finish({ tool: 'codex', kind: 'agent-result', result: agentResult(s) });
}

function agentResult(s: CodexState): AgentResult {
  const cause = causeOf(s);
  return { terminal: cause === null ? 'success' : 'error', cause, text: s.output, sessionId: s.sessionId, turns: s.turns, errors: s.errors };
}

function causeOf(s: CodexState): AgentCause | null {
  if (s.streamError) return 'stream_error';
  return s.state === 'failed' ? 'reported_error' : null;
}
