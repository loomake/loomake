import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';

const supervisor = join(import.meta.dirname, '../supervisor/supervisor.cjs');
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
    if (process.platform === 'darwin') return !/^Z/.test(execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    return true;
  } catch { return false; }
}
async function waitFor(check: () => boolean, ms: number) {
  const until = Date.now() + ms;
  while (!check()) { if (Date.now() >= until) return false; await delay(10); }
  return true;
}
async function withSupervisor(action: (context: { child: ReturnType<typeof spawn>; closed: Promise<[number | null, NodeJS.Signals | null]>; ready: () => boolean; pids: () => number[]; report: () => string }) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-supervisor-'));
  const readyFile = join(dir, 'pids.json');
  const leafFile = join(dir, 'leaf');
  const leaf = `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(leafFile)},String(process.pid));setInterval(()=>{},100)`;
  const code = `const fs=require('node:fs');process.on('SIGTERM',()=>{});const leaf=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore'});const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(leafFile)})){clearInterval(timer);fs.writeFileSync(${JSON.stringify(readyFile)},JSON.stringify([process.pid,leaf.pid]));}},10);setInterval(()=>{},100)`;
  const deadline = Number(process.hrtime.bigint()) / 1_000_000 + 10_000;
  const child = spawn(process.execPath, [supervisor, JSON.stringify([process.execPath, ['-e', code], false, deadline, 1024 * 1024])], { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close') as Promise<[number | null, NodeJS.Signals | null]>;
  let report = '';
  child.stdio[3]!.on('data', (data) => { report += data; });
  child.stdout!.resume(); child.stderr!.resume();
  const pids = () => existsSync(readyFile) ? JSON.parse(readFileSync(readyFile, 'utf8')) as number[] : [];
  try { await action({ child, closed, ready: () => pids().length === 2 && /"pid":/.test(report), pids, report: () => report }); }
  finally {
    const [pid] = pids();
    if (pid) { try { process.kill(-pid, 'SIGKILL'); } catch { /* 対象はすでに停止済み */ } }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.runIf(process.platform !== 'win32')('監視役自身によるPOSIXの後片付け', () => {
  it('[REQ-333] 親の後片付けなしでもSIGHUPでSIGTERMを無視する子孫を止め、中断の結果を書く', async () => {
    await withSupervisor(async ({ child, closed, ready, pids, report }) => {
      expect(await waitFor(ready, 3000)).toBe(true);
      expect(child.kill('SIGHUP')).toBe(true);
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
      expect(await closed).toEqual([0, null]);
      const outcome = JSON.parse(report().trim().split('\n').at(-1)!);
      expect(outcome).toMatchObject({ kind: 'interrupted' });
    });
  }, 10_000);
});
