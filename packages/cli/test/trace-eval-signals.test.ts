import { fork, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { setTimeout } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { fixture, git } from '../../trace/test/quality-eval-fixtures.js';
import { EVAL_LOCK } from '../../trace/src/quality-files.js';

vi.setConfig({ testTimeout: 15_000 });
it('[REQ-434][REQ-440][REQ-441] 実CLIの初回取消と二重信号による残存lockを手動回収する', async () => {
  for (const double of [false, true]) {
    const f = fixture();
    const original = f.read('quality-command.cjs');
    writeFileSync(join(f.root, 'quality-command.cjs'), `require('node:fs').writeFileSync('.loomake/started','ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,300);${original}`);
    git(f.root, 'add', '.'); git(f.root, 'commit', '-q', '-m', 'signal fixture');
    const bootstrap = join(f.root, '.loomake/entry.mjs');
    // IPC delivers to the unmodified product signal listeners on all OS, including Windows.
    const entry = new URL('../dist/cli.js', import.meta.url).href;
    writeFileSync(bootstrap, `process.on('message',signal=>process.emit(signal));await import(${JSON.stringify(entry)});process.disconnect();`);
    let child: ChildProcess | undefined;
    try {
      child = fork(bootstrap, ['trace', 'eval'], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      let stderr = ''; child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });
      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child?.once('exit', (code, signal) => resolve({ code, signal })));
      const deadline = Date.now() + 5000;
      while (!existsSync(join(f.root, '.loomake/started')) && child.exitCode === null && Date.now() < deadline) await setTimeout(5);
      expect(existsSync(join(f.root, '.loomake/started')), stderr).toBe(true);
      child.send('SIGINT'); if (double) child.send('SIGTERM');
      const result = await Promise.race([exited, setTimeout(5000, { watchdog: true })]);
      expect(result, stderr).toEqual({ code: double ? 143 : 3, signal: null });
      expect(existsSync(join(f.root, EVAL_LOCK))).toBe(double);
      const id = f.storage().ledgers.requests[0].requestId;
      if (double) {
        expect(f.storage().ledgers.requests.at(-1)?.event).toBe('started'); expect(f.storage().ledgers.history).toEqual([]);
        const bytes = readFileSync(join(f.root, EVAL_LOCK)); expect(await f.evaluate()).toBe(3); expect(readFileSync(join(f.root, EVAL_LOCK))).toEqual(bytes);
        rmSync(join(f.root, EVAL_LOCK)); expect(await f.evaluate()).toBe(0);
        expect(f.storage().ledgers.attempts[0]).toMatchObject({ failure: 'crashed', endedAt: null });
        expect(f.storage().ledgers.states.get(id)?.last.event).toBe('reevaluated');
      } else expect(f.storage().ledgers.states.get(id)?.state).toBe('cancelled');
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exit = new Promise((resolve) => child?.once('exit', resolve)); child.kill('SIGKILL'); await exit;
      }
    }
  }
});
