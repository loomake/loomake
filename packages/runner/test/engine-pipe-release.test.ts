import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runClaude } from '../src/engine.js';

const fixture = vi.hoisted(() => ({ child: undefined as unknown }));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, spawn: () => fixture.child };
});
// POSIX の exit 後の契約も、OS に依存しない擬似ストリームで検査する。
vi.mock('../src/shell.js', () => ({ isWindows: false, quote: (text: string) => text }));
afterEach(() => { vi.useRealTimers(); });

function fakeChild() {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  let exited = false;
  let closed = false;
  let code: number | null = null;
  const close = () => {
    if (!closed && exited && child.stdout.destroyed && child.stderr.destroyed) {
      closed = true; child.emit('close', code);
    }
  };
  child.once('exit', (value: number | null) => { exited = true; code = value; close(); });
  child.stdout.on('close', close); child.stderr.on('close', close);
  fixture.child = child;
  return child;
}

describe('エンジンの出力読み取りの猶予', () => {
  it.each(['normal', 'timeout', 'abort', 'output-limit'] as const)('[REQ-139][REQ-212] %s の後に保持された出力を有界化し判定を保つ', async (mode) => {
    vi.useFakeTimers();
    const child = fakeChild();
    const controller = new AbortController();
    let completed = false;
    const pending = runClaude({ cwd: '.', env: {}, prompt: 'test', commands: [], skipPermissions: false, timeoutMs: 1000, signal: controller.signal, maxOutputBytes: 100, onStderr: () => {} });
    void pending.then(() => { completed = true; });
    child.stdout.write('normal output');
    if (mode === 'normal') child.emit('exit', 0);
    if (mode === 'abort') { controller.abort(); child.emit('exit', null); }
    if (mode === 'timeout') { await vi.advanceTimersByTimeAsync(1000); child.emit('exit', null); }
    if (mode === 'output-limit') { child.stderr.write('x'.repeat(101)); child.emit('exit', null); }
    await vi.advanceTimersByTimeAsync(249);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(251);
    expect(child.stdout.destroyed).toBe(true);
    expect(child.stderr.destroyed).toBe(true);
    expect(completed).toBe(true);
    const result = await pending;
    expect(result.timedOut).toBe(mode === 'timeout');
    expect(result.aborted).toBe(mode === 'abort');
    expect(result.outputLimitExceeded).toBe(mode === 'output-limit');
    expect(result.raw).toBe('normal output');
    expect(result.exitCode).toBe(mode === 'normal' ? 0 : null);
  });

  it('[REQ-212] exit後の猶予中に期限とabortが届いても正常結果を保つ', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const controller = new AbortController();
    const pending = runClaude({ cwd: '.', env: {}, prompt: '', commands: [], skipPermissions: false, timeoutMs: 10, signal: controller.signal });
    child.stdout.write('{"result":"ok"}'); child.emit('exit', 0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toMatchObject({ exitCode: 0, text: 'ok', timedOut: false, aborted: false });
  });
});
