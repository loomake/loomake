import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CLEANUP_LIMIT_MS, cleanupWindowsOrphans, planOrphanCleanup, windowsProcessTools,
  type ProcessEntry, type StopRequest, type StopResult, type WindowsProcessTools,
} from '../src/runtime/process.js';
import { ProcessLimitError, missingResultError, runExternal, setTreeCleanupForTest, withProcessBudget } from '../src/runtime/process.js';

vi.setConfig({ testTimeout: 60_000 });

// 対象を起動した時刻（Unix 時刻のミリ秒）。作成時刻はマイクロ秒で持つ
const T = 1_800_000_000_000;
const at = (ms: number) => (T + ms) * 1000;
const target = { pid: 100, from: T, to: T + 5 };
const observedAt = T + 500;
const entry = (pid: number, ppid: number, ms: number): ProcessEntry => ({ pid, ppid, created: at(ms) });

/** 一覧の取得と停止を差し替えた道具。止めた要求を記録し、時計を進められる */
function fakeTools(processes: ProcessEntry[], options: {
  listMs?: number; stopMs?: number; list?: ReturnType<WindowsProcessTools['list']>; results?: (r: StopRequest) => StopResult; stop?: ReturnType<WindowsProcessTools['stop']>;
} = {}) {
  let now = 0;
  const calls: { list: number[]; stop: { requests: StopRequest[]; timeoutMs: number }[] } = { list: [], stop: [] };
  const tools: WindowsProcessTools = {
    list(timeoutMs) { calls.list.push(timeoutMs); now += options.listMs ?? 0; return options.list ?? { ok: true, processes }; },
    stop(requests, timeoutMs) {
      calls.stop.push({ requests, timeoutMs }); now += options.stopMs ?? 0;
      return options.stop ?? { ok: true, results: requests.map((r) => options.results?.(r) ?? { pid: r.pid, result: 'stopped' }) };
    },
  };
  return { tools, calls, clock: () => now };
}

describe('Windows で親のいない子孫の識別', () => {
  it('[REQ-252] 対象が不在なら、対象の PID を親に持ち、対象のあとに作られた子とその子孫だけを止める', () => {
    const processes = [entry(200, 100, 30), entry(300, 200, 40), entry(400, 100, -1000), entry(500, 999, 50), entry(600, 200, -2000)];
    const { tools, calls, clock } = fakeTools(processes);
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(calls.stop).toHaveLength(1);
    expect(calls.stop[0]!.requests).toEqual([{ pid: 200, created: at(30), root: true }, { pid: 300, created: at(40), root: false }]);
    expect(report.confirmed).toBe(true);
    expect(planOrphanCleanup(target, observedAt, processes).target).toBe('gone');
  });
  it('[REQ-252] 対象の PID の作成時刻が起動の範囲にあれば、対象がまだ動いているとして対象とその子孫を止める', () => {
    const processes = [entry(100, 1, 2), entry(200, 100, 30)];
    const plan = planOrphanCleanup(target, observedAt, processes);
    expect(plan.target).toBe('alive');
    expect(plan.stop).toEqual([{ pid: 100, created: at(2), root: true }, { pid: 200, created: at(30), root: false }]);
  });
  it('[REQ-252] 対象の PID が再利用されていたら、再利用したプロセスとそのあとに作られた子を止めず、理由を残す', () => {
    // 100 は対象の範囲の外（300ms 後）に作られた別のプロセス。200 はそれより前に作られた対象の子
    const processes = [entry(100, 1, 300), entry(200, 100, 30), entry(700, 100, 350), entry(800, 100, 900)];
    const { tools, calls, clock } = fakeTools(processes);
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(planOrphanCleanup(target, observedAt, processes).target).toBe('reused');
    expect(calls.stop[0]!.requests.map((r) => r.pid)).toEqual([200]);
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('PID 700 は、対象の PID 100 を再利用したプロセスの子か確かめられません');
    expect(report.detail).toContain('PID 800 は監視役の終了を受け取ったあとに作られ');
  });
  it('[REQ-252] 時計の刻みの差（50ms）までは、起動の直前より前の作成時刻も対象の子とみなし、それより前は前の持ち主の子として扱わない', () => {
    const plan = planOrphanCleanup(target, observedAt, [entry(200, 100, -40), entry(300, 100, -60)]);
    expect(plan.stop.map((r) => r.pid)).toEqual([200]);
    expect(plan.unverified).toEqual([]);
  });
  it('[REQ-252] 子孫は親より後に作られたものだけをたどり、自分自身は止めない', () => {
    const plan = planOrphanCleanup(target, observedAt, [entry(200, 100, 30), entry(300, 200, 10), entry(400, 200, 60)], 400);
    expect(plan.stop.map((r) => r.pid)).toEqual([200]);
  });
  it('[REQ-252] 列挙から停止までの間に PID が再利用されたものは止めず、元のプロセスは終わったものとして扱う', () => {
    const { tools, calls, clock } = fakeTools([entry(200, 100, 30)], { results: (r) => ({ pid: r.pid, result: 'reused' }) });
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    // 止める側には一覧の作成時刻を渡し、ハンドルで同じプロセスか確かめさせる
    expect(calls.stop[0]!.requests).toEqual([{ pid: 200, created: at(30), root: true }]);
    expect(report.confirmed).toBe(true);
  });
  it('[REQ-252] 止める子孫がなければ停止の手順を呼ばない', () => {
    const { tools, calls, clock } = fakeTools([entry(500, 999, 50)]);
    expect(cleanupWindowsOrphans(target, observedAt, tools, clock)).toMatchObject({ confirmed: true });
    expect(calls.stop).toHaveLength(0);
  });
});

describe('後片付けの上限と、停止を確認できない結果', () => {
  it('[REQ-253][REQ-254] 一覧の取得に失敗したら何も止めず、停止を確認できないと返す', () => {
    const { tools, calls, clock } = fakeTools([], { list: { ok: false, timedOut: false, message: 'アクセスが拒否されました' } });
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(report).toEqual({ confirmed: false, detail: 'プロセスの一覧を取得できません：アクセスが拒否されました' });
    expect(calls.stop).toHaveLength(0);
  });
  it('[REQ-253][REQ-254] 一覧の取得が時間切れなら、時間切れを理由に停止を確認できないと返す', () => {
    const { tools, calls, clock } = fakeTools([], { list: { ok: false, timedOut: true, message: 'ETIMEDOUT' } });
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(calls.list).toEqual([CLEANUP_LIMIT_MS]);
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('後片付けの上限（10 秒）に達しました（プロセスの一覧の取得中）');
  });
  it('[REQ-253] 候補が多くても、停止には全体の残り時間だけを 1 回で渡し、期限を延ばさない', () => {
    const processes = [1, 2, 3, 4, 5].map((n) => entry(200 + n, 100, 30 + n));
    const { tools, calls, clock } = fakeTools(processes, { listMs: 9_600 });
    cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(calls.stop).toHaveLength(1);
    expect(calls.stop[0]!.requests).toHaveLength(5);
    expect(calls.stop[0]!.timeoutMs).toBe(400);
  });
  it('[REQ-253][REQ-254] 一覧の取得で上限を使い切ったら止めずに打ち切り、停止が時間切れでも停止を確認できないと返す', () => {
    const spent = fakeTools([entry(200, 100, 30)], { listMs: CLEANUP_LIMIT_MS });
    expect(cleanupWindowsOrphans(target, observedAt, spent.tools, spent.clock)).toMatchObject({ confirmed: false, detail: expect.stringContaining('後片付けの上限') });
    expect(spent.calls.stop).toHaveLength(0);
    const slow = fakeTools([entry(200, 100, 30)], { stop: { ok: false, timedOut: true, message: 'ETIMEDOUT' } });
    expect(cleanupWindowsOrphans(target, observedAt, slow.tools, slow.clock)).toMatchObject({ confirmed: false, detail: expect.stringContaining('停止と終了の待機中') });
  });
  it('[REQ-254] 権限不足・失敗・残ったプロセスは、停止を確認できない理由として区別して返す', () => {
    const results: Record<number, StopResult> = {
      200: { pid: 200, result: 'denied', message: 'アクセスが拒否されました。' },
      300: { pid: 300, result: 'alive' },
      400: { pid: 400, result: 'failed', message: '不明' },
    };
    const { tools, clock } = fakeTools([entry(200, 100, 30), entry(300, 100, 31), entry(400, 100, 32)], { results: (r) => results[r.pid]! });
    const report = cleanupWindowsOrphans(target, observedAt, tools, clock);
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('PID 200 は権限不足で止められません（アクセスが拒否されました。）');
    expect(report.detail).toContain('PID 300 は後片付けの上限までに終わりません');
    expect(report.detail).toContain('PID 400 は止められません（不明）');
  });
  it('[REQ-250][REQ-254] 停止を確認できない中断は、停止を確認できた中断と理由で区別する', () => {
    const confirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: true, detail: '対象の子と子孫 1 個を止めました' });
    const unconfirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: false, detail: 'プロセスの一覧を取得できません：x' });
    for (const error of [confirmed, unconfirmed]) {
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect(error.kind).toBe('interrupted');
    }
    expect(confirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）');
    expect(unconfirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）。子孫の停止を確認できません：プロセスの一覧を取得できません：x');
    expect(unconfirmed.message).toContain('子孫の停止を確認できません');
    expect(unconfirmed.cleanup).toEqual({ confirmed: false, detail: 'プロセスの一覧を取得できません：x' });
  });
  it('[REQ-252][REQ-253][REQ-254] 後片付けで停止を確認できなくても中断として返し、同じ共有予算の次の操作を起動しない', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    const seen: { pid: number; spawned?: { from: number; to: number }; observedAt: number }[] = [];
    try {
      setTreeCleanupForTest((pid, spawned, observed) => {
        seen.push({ pid, spawned, observedAt: observed });
        // 試験の後片付けとして、残った対象を止めてから「確認できない」と返す
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
        else try { process.kill(-pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
        return { confirmed: false, detail: 'プロセスの一覧を取得できません：試験' };
      });
      const after = join(dir, 'after');
      const started = Date.now();
      withProcessBudget({ timeoutMs: 20_000 }, () => {
        let error: unknown;
        try { runExternal(process.execPath, ['-e', "process.kill(process.ppid,'SIGKILL');setInterval(()=>{},100)"]); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('interrupted');
        expect((error as ProcessLimitError).reason).toContain('子孫の停止を確認できません：プロセスの一覧を取得できません：試験');
        expect(() => runExternal(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`])).toThrow('中断');
      });
      expect(existsSync(after)).toBe(false);
      // 監視役は対象の PID と、起動の直前と直後の時刻を渡し、親は監視役の終了を受け取った時刻を記録する
      expect(seen).toHaveLength(1);
      expect(seen[0]!.spawned!.from).toBeGreaterThanOrEqual(started - 1);
      expect(seen[0]!.spawned!.from).toBeLessThanOrEqual(seen[0]!.spawned!.to);
      expect(seen[0]!.observedAt).toBeGreaterThanOrEqual(seen[0]!.spawned!.to);
    } finally {
      setTreeCleanupForTest(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function alive(pid: number) { try { process.kill(pid, 0); return true; } catch { return false; } }
function waitFor(check: () => boolean, ms: number) {
  const until = Date.now() + ms;
  while (!check()) { if (Date.now() > until) return false; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); }
  return true;
}

describe.runIf(process.platform === 'win32')('Windows の実際のプロセスの一覧と停止', () => {
  it('[REQ-252][REQ-254] cmd.exe が先に終わって残った孫を、作成時刻と親の PID で識別して止める', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    try {
      const file = join(dir, 'leaf');
      const script = join(dir, 'leaf.cjs');
      writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(file)},String(process.pid));setInterval(()=>{},100)`);
      // 監視役と同じく shell で起動し、cmd.exe の子として孫を動かす
      const from = Date.now();
      const shell = spawn(`"${process.execPath}" "${script}"`, { shell: true, stdio: 'ignore' });
      const to = Date.now();
      expect(waitFor(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 15_000)).toBe(true);
      const leafPid = Number(readFileSync(file, 'utf8'));
      // cmd.exe だけを止め、孫を親のいない状態にする
      process.kill(shell.pid!, 'SIGKILL');
      expect(waitFor(() => !alive(shell.pid!), 5_000)).toBe(true);
      expect(alive(leafPid)).toBe(true);
      const started = Date.now();
      const report = cleanupWindowsOrphans({ pid: shell.pid!, from, to }, Date.now(), windowsProcessTools);
      expect(report, JSON.stringify(report)).toMatchObject({ confirmed: true });
      expect(alive(leafPid)).toBe(false);
      expect(Date.now() - started).toBeLessThanOrEqual(CLEANUP_LIMIT_MS + 1000);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('[REQ-252] 一覧の作成時刻と一致しないプロセスは、PID が同じでも止めない', () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { stdio: 'ignore' });
    try {
      const listed = windowsProcessTools.list(CLEANUP_LIMIT_MS);
      expect(listed.ok, JSON.stringify(listed)).toBe(true);
      const own = listed.ok ? listed.processes.find((p) => p.pid === child.pid) : undefined;
      expect(own).toBeDefined();
      // 作成時刻を 1 秒ずらし、列挙のあとに PID が再利用された場合と同じにする
      const stopped = windowsProcessTools.stop([{ pid: child.pid!, created: own!.created - 1_000_000, root: true }], CLEANUP_LIMIT_MS);
      expect(stopped, JSON.stringify(stopped)).toEqual({ ok: true, results: [{ pid: child.pid, result: 'reused' }] });
      expect(alive(child.pid!)).toBe(true);
      const matched = windowsProcessTools.stop([{ pid: child.pid!, created: own!.created, root: true }], CLEANUP_LIMIT_MS);
      expect(matched, JSON.stringify(matched)).toEqual({ ok: true, results: [{ pid: child.pid, result: 'stopped' }] });
      expect(waitFor(() => !alive(child.pid!), 2_000)).toBe(true);
    } finally { child.kill('SIGKILL'); }
  });
});
