import { it, expect } from 'vitest';
import { createBodyRunner } from '@loomake/kit';
import { readBodyAttempt, BODY_ATTEMPT_READER, type AttemptToken } from '../src/evidence/vitest-attempt.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { withProject } from './project.js';

type Task = {
  result: { repeatCount: number; retryCount: number };
  context: Context;
};
type Context = { task: Task; onTestFinished(callback: () => void): void };
function taskContext() {
  const finished: (() => void)[] = [];
  const task = { result: { repeatCount: 2, retryCount: 3 } } as Task;
  task.context = { task, onTestFinished(callback) { finished.push(callback); } };
  return { task, finished };
}
function deferred() {
  let resolve: (value: object) => void = () => { throw new Error('uninitialized'); };
  let reject: (error: unknown) => void = () => { throw new Error('uninitialized'); };
  const promise = new Promise<object>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it('[REQ-393] public runner preserves constructor arguments and delegates standard wrapped callback once', async () => {
  const { task } = taskContext();
  let calls = 0, accessorCalls = 0;
  let token: AttemptToken | undefined;
  const pending = deferred(), result = {};
  class StandardBase {
    static literal = 'retained' as const;
    constructor(readonly label: string, readonly second: number) {}
    extendTaskContext(ctx: Context) { expect(this.label).toBe('base'); return ctx; }
    static getTestFn(received: Task) {
      accessorCalls++; expect(this).toBe(StandardBase); expect(received).toBe(task);
      return () => { calls++; token = readBodyAttempt(task); return pending.promise; };
    }
  }
  const Runner = createBodyRunner(StandardBase);
  const runner = new Runner('base', 8);
  expect(runner).toBeInstanceOf(StandardBase);
  expect([runner.label, runner.second, Runner.literal]).toEqual(['base', 8, 'retained']);
  expect(runner.extendTaskContext(task.context)).toBe(task.context);
  const run = (runner as StandardBase & { runTask(task: Task): Promise<object> }).runTask(task);
  expect(calls).toBe(1); expect(accessorCalls).toBe(1);
  expect(token).toMatchObject({ task, repeat: 2, retry: 3, open: true });
  task.result.repeatCount = 9; task.result.retryCount = 10;
  expect([token?.repeat, token?.retry]).toEqual([2, 3]);
  pending.resolve(result);
  expect(await run).toBe(result); expect(token?.open).toBe(false);
  expect(Object.getOwnPropertyDescriptor(task.context, BODY_ATTEMPT_READER)?.enumerable).toBe(false);
  const reader = Reflect.get(task.context, BODY_ATTEMPT_READER);
  runner.extendTaskContext(task.context);
  expect(Reflect.get(task.context, BODY_ATTEMPT_READER)).toBe(reader);
});

for (const own of [false, true]) {
  it(`[REQ-393] ${own ? 'own fields' : 'prototype methods'} retain receiver, context replacement, values and exceptions`, async () => {
    const { task } = taskContext();
    const context = { ...task.context }, returned = {}, originalError = new Error('original');
    let taskCalls = 0, contextCalls = 0, fail = false;
    let token: AttemptToken | undefined;
    class Base {
      #label: string;
      constructor(label: string) {
        this.#label = label;
        if (own) {
          this.runTask = received => this.perform(received);
          this.extendTaskContext = received => this.extend(received);
        }
      }
      perform(received: Task) {
        expect(this.#label).toBe('receiver'); expect(received).toBe(task); taskCalls++;
        token = readBodyAttempt(task);
        if (fail) throw originalError;
        return returned;
      }
      extend(received: Context) {
        expect(this.#label).toBe('receiver'); expect(received).toBe(task.context); contextCalls++;
        return context;
      }
      runTask(received: Task) { return this.perform(received); }
      extendTaskContext(received: Context) { return this.extend(received); }
    }
    const runner = new (createBodyRunner(Base))('receiver');
    expect(runner.extendTaskContext(task.context)).toBe(context);
    task.context = context;
    expect(runner.runTask(task)).toBe(returned);
    expect(token).toBeDefined(); expect(token?.open).toBe(false);
    fail = true;
    let seen: unknown;
    try { runner.runTask(task); } catch (error) { seen = error; }
    expect(seen).toBe(originalError);
    expect(taskCalls).toBe(2); expect(contextCalls).toBe(1); expect(token?.open).toBe(false);
    await Promise.resolve();
  });
}

it('[REQ-393] async rejection preserves original error and finished independently closes an active token', async () => {
  const { task, finished } = taskContext(), pending = deferred();
  const original = new Error('same rejection');
  let token: AttemptToken | undefined, calls = 0;
  class Base {
    extendTaskContext(ctx: Context) { return ctx; }
    runTask(received: Task) { calls++; token = readBodyAttempt(received); return pending.promise; }
  }
  const runner = new (createBodyRunner(Base))();
  runner.extendTaskContext(task.context);
  const run = runner.runTask(task);
  expect(token?.open).toBe(true); expect(finished).toHaveLength(1);
  finished[0](); expect(token?.open).toBe(false);
  pending.reject(original);
  await expect(run).rejects.toBe(original);
  expect(calls).toBe(1); expect(token?.open).toBe(false);
});

it('[REQ-393] repeated composition keeps constructor identity and rewraps a derived own-field override', () => {
  const { task } = taskContext();
  let baseCalls = 0, derivedCalls = 0, token: AttemptToken | undefined;
  class Base {
    extendTaskContext(ctx: Context) { return ctx; }
    runTask(received: Task) { expect(received).toBe(task); baseCalls++; return 7; }
  }
  const Wrapped = createBodyRunner(Base);
  expect(createBodyRunner(Base)).toBe(Wrapped);
  expect(createBodyRunner(Wrapped)).toBe(Wrapped);
  class Derived extends Wrapped {
    override runTask = (received: Task) => { derivedCalls++; token = readBodyAttempt(received); return 9; };
  }
  const DerivedRunner = createBodyRunner(Derived);
  expect(DerivedRunner).not.toBe(Derived);
  const runner = new DerivedRunner();
  runner.extendTaskContext(task.context);
  expect(runner.runTask(task)).toBe(9);
  expect(derivedCalls).toBe(1); expect(baseCalls).toBe(0);
  expect(token).toBeDefined(); expect(token?.open).toBe(false);
});

it('[REQ-393] nested composition shares the original token throughout custom Base cleanup', async () => {
  const { task } = taskContext(), cleanup = deferred();
  let callbackCalls = 0, cleanupCalls = 0, markCleanup: () => void = () => {};
  const cleanupStarted = new Promise<void>(resolve => { markCleanup = resolve; });
  let callbackToken: AttemptToken | undefined, cleanupToken: AttemptToken | undefined;
  class Original {
    extendTaskContext(ctx: Context) { return ctx; }
    async runTask(received: Task) { callbackCalls++; callbackToken = readBodyAttempt(received); await Promise.resolve(); return 4; }
  }
  const Inner = createBodyRunner(Original);
  class WithCleanup extends Inner {
    override async runTask(received: Task) {
      try { return await super.runTask(received); }
      finally {
        cleanupCalls++; cleanupToken = readBodyAttempt(received); markCleanup();
        await cleanup.promise;
        expect(readBodyAttempt(received)).toBe(callbackToken);
      }
    }
  }
  // The actual Vitest runTask contract is async; keep this construction's original type.
  const runner = new (createBodyRunner(WithCleanup))();
  runner.extendTaskContext(task.context);
  const run = runner.runTask(task);
  await cleanupStarted;
  expect(callbackToken).toBeDefined(); expect(cleanupToken).toBe(callbackToken);
  expect(callbackToken?.open).toBe(true);
  cleanup.resolve({}); expect(await run).toBe(4);
  expect(callbackToken?.open).toBe(false);
  expect([callbackCalls, cleanupCalls]).toEqual([1, 1]);
});

it('[REQ-393] reader failures and incompatible symbols preserve the Base hook and callback', () => {
  for (const kind of ['frozen', 'collision', 'proxy', 'throwing-reader']) {
    const { task } = taskContext(); let calls = 0, extensions = 0, readerCalls = 0;
    const collision = kind === 'throwing-reader' ? () => { readerCalls++; throw new Error('reader failed'); } : 'incompatible';
    if (typeof collision === 'function') Object.defineProperty(collision, Symbol.for('loomake.body.attempt.reader.v1'), { value: 1 });
    if (kind === 'collision' || kind === 'throwing-reader') Object.defineProperty(task.context, BODY_ATTEMPT_READER, { value: collision });
    const effective = kind === 'frozen' ? Object.freeze(task.context) : kind === 'proxy' ? new Proxy(task.context, {
      defineProperty() { throw new Error('reader definition failed'); },
    }) : task.context;
    class Base {
      extendTaskContext() { extensions++; return effective; }
      runTask(received: Task) { calls++; expect(received).toBe(task); expect(readBodyAttempt(task)).toBeUndefined(); return 12; }
    }
    const runner = new (createBodyRunner(Base))();
    expect(runner.extendTaskContext()).toBe(effective); task.context = effective;
    expect(runner.runTask(task)).toBe(12);
    expect([calls, extensions]).toEqual([1, 1]);
    expect(readerCalls).toBe(kind === 'throwing-reader' ? 1 : 0);
    if (kind === 'collision' || kind === 'throwing-reader') expect(Reflect.get(task.context, BODY_ATTEMPT_READER)).toBe(collision);
  }
});

it('[REQ-393] original context hook exceptions and missing function failure remain failures', () => {
  const original = new Error('original context failure');
  class BrokenContext { extendTaskContext() { throw original; } }
  let seen: unknown;
  try { new (createBodyRunner(BrokenContext))().extendTaskContext(); } catch (error) { seen = error; }
  expect(seen).toBe(original);
  class Missing {
    static getTestFn() { return undefined; }
  }
  const missing = new (createBodyRunner(Missing))() as Missing & { runTask(task: unknown): unknown };
  expect(() => missing.runTask({})).toThrow('テスト関数が見つかりません');
});

it('[REQ-393] an undefined context-hook result stays undefined while its effective context receives the reader', () => {
  const { task } = taskContext(); let extensions = 0, token: AttemptToken | undefined;
  class Base {
    extendTaskContext(received: Context): undefined { expect(received).toBe(task.context); extensions++; return undefined; }
    runTask(received: Task) { token = readBodyAttempt(received); return 6; }
  }
  const runner = new (createBodyRunner(Base))();
  expect(runner.extendTaskContext(task.context)).toBeUndefined();
  expect(runner.runTask(task)).toBe(6); expect(token).toBeDefined(); expect(token?.open).toBe(false); expect(extensions).toBe(1);
});

it('[REQ-393] invalid attempt counters cannot create evidence and keep callback results', () => {
  const { task } = taskContext();
  task.result.retryCount = -1;
  let calls = 0;
  class Base {
    extendTaskContext(ctx: Context) { return ctx; }
    runTask(received: Task) { calls++; expect(received).toBe(task); expect(readBodyAttempt(task)).toBeUndefined(); return 1; }
  }
  const runner = new (createBodyRunner(Base))(); runner.extendTaskContext(task.context);
  expect(runner.runTask(task)).toBe(1); expect(calls).toBe(1);
});

it('[REQ-393] thenable getters and methods run once and preserve original failure identity', async () => {
  for (const failure of ['none', 'getter', 'method']) {
    const { task } = taskContext(), original = new Error('original then getter');
    let getters = 0, thenCalls = 0, callbackCalls = 0, token: AttemptToken | undefined;
    const result = {};
    const value = { get then() {
      getters++;
      if (failure === 'getter') throw original;
      return function (this: unknown, resolve: (value: object) => void) {
        expect(this).toBe(value); thenCalls++;
        if (failure === 'method') throw original;
        resolve(result);
      };
    } };
    class Base {
      extendTaskContext(ctx: Context) { return ctx; }
      runTask(received: Task): unknown { callbackCalls++; token = readBodyAttempt(received); return value; }
    }
    const runner = new (createBodyRunner(Base))(); runner.extendTaskContext(task.context);
    if (failure === 'getter') {
      let seen: unknown;
      try { runner.runTask(task); } catch (error) { seen = error; }
      expect(seen).toBe(original); expect(thenCalls).toBe(0);
    } else if (failure === 'method') {
      await expect(runner.runTask(task)).rejects.toBe(original); expect(thenCalls).toBe(1);
    } else {
      expect(await runner.runTask(task)).toBe(result); expect(thenCalls).toBe(1);
    }
    expect(getters).toBe(1); expect(callbackCalls).toBe(1); expect(token?.open).toBe(false);
  }
});

it('[REQ-393] native Promise await bypasses its own then getter and retains rejection identity', async () => {
  for (const fail of [false, true]) {
    const { task } = taskContext(), pending = deferred(), original = new Error('native rejection');
    let getterCalls = 0, callbackCalls = 0, token: AttemptToken | undefined;
    void Object.defineProperty(pending.promise, 'then', { get() { getterCalls++; throw new Error('must not read own then'); } });
    class Base {
      extendTaskContext(ctx: Context) { return ctx; }
      runTask(received: Task) { callbackCalls++; token = readBodyAttempt(received); return pending.promise; }
    }
    const runner = new (createBodyRunner(Base))(); runner.extendTaskContext(task.context);
    const run = runner.runTask(task), result = {};
    if (fail) { pending.reject(original); await expect(run).rejects.toBe(original); }
    else { pending.resolve(result); expect(await run).toBe(result); }
    expect(callbackCalls).toBe(1); expect(getterCalls).toBe(0); expect(token?.open).toBe(false);
  }
});

it('[REQ-393] public TestRunner composes in an actual isolated Vitest consumer', { timeout: 60_000 }, () => {
  const api = pathToFileURL(join(import.meta.dirname, '../src/index.ts')).href;
  const bin = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
  withProject({ quality: true, files: {
    'runner.mjs': `import { TestRunner } from 'vitest';import { createBodyRunner } from ${JSON.stringify(api)};export default createBodyRunner(TestRunner);`,
    'vitest.config.mjs': "export default { test: { runner: './runner.mjs' } };",
    'runner.test.mjs': `import { it, expect } from 'vitest';
it('[REQ-393] token survives await and closes after native callback', async ctx => {
 const read=ctx.task.context[Symbol.for('loomake.body.attempt.v1')];
 const original=read();expect(original.task).toBe(ctx.task);expect(original.open).toBe(true);
 await Promise.resolve();expect(read()).toBe(original);expect(original.repeat).toBe(0);expect(original.retry).toBe(0);
 ctx.onTestFinished(()=>expect(original.open).toBe(false));
});
it('[REQ-393] second test receives a different task token', ctx => {
 const token=ctx.task.context[Symbol.for('loomake.body.attempt.v1')]();expect(token.task).toBe(ctx.task);expect(token.open).toBe(true);
});`,
  } }, root => {
    const run = spawnSync(process.execPath, [bin, 'run', 'runner.test.mjs', '--reporter=json', '--outputFile=.loomake/runner-report.json'], {
      cwd: root, encoding: 'utf8', timeout: 45_000,
    });
    expect(run.error).toBeUndefined(); expect(run.signal).toBeNull();
    expect(run.status, run.stdout + run.stderr).toBe(0);
    const report = JSON.parse(readFileSync(join(root, '.loomake/runner-report.json'), 'utf8')) as { numPassedTests: number };
    expect(report.numPassedTests).toBe(2);
  });
});
