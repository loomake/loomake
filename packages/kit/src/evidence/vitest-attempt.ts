import { AsyncLocalStorage } from 'node:async_hooks';

export const BODY_ATTEMPT_READER = Symbol.for('loomake.body.attempt.v1');
const READER_PROTOCOL = Symbol.for('loomake.body.attempt.reader.v1');
const RUNNER_CHANNEL = Symbol.for('loomake.body.runner.channel.v1');
export type AttemptToken = {
  readonly version: 1;
  readonly task: object;
  readonly repeat: number;
  readonly retry: number;
  readonly open: boolean;
  close(): void;
};
export type AttemptChannel = AsyncLocalStorage<AttemptToken | undefined>;
export type Method = (this: unknown, ...args: unknown[]) => unknown;

function objectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function readProperty(value: unknown, key: PropertyKey): unknown {
  return objectLike(value) ? Reflect.get(value, key) : undefined;
}

export function readMethod(value: unknown, key: PropertyKey): Method | undefined {
  const method = readProperty(value, key);
  return typeof method === 'function' ? method as Method : undefined;
}

export function attemptChannel(runner: object): AttemptChannel {
  try {
    const channel = readProperty(runner, RUNNER_CHANNEL);
    if (channel instanceof AsyncLocalStorage) return channel as AttemptChannel;
  } catch { /* A Base property cannot prevent its callback from running. */ }
  const channel: AttemptChannel = new AsyncLocalStorage();
  try { Object.defineProperty(runner, RUNNER_CHANNEL, { value: channel }); }
  catch { /* A closed or frozen Base can still retain its original behavior. */ }
  return channel;
}

export function installAttemptReader(context: unknown, channel: AttemptChannel): void {
  if (!objectLike(context)) return;
  try {
    if (BODY_ATTEMPT_READER in context) return;
    const reader = () => channel.getStore();
    Object.defineProperty(reader, READER_PROTOCOL, { value: 1 });
    Object.defineProperty(context, BODY_ATTEMPT_READER, { value: reader });
  } catch { /* Missing evidence must not fail the host's context extension. */ }
}

export function readBodyAttempt(task: object): AttemptToken | undefined {
  try {
    const context = readProperty(task, 'context');
    const reader = readMethod(context, BODY_ATTEMPT_READER);
    if (!reader || readProperty(reader, READER_PROTOCOL) !== 1) return;
    const value = reader.call(context);
    if (readProperty(value, 'version') !== 1 || readProperty(value, 'task') !== task || readProperty(value, 'open') !== true) return;
    const repeat = readProperty(value, 'repeat'), retry = readProperty(value, 'retry');
    if (typeof repeat !== 'number' || !Number.isSafeInteger(repeat) || repeat < 0) return;
    if (typeof retry !== 'number' || !Number.isSafeInteger(retry) || retry < 0 || !readMethod(value, 'close')) return;
    return value as AttemptToken;
  } catch { return; }
}

export function newAttempt(task: unknown): AttemptToken | undefined {
  try {
    if (!objectLike(task)) return;
    const result = readProperty(task, 'result');
    const repeat = readProperty(result, 'repeatCount'), retry = readProperty(result, 'retryCount');
    if (typeof repeat !== 'number' || !Number.isSafeInteger(repeat) || repeat < 0) return;
    if (typeof retry !== 'number' || !Number.isSafeInteger(retry) || retry < 0) return;
    let closed = false;
    return Object.freeze({ version: 1 as const, task, repeat, retry, get open() { return !closed; }, close() { closed = true; } });
  } catch { return; }
}

export function registerAttemptFinished(task: unknown, token: AttemptToken): void {
  try {
    const context = readProperty(task, 'context');
    readMethod(context, 'onTestFinished')?.call(context, () => token.close());
  } catch { /* Delegation settlement remains an independent closing boundary. */ }
}
