import { fork, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const cases = [
  { name: '0msのHUP重複', signals: ['SIGHUP', 'SIGHUP'], times: [0n, 0n], code: 1 },
  { name: '99msのHUP重複', signals: ['SIGHUP', 'SIGHUP'], times: [0n, 99_000_000n], code: 1 },
  { name: '100msの1ns前のHUP重複', signals: ['SIGHUP', 'SIGHUP'], times: [0n, 99_999_999n], code: 1 },
  { name: '100msちょうどのHUP', signals: ['SIGHUP', 'SIGHUP'], times: [0n, 100_000_000n], code: 129 },
  { name: '99msの重複で始点を延長しない', signals: ['SIGHUP', 'SIGHUP', 'SIGHUP'], times: [0n, 99_000_000n, 100_000_000n], code: 129 },
  { name: 'HUPの直後のTERM', signals: ['SIGHUP', 'SIGTERM'], times: [0n, 0n], code: 143 },
  { name: 'TERMの直後のHUP', signals: ['SIGTERM', 'SIGHUP'], times: [0n, 0n], code: 129 },
  { name: 'INTの直後のINT', signals: ['SIGINT', 'SIGINT'], times: [0n, 0n], code: 130 },
] as const;

it.each(cases)('[REQ-427] $nameを固定した単調時計で判定する', async ({ signals, times, code }) => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-duplicate-hangup-'));
  let child: ChildProcess | undefined;
  let watchdog: NodeJS.Timeout | undefined;
  try {
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    const source = readFileSync(new URL('../src/cli.ts', import.meta.url), 'utf8');
    writeFileSync(join(root, 'cli.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    // mainのimportは製品listenerの登録より先。時計だけを差し替え、受信とabortは同期ファイルへ記録する。
    writeFileSync(join(root, 'main.js'), `import { writeFileSync } from 'node:fs';
let now = 0n;
process.hrtime.bigint = () => now;
const events = [];
const save = () => writeFileSync(new URL('./events.json', import.meta.url), JSON.stringify(events));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
  events.push({ signal, at: now.toString() }); save();
});
export function main(args, io) {
  io.signal.addEventListener('abort', () => { events.push({ aborted: io.signal.aborted }); save(); }, {once:true});
  return new Promise(resolve => {
    process.on('message', message => {
      if (message.finish) {
        process.removeAllListeners('message'); process.disconnect(); resolve(1); return;
      }
      now = BigInt(message.at); process.emit(message.signal);
      process.send({ phase: 'handled', id: message.id });
    });
    process.send({ phase: 'ready' });
  });
}`);
    child = fork(join(root, 'cli.mjs'), ['run'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const messages: { phase: string; id?: number }[] = [];
    let stderr = '';
    child.stderr!.on('data', data => { stderr += String(data); });
    child.on('message', (message: { phase: string; id?: number }) => { messages.push(message); });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.once('exit', (exitCode, signal) => resolve({ code: exitCode, signal })));
    const ready = new Promise<void>(resolve => child!.on('message', (message: { phase: string }) => { if (message.phase === 'ready') resolve(); }));
    const exercise = (async () => {
      await ready;
      for (let id = 0; id < signals.length; id++) {
        const handled = new Promise<'handled'>(resolve => {
          const listener = (message: { phase: string; id?: number }) => {
            if (message.phase === 'handled' && message.id === id) { child!.off('message', listener); resolve('handled'); }
          };
          child!.on('message', listener);
        });
        // 疑似時刻と信号を同じIPCで渡し、全OSで同じ製品listenerを実行する。
        child!.send({ id, signal: signals[id], at: times[id]!.toString() });
        const response = await Promise.race([handled, exited]);
        if (response !== 'handled') return response;
      }
      child!.send({ finish: true });
      return exited;
    })();
    const result = await Promise.race([
      exercise,
      new Promise<{ watchdog: true }>(resolve => { watchdog = setTimeout(() => resolve({ watchdog: true }), 2000); }),
    ]);
    expect(result, stderr).toEqual({ code, signal: null });
    expect(JSON.parse(readFileSync(join(root, 'events.json'), 'utf8'))).toEqual([
      { signal: signals[0], at: times[0].toString() },
      { aborted: true },
      ...signals.slice(1).map((signal, index) => ({ signal, at: times[index + 1]!.toString() })),
    ]);
    expect(messages[0]).toEqual({ phase: 'ready' });
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
