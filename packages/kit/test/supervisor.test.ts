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
  targetPid: () => number | undefined;
  leafPid: () => number | undefined;
};
type Options = { exitOnTerm?: boolean; throwAfterExit?: boolean; throwAfterKill?: boolean; normalExit?: boolean; publishReady?: boolean };
async function withSupervisor(action: (context: Context) => Promise<void>, options: Options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-supervisor-'));
  const readyFile = join(dir, 'pids.json');
  const leafFile = join(dir, 'leaf');
  const trigger = join(dir, 'trigger');
  const eventFile = join(dir, 'events');
  const preload = join(dir, 'observe.cjs');
  // 実際の子のexitを全ハンドラが処理した直後に例外を起こし、250msの猶予との競合を決定的に再現する。
  // grace内の例外の試験だけはgraceの配送を実際のexitまで保留する。製品の250msや外側の2秒判定は変更しない。
  writeFileSync(preload, `
const fs=require('node:fs'); const cp=require('node:child_process');
const record=(event)=>fs.appendFileSync(${JSON.stringify(eventFile)},event+'\\n');
let targetExited=false;let kills=0;
const kill=process.kill;process.kill=function(pid,signal){record(signal);const result=kill.call(this,pid,signal);if(signal==='SIGKILL'&&++kills===1){${options.throwAfterKill ? "process.nextTick(()=>{throw new Error('fixture-after-kill');});" : ''}}return result;};
${options.throwAfterExit ? "const timer=global.setTimeout;global.setTimeout=function(callback,ms,...args){if(ms!==250)return timer(callback,ms,...args);record('grace-scheduled');return timer(function deliver(){if(!targetExited)return timer(deliver,10);callback(...args);},ms);};" : ''}
const spawn=cp.spawn;cp.spawn=function(...args){const child=spawn(...args);const emit=child.emit;child.emit=function(event,...values){const result=emit.call(this,event,...values);if(event==='exit'){targetExited=true;record('target-exit');${options.throwAfterExit ? "throw new Error('fixture-after-target-exit');" : ''}}return result;};return child;};
`);
  const leaf = `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(leafFile)},String(process.pid));setInterval(()=>{},100)`;
  const code = `const fs=require('node:fs');process.on('SIGTERM',()=>{${options.exitOnTerm ? 'process.exit(0);' : ''}});const leaf=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore'});`
    + `const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(leafFile)})){clearInterval(timer);${options.publishReady === false ? '' : 'fs.writeFileSync(' + JSON.stringify(readyFile) + ',JSON.stringify([process.pid,leaf.pid]));'}}},10);`
    + `const output=setInterval(()=>{if(fs.existsSync(${JSON.stringify(trigger)})){clearInterval(output);${options.normalExit ? 'process.exit(0);' : "process.stdout.write('trigger');"}}},10);setInterval(()=>{},100)`;
  const deadline = Number(process.hrtime.bigint()) / 1_000_000 + 10_000;
  const child = spawn(process.execPath, ['--require', preload, supervisor, JSON.stringify([process.execPath, ['-e', code], false, deadline, 1024 * 1024])], { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close') as Promise<[number | null, NodeJS.Signals | null]>;
  let report = ''; let stderr = '';
  child.stdio[3]!.on('data', (data) => { report += data; });
  child.stdout!.resume(); child.stderr!.on('data', (data) => { stderr += data; });
  const targetPid = () => report.trim().split('\n').flatMap((line) => { try { const value = JSON.parse(line); return Number.isInteger(value.pid) ? [value.pid as number] : []; } catch { return []; } }).at(0);
  const leafPid = () => existsSync(leafFile) ? Number(readFileSync(leafFile, 'utf8')) : undefined;
  const pids = () => existsSync(readyFile) ? JSON.parse(readFileSync(readyFile, 'utf8')) as number[] : [];
  try {
    await action({ child, closed, ready: () => pids().length === 2 && /"pid":/.test(report), pids, report: () => report,
      targetPid, leafPid, stderr: () => stderr, trigger: () => writeFileSync(trigger, ''),
      events: () => existsSync(eventFile) ? readFileSync(eventFile, 'utf8').trim().split('\n') : [] });
  } finally {
    // 監視役の終了とfd3の読取完了を待ち、ready前でも起動直後に報告されたグループを片付ける。
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
    const pid = targetPid();
    if (pid) { try { process.kill(-pid, 'SIGKILL'); } catch { /* 対象はすでに停止済み */ } }
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
      expect(events().slice(0, 3)).toEqual(['SIGTERM', 'grace-scheduled', 'target-exit']);
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
      expect(events()).toEqual(['SIGTERM', 'grace-scheduled', 'target-exit', 'SIGKILL']);
    }, { exitOnTerm: true, throwAfterExit: true });
  }, 10_000);
  it('[REQ-334] SIGKILL送信直後で対象exit未処理の例外でも、exitハンドラから再送しない', async () => {
    await withSupervisor(async ({ child, closed, ready, pids, stderr, events }) => {
      expect(await waitFor(ready, 3000)).toBe(true);
      expect(child.kill('SIGINT')).toBe(true);
      expect(await waitFor(() => child.exitCode !== null || child.signalCode !== null, 2000)).toBe(true);
      expect(await closed).toEqual([1, null]);
      expect(stderr()).toContain('fixture-after-kill');
      expect(events()).toEqual(['SIGTERM', 'SIGKILL']);
      expect(await waitFor(() => pids().every((pid) => !alive(pid)), 2000)).toBe(true);
    }, { throwAfterKill: true });
  }, 10_000);
  it('[REQ-333][REQ-334] readyファイルの前にfixtureが失敗しても報告済みPIDの対象と孫を片付ける', async () => {
    let leader: number | undefined; let leaf: number | undefined;
    try {
      await expect(withSupervisor(async ({ ready, targetPid, leafPid }) => {
        expect(await waitFor(() => targetPid() !== undefined && leafPid() !== undefined, 3000)).toBe(true);
        expect(ready()).toBe(false);
        leader = targetPid(); leaf = leafPid();
        throw new Error('fixture-before-ready');
      }, { publishReady: false })).rejects.toThrow('fixture-before-ready');
      expect(leader).toBeDefined(); expect(leaf).toBeDefined();
      expect(await waitFor(() => !alive(leader!) && !alive(leaf!), 2000)).toBe(true);
    } finally {
      // cleanup自体の回帰で失敗しても、試験が所有するグループは最後に停止する。
      if (leader) { try { process.kill(-leader, 'SIGKILL'); } catch { /* 停止済み */ } }
    }
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
