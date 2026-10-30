import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
type Context = {
  child: ReturnType<typeof spawn>;
  closed: Promise<[number | null, NodeJS.Signals | null]>;
  ready: () => boolean;
  pids: () => number[];
  report: () => string;
  stderr: () => string;
  trigger: () => void;
  events: () => string[];
};
type Options = { exitOnTerm?: boolean; throwAfterExit?: boolean; normalExit?: boolean };
async function withSupervisor(action: (context: Context) => Promise<void>, options: Options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-supervisor-'));
  const readyFile = join(dir, 'pids.json');
  const leafFile = join(dir, 'leaf');
  const trigger = join(dir, 'trigger');
  const eventFile = join(dir, 'events');
  const preload = join(dir, 'observe.cjs');
  // 実際の子のexitを全ハンドラが処理した直後に例外を起こし、250msの猶予との競合を決定的に再現する。
  // 製品の処理を置き換えず、実際のグループへの信号とexitの順序をファイルへ記録する。
  writeFileSync(preload, `
const fs=require('node:fs'); const cp=require('node:child_process');
const record=(event)=>fs.appendFileSync(${JSON.stringify(eventFile)},event+'\\n');
const kill=process.kill;process.kill=function(pid,signal){record(signal);return kill.call(this,pid,signal);};
const spawn=cp.spawn;cp.spawn=function(...args){const child=spawn(...args);const emit=child.emit;child.emit=function(event,...values){const result=emit.call(this,event,...values);if(event==='exit'){record('target-exit');${options.throwAfterExit ? "throw new Error('fixture-after-target-exit');" : ''}}return result;};return child;};
`);
  const leaf = `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(leafFile)},String(process.pid));setInterval(()=>{},100)`;
  const code = `const fs=require('node:fs');process.on('SIGTERM',()=>{${options.exitOnTerm ? 'process.exit(0);' : ''}});const leaf=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore'});`
    + `const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(leafFile)})){clearInterval(timer);fs.writeFileSync(${JSON.stringify(readyFile)},JSON.stringify([process.pid,leaf.pid]));}},10);`
    + `const output=setInterval(()=>{if(fs.existsSync(${JSON.stringify(trigger)})){clearInterval(output);${options.normalExit ? 'process.exit(0);' : "process.stdout.write('trigger');"}}},10);setInterval(()=>{},100)`;
  const deadline = Number(process.hrtime.bigint()) / 1_000_000 + 10_000;
  const child = spawn(process.execPath, ['--require', preload, supervisor, JSON.stringify([process.execPath, ['-e', code], false, deadline, 1024 * 1024])], { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close') as Promise<[number | null, NodeJS.Signals | null]>;
  let report = ''; let stderr = '';
  child.stdio[3]!.on('data', (data) => { report += data; });
  child.stdout!.resume(); child.stderr!.on('data', (data) => { stderr += data; });
  const pids = () => existsSync(readyFile) ? JSON.parse(readFileSync(readyFile, 'utf8')) as number[] : [];
  try {
    await action({ child, closed, ready: () => pids().length === 2 && /"pid":/.test(report), pids, report: () => report,
      stderr: () => stderr, trigger: () => writeFileSync(trigger, ''),
      events: () => existsSync(eventFile) ? readFileSync(eventFile, 'utf8').trim().split('\n') : [] });
  } finally {
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
  it('[REQ-334] stdoutの読み手が閉じてEPIPEで例外終了しても、対象とSIGTERMを無視する孫を残さない', async () => {
    await withSupervisor(async ({ child, closed, ready, pids, stderr, trigger }) => {
      expect(await waitFor(ready, 3000)).toBe(true);
      child.stdout!.destroy();
      trigger();
      expect(await waitFor(() => child.exitCode !== null || child.signalCode !== null, 2000)).toBe(true);
      expect(await closed).toEqual([1, null]);
      expect(stderr()).toContain('EPIPE');
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
    });
  }, 10_000);
  it('[REQ-334] SIGTERM後の先頭exit処理済みでも、SIGKILL未送信の猶予中の例外で孫を残さない', async () => {
    await withSupervisor(async ({ child, closed, ready, pids, stderr, events }) => {
      expect(await waitFor(ready, 3000)).toBe(true);
      expect(child.kill('SIGINT')).toBe(true);
      expect(await waitFor(() => child.exitCode !== null || child.signalCode !== null, 2000)).toBe(true);
      expect(await closed).toEqual([1, null]);
      expect(stderr()).toContain('fixture-after-target-exit');
      expect(events().slice(0, 2)).toEqual(['SIGTERM', 'target-exit']);
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
      expect(events()).toEqual(['SIGTERM', 'target-exit', 'SIGKILL']);
    }, { exitOnTerm: true, throwAfterExit: true });
  }, 10_000);
  it.each(['normal', 'SIGINT'] as const)('[REQ-334] %s終了でSIGKILLを送信済みなら、exitハンドラから再送しない', async (mode) => {
    await withSupervisor(async ({ child, closed, ready, pids, events, trigger }) => {
      expect(await waitFor(ready, 3000)).toBe(true);
      if (mode === 'normal') trigger(); else expect(child.kill('SIGINT')).toBe(true);
      expect(await waitFor(() => child.exitCode !== null || child.signalCode !== null, 2000)).toBe(true);
      expect(await closed).toEqual([0, null]);
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
      expect(events().filter((event) => event === 'SIGKILL')).toHaveLength(1);
    }, { normalExit: mode === 'normal' });
  }, 10_000);
});
