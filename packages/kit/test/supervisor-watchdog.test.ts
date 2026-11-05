import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProcessLimitError, runExternal, withProcessBudget } from '../src/runtime/process.js';

it('[REQ-428][REQ-250][REQ-180] bounds a stalled supervisor and blocks later shared operations with a reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-watchdog-'));
  try {
    const preload = join(root, 'stall.cjs');
    writeFileSync(preload, `if(process.argv[1]?.endsWith('supervisor.cjs')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,4000);`);
    withProcessBudget({ timeoutMs: 10000 }, () => {
      let first: unknown;
      const started = Date.now();
      try { runExternal(process.execPath, ['-e', ''], { timeoutMs: 100.5, env: { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` } }); } catch (error) { first = error; }
      expect(Date.now() - started).toBeLessThan(3500);
      expect(first).toBeInstanceOf(ProcessLimitError);
      expect(first).toMatchObject({ kind: 'timeout', reason: expect.stringContaining('監視役'), cleanup: undefined });
      let later: unknown;
      try { runExternal(process.execPath, ['-e', 'throw Error("must not start")']); } catch (error) { later = error; }
      expect(later).toMatchObject({ kind: 'interrupted', reason: (first as ProcessLimitError).reason });
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('[REQ-428][REQ-250][REQ-181] cleans a started target when the supervisor stalls after reporting its pid', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-watchdog-target-'));
  try {
    const preload = join(root, 'stall-pid.cjs');
    writeFileSync(preload, `if(process.argv[1]?.endsWith('supervisor.cjs')) {
      const fs=require('node:fs'); const native=fs.writeSync;
      fs.writeSync=function(fd,data,...args) { const result=native.call(this,fd,data,...args);
        if(fd===3 && typeof data==='string' && data.includes('"pid"')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,4000);
        return result; };
    }`);
    let error: unknown;
    try { runExternal(process.execPath, ['-e', 'setTimeout(()=>{},6000)'], { timeoutMs: 1000, env: { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` } }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ProcessLimitError);
    expect(error).toMatchObject({ kind: 'timeout', reason: expect.stringContaining('監視役'), cleanup: expect.objectContaining({ confirmed: true }) });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('[REQ-428][REQ-180][REQ-183] preserves a valid outcome if the supervisor stalls after writing it', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-watchdog-outcome-'));
  try {
    const preload = join(root, 'stall-exit.cjs');
    writeFileSync(preload, `if(process.argv[1]?.endsWith('supervisor.cjs')) process.exit=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,4000);`);
    const result = runExternal(process.execPath, ['-e', 'console.log("out");console.error("err");process.exit(7)'], { timeoutMs: 1000, env: { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` } });
    expect(result).toMatchObject({ status: 7, signal: null, stdout: 'out\n', stderr: 'err\n' });
    expect(result.error).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);
