import { fork, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const cases = [
  { first: 'SIGINT', second: 'SIGINT', code: 130 },
  { first: 'SIGTERM', second: 'SIGTERM', code: 143 },
  { first: 'SIGHUP', second: 'SIGHUP', code: 129 },
  { first: 'SIGTERM', second: 'SIGHUP', code: 129 },
  { first: 'SIGHUP', second: 'SIGINT', code: 130 },
] as const;

it.each(cases)('[REQ-124][REQ-208][REQ-427] $first の初回abort後に $second で終了コード$codeにする', async ({ first, second, code }) => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-second-signal-'));
  let child: ChildProcess | undefined;
  let watchdog: NodeJS.Timeout | undefined;
  try {
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    // 製品の cli.ts そのものを型だけ除いて実行する。main は停止処理が完了しない状態を作る。
    const source = readFileSync(new URL('../src/cli.ts', import.meta.url), 'utf8');
    writeFileSync(join(root, 'cli.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    writeFileSync(join(root, 'main.js'), `export function main(args, io) {
  io.signal.addEventListener('abort', () => process.send({ phase: 'aborted', aborted: io.signal.aborted }), {once:true});
  process.on('message', signal => process.emit(signal));
  process.send({ phase: 'ready' });
  setInterval(() => {}, 1000);
  return new Promise(() => {});
}`);
    child = fork(join(root, 'cli.mjs'), ['run'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const events: unknown[] = [];
    let stderr = '';
    child.stderr!.on('data', data => { stderr += String(data); });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.once('exit', (exitCode, signal) => resolve({ code: exitCode, signal })));
    const signal = (value: NodeJS.Signals) => {
      // Windows の process.kill はハンドラーを経由しないため、同じ製品リスナーへ IPC で配送する。
      if (process.platform === 'win32') child!.send(value);
      else child!.kill(value);
    };
    child.on('message', (message: { phase: string; aborted?: boolean }) => {
      events.push(message);
      if (message.phase === 'ready') signal(first);
      if (message.phase === 'aborted') signal(second);
    });
    const result = await Promise.race([
      exited,
      new Promise<{ watchdog: true }>(resolve => { watchdog = setTimeout(() => resolve({ watchdog: true }), 2000); }),
    ]);
    expect(result, stderr).toEqual({ code, signal: null });
    expect(events).toEqual([{ phase: 'ready' }, { phase: 'aborted', aborted: true }]);
    expect(stderr).toBe('');
  } finally {
    clearTimeout(watchdog);
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = new Promise(resolve => child!.once('exit', resolve));
      child.kill('SIGKILL'); await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
