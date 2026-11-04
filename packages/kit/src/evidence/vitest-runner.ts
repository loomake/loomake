import {
  attemptChannel, installAttemptReader, newAttempt, readMethod, registerAttemptFinished,
  type AttemptChannel, type AttemptToken, type Method,
} from './vitest-attempt.js';
import { isPromise } from 'node:util/types';

type Constructor = new (...args: never[]) => object;
type RuntimeConstructor = new (...args: unknown[]) => object;
const COMPOSED = Symbol.for('loomake.body.runner.composed.v1');
const constructors = new WeakMap<object, object>();

function replaceMethod(instance: object, name: string, method: Method): void {
  try { Object.defineProperty(instance, name, { value: method, writable: true, configurable: true }); }
  catch { /* Preserve a Base's non-writable method instead of failing its constructor. */ }
}

function settle(value: unknown, token: AttemptToken | undefined): unknown {
  if (isPromise(value)) return closeAfterPromise(value, token);
  let then: Method | undefined;
  try { then = readMethod(value, 'then'); }
  catch (error) { token?.close(); throw error; }
  if (!then) { token?.close(); return value; }
  // Assimilate the captured then once, preserving asynchronous values and errors.
  const pending = Promise.resolve().then(() => new Promise<unknown>((resolve, reject) => { then.call(value, resolve, reject); }));
  return pending.finally(() => token?.close());
}

async function closeAfterPromise(value: Promise<unknown>, token: AttemptToken | undefined): Promise<unknown> {
  try { return await value; } finally { token?.close(); }
}

function invokeInAttempt(channel: AttemptChannel, task: unknown, invoke: () => unknown): unknown {
  let nested = false;
  try { const active = channel.getStore(); nested = !!active && active.task === task && active.open; }
  catch { /* An unreadable foreign token is not evidence for this callback. */ }
  if (nested) return invoke();
  const token = newAttempt(task);
  return channel.run(token, () => {
    if (token) registerAttemptFinished(task, token);
    try { return settle(invoke(), token); }
    catch (error) { token?.close(); throw error; }
  });
}

/**
 * Compose the caller's public Vitest runner without importing Vitest at runtime.
 *
 * @example
 * // runner.ts
 * import { TestRunner } from 'vitest';
 * import { createBodyRunner } from '@loomake/kit';
 * export default createBodyRunner(TestRunner);
 * // vitest.config.ts: test: { runner: './runner.ts' }
 * // Pass your existing runner as Base when you already use a custom runner.
 */
export function createBodyRunner<Base extends Constructor>(Base: Base): Base {
  try { if (Object.hasOwn(Base, COMPOSED) && Reflect.get(Base, COMPOSED) === Base) return Base; }
  catch { /* Do not require readable metadata on a supplied constructor. */ }
  const cached = constructors.get(Base);
  if (cached) return cached as Base;
  // The erasure stays local; the public return preserves Base's exact constructor and instance type.
  const RuntimeBase = Base as unknown as RuntimeConstructor;
  class BodyRunner extends RuntimeBase {
    constructor(...args: unknown[]) {
      super(...args);
      const channel = attemptChannel(this);
      try {
        const originalContext = readMethod(this, 'extendTaskContext');
        replaceMethod(this, 'extendTaskContext', function (context) {
          const result = originalContext?.call(this, context);
          installAttemptReader(result || context, channel);
          return result;
        });
      } catch { /* Leave a Base's unreadable hook on its original execution path. */ }
      try {
        const originalRun = readMethod(this, 'runTask');
        replaceMethod(this, 'runTask', function (task) {
          return invokeInAttempt(channel, task, () => {
            if (originalRun) return originalRun.call(this, task);
            const fn = readMethod(Base, 'getTestFn')?.call(Base, task);
            if (typeof fn !== 'function') throw new Error('テスト関数が見つかりません。Vitestへテスト本体を登録してください。');
            return (fn as Method)();
          });
        });
      } catch { /* Preserve a Base getter failure until the host reads that hook. */ }
    }
  }
  Object.defineProperty(BodyRunner, COMPOSED, { value: BodyRunner });
  constructors.set(Base, BodyRunner);
  return BodyRunner as unknown as Base;
}
