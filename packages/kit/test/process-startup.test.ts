import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProcessLimitError, runExternal, withProcessBudget } from '../src/process.js';

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch (error) {
    if (['ESRCH', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

function cleanupTarget(target: string) {
  if (!existsSync(target)) return;
  const pid = Number(readFileSync(target, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0 || !running(pid)) return;
  try { process.kill(pid, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}

function fixture(delay: number, action: (value: { dir: string; env: NodeJS.ProcessEnv; target: string; boot: string }) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-supervisor-startup '));
  const target = join(dir, 'target-pid');
  const boot = join(dir, 'supervisor-boot');
  const preload = join(dir, 'delay.cjs');
  writeFileSync(preload, `if (process.argv[1]?.endsWith('supervisor.cjs')) {
    const fs = require('node:fs');
    fs.appendFileSync(${JSON.stringify(boot)}, 'started\\n');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${delay});
    fs.appendFileSync(${JSON.stringify(boot)}, 'finished\\n');
  }`);
  // Delay only the actual supervisor; the target keeps the same environment.
  const env = { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` };
  try { action({ dir, env, target, boot }); }
  finally {
    cleanupTarget(target);
    rmSync(dir, { recursive: true, force: true });
  }
}

const startedTarget = (target: string, tail: string) => `require('node:fs').writeFileSync(${JSON.stringify(target)}, String(process.pid));${tail}`;

describe('supervisor startup consumes the external operation budget', () => {
  it('[REQ-180][REQ-183] preserves an ordinary result after supervisor startup', () => fixture(50, ({ dir, env, target, boot }) => {
    const result = runExternal(process.execPath, ['-e', startedTarget(target, 'console.log("out");console.error("err");process.exit(7)')], { cwd: dir, env, timeoutMs: 3000 });
    expect(readFileSync(boot, 'utf8')).toBe('started\nfinished\n');
    expect(existsSync(target)).toBe(true);
    expect(result).toMatchObject({ status: 7, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.error).toBeUndefined();
  }));

  it.each(['operation', 'shared'] as const)('[REQ-180][REQ-182] refuses to start the target when %s time expires during boot', (kind) => fixture(600, ({ dir, env, target, boot }) => {
    const call = () => runExternal(process.execPath, ['-e', startedTarget(target, '')], { cwd: dir, env, ...(kind === 'operation' ? { timeoutMs: 150 } : {}) });
    let error: unknown;
    try { if (kind === 'shared') withProcessBudget({ timeoutMs: 150 }, call); else call(); }
    catch (caught) { error = caught; }
    expect(readFileSync(boot, 'utf8')).toBe('started\nfinished\n');
    expect(error).toBeInstanceOf(ProcessLimitError);
    expect((error as ProcessLimitError).kind).toBe('timeout');
    expect(existsSync(target)).toBe(false);
  }));

  it('[REQ-180][REQ-181][REQ-182] uses only the remaining shared time and stops a started target', () => fixture(1000, ({ dir, env, target, boot }) => {
    let error: unknown;
    try {
      withProcessBudget({ timeoutMs: 4000, maxOperationMs: 100 }, () => runExternal(process.execPath, ['-e', startedTarget(target, 'process.on("SIGTERM",()=>{});setTimeout(()=>process.exit(0),3500)')], { cwd: dir, env, untilDeadline: true }));
    } catch (caught) { error = caught; }
    expect(readFileSync(boot, 'utf8')).toBe('started\nfinished\n');
    expect(existsSync(target)).toBe(true);
    const pid = Number(readFileSync(target, 'utf8'));
    expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
    expect(error).toBeInstanceOf(ProcessLimitError);
    expect((error as ProcessLimitError).kind).toBe('timeout');
    expect(running(pid)).toBe(false);
  }), 10_000);
});
