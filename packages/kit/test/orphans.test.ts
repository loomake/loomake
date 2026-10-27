import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CLEANUP_LIMIT_MS, ProcessLimitError, SUPERVISOR_MARK_ENV, appendMark, cleanupWindowsOrphans, describeReason, judgeCleanup, missingResultError,
  parseCleanupOutput, runExternal, runPowerShell, setTreeCleanupForTest, withProcessBudget,
  type CleanupRecord, type CleanupTarget, type PowerShellRunner,
} from '../src/runtime/process.js';

vi.setConfig({ testTimeout: 60_000 });

const target: CleanupTarget = { pid: 100, mark: 'a'.repeat(32), from: 1_800_000_000_000 };
const rec = (pid: number, ppid: number, state: CleanupRecord['state'], extra: Partial<CleanupRecord> = {}): CleanupRecord => (
  { pid, ppid, created: '134000000000000000', parentGone: false, state, opens: 1, ...extra }
);
const stopped = (pid: number, ppid: number): CleanupRecord => rec(pid, ppid, 'marked', { action: 'terminated', wait: 'exited', handle: 8, stopHandle: 8, waitHandle: 8 });
const timing = { define: 40, enumerate: 300, identify: 100, stop: 8, wait: 9, total: 600 };
const lines = (records: object[], extra: object = {}) => [...records.map((r) => JSON.stringify({ kind: 'process', ...r })), JSON.stringify({ kind: 'timing', passes: 1, timedOut: false, timing, ...extra })].join('\r\n');

/** PowerShell の実行を差し替える。渡された上限と入力を記録する */
function fake(result: ReturnType<PowerShellRunner>) {
  const calls: { file: string; timeoutMs: number; input: Record<string, unknown> }[] = [];
  const run: PowerShellRunner = (file, timeoutMs, env) => { calls.push({ file, timeoutMs, input: JSON.parse(env?.LOOMAKE_CLEANUP_INPUT ?? '{}') as Record<string, unknown> }); return result; };
  return { run, calls };
}

describe('Windows の後片付けの判定（印による識別）', () => {
  it('[REQ-252] 印を確かめて止め、終了を確かめたプロセスだけなら、停止を確認できたと返し、各手順の時間を残す', () => {
    const { run, calls } = fake({ ok: true, stdout: lines([stopped(200, 100), stopped(300, 200), rec(400, 999, 'no-mark', { parentGone: true })]) });
    let now = 0;
    const report = cleanupWindowsOrphans(target, run, { clock: () => (now += 700), wall: () => 5_000 });
    expect(report.confirmed, report.detail).toBe(true);
    expect(report.detail).toBe('印のあるプロセス 2 個を止めました（PowerShell の起動 100ms、宣言 40ms、探索 300ms、識別 100ms、停止 8ms、待機 9ms、合計 700ms）');
    expect(calls[0]!.file).toMatch(/[\\/]supervisor[\\/]windows-cleanup\.ps1$/);
    expect(calls[0]!.input).toMatchObject({ mark: target.mark, targetPid: 100, fromMs: target.from, slackMs: 50, deadlineMs: 5_000 + CLEANUP_LIMIT_MS, maxPasses: 3 });
  });
  it('[REQ-252] P1 の順：対象の PID を親に持つ印のない子は止めず、未確認として返す', () => {
    // 対象が終わったあと、同じ PID を取った別のプロセスが作り、その親も終わった子。印がない
    const output = parseCleanupOutput(lines([rec(6940, 100, 'no-mark', { parentGone: true })]));
    const judged = judgeCleanup(target, output);
    expect(judged).toEqual({ confirmed: false, stopped: 0, problems: ['PID 6940 は印がないので止めていません（親の PID 100）'] });
  });
  it('[REQ-252] 印を持つプロセスの子で、印を消したか別の印を持つものは止めず、未確認として返す', () => {
    const judged = judgeCleanup(target, parseCleanupOutput(lines([stopped(200, 100), rec(300, 200, 'no-mark'), rec(400, 200, 'other-mark')])));
    expect(judged.confirmed).toBe(false);
    expect(judged.stopped).toBe(1);
    expect(judged.problems).toEqual(['PID 300 は印がないので止めていません（親の PID 200）', 'PID 400 は別の実行の印を持つので止めていません（親の PID 200）']);
  });
  it('[REQ-252][REQ-254] 子孫の可能性がある読めないプロセスと、親がもういない読めないプロセスは、止めずに理由つきで返す', () => {
    const judged = judgeCleanup(target, parseCleanupOutput(lines([
      rec(200, 100, 'unreadable', { reason: 'open:5' }),
      rec(300, 4242, 'unreadable', { reason: 'env-read:299', parentGone: true }),
      rec(400, 4242, 'unreadable', { reason: 'open:5', parentGone: false }),
    ])));
    expect(judged.problems).toEqual([
      'PID 200 は印を確かめられないので止めていません（権限不足で開けません）',
      'PID 300 は印を確かめられないので止めていません（環境変数を読めません（エラー 299））',
    ]);
  });
  it('[REQ-252] 親がもういないプロセスで印がないと読めたもの、入れ替わったもの、終わっていたものは扱わない', () => {
    const judged = judgeCleanup(target, parseCleanupOutput(lines([rec(200, 4242, 'no-mark', { parentGone: true }), rec(300, 100, 'replaced'), rec(400, 100, 'exited')])));
    expect(judged).toEqual({ confirmed: true, stopped: 0, problems: [] });
  });
  it('[REQ-254] 印のあるプロセスを止められないか、期限までに終わらなければ、停止を確認できないと返す', () => {
    const judged = judgeCleanup(target, parseCleanupOutput(lines([
      rec(200, 100, 'marked', { action: 'failed', reason: 'terminate:5' }),
      rec(300, 100, 'marked', { action: 'terminated', wait: 'timeout' }),
    ])));
    expect(judged.problems).toEqual(['PID 200 は権限不足で止められません', 'PID 300 は後片付けの上限までに終わりません']);
  });
  it('[REQ-252][REQ-254] 対応しない環境では何も止めず、未確認として返す', () => {
    const { run } = fake({ ok: true, stdout: JSON.stringify({ kind: 'unsupported', reason: 'unsupported-arch:ARM64' }) });
    const report = cleanupWindowsOrphans(target, run, { clock: () => 0 });
    expect(report).toEqual({ confirmed: false, detail: '印を確かめられないので、何も止めていません：対応しない環境です（PROCESSOR_ARCHITECTURE=ARM64）（合計 0ms）' });
  });
});

describe('Windows の後片付けの上限と失敗', () => {
  it('[REQ-253] PowerShell の起動を含めて全体の上限だけを 1 回で渡し、候補の数で延ばさない', () => {
    const { run, calls } = fake({ ok: true, stdout: lines([1, 2, 3, 4, 5].map((n) => stopped(200 + n, 100))) });
    cleanupWindowsOrphans(target, run, { clock: () => 0, wall: () => 1_000 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.timeoutMs).toBe(CLEANUP_LIMIT_MS);
    expect(calls[0]!.input.deadlineMs).toBe(1_000 + CLEANUP_LIMIT_MS);
  });
  it('[REQ-253][REQ-254] PowerShell が上限で打ち切られたら、時間切れとして停止を確認できないと返す', () => {
    const { run } = fake({ ok: false, timedOut: true, message: 'ETIMEDOUT' });
    let now = 0;
    expect(cleanupWindowsOrphans(target, run, { clock: () => (now += 10_050) })).toEqual({ confirmed: false, detail: '後片付けの上限（10 秒）に達しました（合計 10050ms）' });
  });
  it('[REQ-253][REQ-254] PowerShell の中で期限に達して調べ終えなかったら、停止を確認できないと返す', () => {
    const { run } = fake({ ok: true, stdout: lines([stopped(200, 100)], { timedOut: true }) });
    const report = cleanupWindowsOrphans(target, run, { clock: () => 0 });
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('後片付けの上限に達したので、調べ終えていないプロセスがあります');
  });
  it('[REQ-253][REQ-254] PowerShell が失敗するか、結果を読めなければ、探索の失敗として返す', () => {
    expect(cleanupWindowsOrphans(target, fake({ ok: false, timedOut: false, message: 'spawn powershell.exe ENOENT' }).run, { clock: () => 0 }))
      .toEqual({ confirmed: false, detail: '子孫を探せません：spawn powershell.exe ENOENT（合計 0ms）' });
    expect(cleanupWindowsOrphans(target, fake({ ok: true, stdout: 'ごみ' }).run, { clock: () => 0 }))
      .toEqual({ confirmed: false, detail: '後片付けの結果を読めません（合計 0ms）' });
  });
  it('[REQ-253][REQ-254] PowerShell を起動できない・残り時間がない・失敗したときは、時間切れと区別して返す', () => {
    expect(runPowerShell('x.ps1', 0)).toEqual({ ok: false, timedOut: true, message: '時間がありません' });
    expect(runPowerShell('x.ps1', 5_000, undefined, 'loomake-missing-powershell-req253')).toMatchObject({ ok: false, timedOut: false });
    expect(runPowerShell('x.ps1', 5_000, undefined, process.execPath)).toMatchObject({ ok: false, timedOut: false, message: expect.stringContaining('PowerShell の終了コード') });
  });
  it('[REQ-254] PowerShell が返した理由の符号を、利用者に見せる文にする', () => {
    expect(describeReason('open:5')).toBe('権限不足で開けません');
    expect(describeReason('open:6')).toBe('開けません（エラー 6）');
    expect(describeReason('params-read:299')).toBe('PEB から環境変数の位置を読めません（エラー 299）');
    expect(describeReason('env-too-large')).toBe('環境変数の終わりが 1 MiB 以内にありません');
    expect(describeReason(undefined)).toBe('理由は分かりません');
    expect(describeReason('mystery')).toBe('mystery');
  });
  it('[REQ-250][REQ-254] 停止を確認できない中断は、停止を確認できた中断と理由で区別する', () => {
    const confirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: true, detail: '印のあるプロセス 1 個を止めました' });
    const unconfirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: false, detail: '子孫を探せません：x' });
    for (const error of [confirmed, unconfirmed]) {
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect(error.kind).toBe('interrupted');
    }
    expect(confirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）');
    expect(unconfirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）。子孫の停止を確認できません：子孫を探せません：x');
    expect(unconfirmed.cleanup).toEqual({ confirmed: false, detail: '子孫を探せません：x' });
  });
});

describe('対象の環境の印', () => {
  it('[REQ-252] 外側の印を残したまま、実行ごとの印を足す', () => {
    expect(appendMark(undefined, 'b')).toBe('b');
    expect(appendMark('', 'b')).toBe('b');
    expect(appendMark('a', 'b')).toBe('a;b');
  });
  it('[REQ-252] runExternal は対象の環境に実行ごとの印を足し、外側の印を残す', () => {
    const show = ['-e', `process.stdout.write(process.env.${SUPERVISOR_MARK_ENV} ?? '')`];
    const env = { ...process.env };
    delete env[SUPERVISOR_MARK_ENV];
    const first = runExternal(process.execPath, show, { env }).stdout;
    const second = runExternal(process.execPath, show, { env }).stdout;
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
    expect(runExternal(process.execPath, show, { env: { ...env, [SUPERVISOR_MARK_ENV]: 'outer' } }).stdout).toMatch(/^outer;[0-9a-f]{32}$/);
  });
  it('[REQ-252][REQ-253][REQ-254] 後片付けで停止を確認できなくても中断として返し、同じ共有予算の次の操作を起動しない', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    const seen: { pid: number; spawned?: { from: number; to: number }; mark: string }[] = [];
    try {
      setTreeCleanupForTest((pid, spawned, mark) => {
        seen.push({ pid, spawned, mark });
        // 試験の後片付けとして、残った対象を止めてから「確認できない」と返す
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
        else try { process.kill(-pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
        return { confirmed: false, detail: '子孫を探せません：試験' };
      });
      const after = join(dir, 'after');
      const started = Date.now();
      withProcessBudget({ timeoutMs: 20_000 }, () => {
        let error: unknown;
        try { runExternal(process.execPath, ['-e', "process.kill(process.ppid,'SIGKILL');setInterval(()=>{},100)"]); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('interrupted');
        expect((error as ProcessLimitError).reason).toContain('子孫の停止を確認できません：子孫を探せません：試験');
        expect(() => runExternal(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`])).toThrow('中断');
      });
      expect(existsSync(after)).toBe(false);
      // 監視役は対象の PID と起動の直前・直後の時刻を渡し、親は同じ実行の印で後片付けする
      expect(seen).toHaveLength(1);
      expect(seen[0]!.spawned!.from).toBeGreaterThanOrEqual(started - 1);
      expect(seen[0]!.spawned!.from).toBeLessThanOrEqual(seen[0]!.spawned!.to);
      expect(seen[0]!.mark).toMatch(/^[0-9a-f]{32}$/);
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
const newMark = () => randomBytes(16).toString('hex');
const envWith = (mark?: string) => { const env = { ...process.env }; delete env[SUPERVISOR_MARK_ENV]; if (mark) env[SUPERVISOR_MARK_ENV] = mark; return env; };
/** 実際の PowerShell で後片付けし、出力も返す */
function cleanupWithOutput(t: CleanupTarget, options: Parameters<typeof cleanupWindowsOrphans>[2] = {}) {
  let stdout = '';
  const run: PowerShellRunner = (file, timeoutMs, env) => { const r = runPowerShell(file, timeoutMs, env); if (r.ok) stdout = r.stdout; return r; };
  const report = cleanupWindowsOrphans(t, run, options);
  // 10 秒の上限に対して各手順にかかった時間を CI の記録に残す
  console.info(`[REQ-253] 後片付けの結果：${JSON.stringify(report)}`);
  return { report, output: parseCleanupOutput(stdout) };
}
/** cmd.exe を標準入力で操作し、コマンドを流すたびに、終わった合図の行を待つ */
function interactiveCmd(exe: string, mark: string) {
  const child: ChildProcess = spawn(exe, ['/d', '/q', '/k'], { stdio: ['pipe', 'pipe', 'ignore'], env: envWith(mark) });
  let out = '';
  child.stdout!.on('data', (d: Buffer) => { out += d.toString('latin1'); });
  let n = 0;
  const send = (command: string) => {
    const token = `loomake-done-${++n}`;
    child.stdin!.write(`${command}\r\necho ${token}\r\n`);
    return token;
  };
  return { child, send, out: () => out };
}

describe.runIf(process.platform === 'win32')('Windows の実際の後片付け', () => {
  it('[REQ-252][REQ-254] cmd.exe が先に終わって残った孫を、印で識別し、識別したのと同じハンドルで止めて待つ', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    try {
      const mark = newMark();
      const file = join(dir, 'leaf');
      const script = join(dir, 'leaf.cjs');
      writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(file)},String(process.pid));setInterval(()=>{},100)`);
      // 監視役と同じく shell で起動し、cmd.exe の子として孫を動かす
      const from = Date.now();
      const shell = spawn(`"${process.execPath}" "${script}"`, { shell: true, stdio: 'ignore', env: envWith(mark) });
      expect(waitFor(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 15_000)).toBe(true);
      const leafPid = Number(readFileSync(file, 'utf8'));
      process.kill(shell.pid!, 'SIGKILL');
      expect(waitFor(() => !alive(shell.pid!), 5_000)).toBe(true);
      expect(alive(leafPid)).toBe(true);
      const started = Date.now();
      const { report, output } = cleanupWithOutput({ pid: shell.pid!, mark, from });
      expect(report.confirmed, report.detail).toBe(true);
      expect(alive(leafPid)).toBe(false);
      expect(Date.now() - started).toBeLessThanOrEqual(CLEANUP_LIMIT_MS + 1000);
      // PID で開き直さず、識別・停止・待機に同じハンドルを使う
      const leaf = output.records.find((r) => r.pid === leafPid);
      expect(leaf).toMatchObject({ state: 'marked', bits: 64, opens: 1, action: 'terminated', wait: 'exited' });
      expect(leaf!.stopHandle).toBe(leaf!.handle);
      expect(leaf!.waitHandle).toBe(leaf!.handle);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('[REQ-252] P1 の順：印のない親が作った子は、その親の PID を対象としても止めず、未確認として返す', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    let childPid = 0;
    try {
      const file = join(dir, 'child');
      const from = Date.now();
      const code = `const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'ignore'});c.unref();require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid));`;
      const parent = spawn(process.execPath, ['-e', code], { stdio: 'ignore', env: envWith(undefined) });
      expect(waitFor(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 15_000)).toBe(true);
      expect(waitFor(() => !alive(parent.pid!), 5_000)).toBe(true);
      childPid = Number(readFileSync(file, 'utf8'));
      const { report, output } = cleanupWithOutput({ pid: parent.pid!, mark: newMark(), from });
      expect(alive(childPid)).toBe(true);
      expect(output.records.find((r) => r.pid === childPid)).toMatchObject({ state: 'no-mark', ppid: parent.pid, parentGone: true });
      expect(report.confirmed).toBe(false);
      expect(report.detail).toContain(`PID ${childPid} は印がないので止めていません（親の PID ${parent.pid}）`);
    } finally {
      if (childPid) try { process.kill(childPid, 'SIGKILL'); } catch { /* すでに終わっている */ }
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it.each([
    ['64', join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'), 64],
    ['WOW64', join(process.env.SystemRoot ?? 'C:\\Windows', 'SysWOW64', 'cmd.exe'), 32],
  ])('[REQ-252] %s ビットの cmd.exe が起動後に印を別の値に変えるか消したら、変えたあとの環境を読んで止めない', (_name, exe, bits) => {
    const mark = newMark();
    const from = Date.now();
    const cmd = interactiveCmd(exe, mark);
    try {
      let token = cmd.send('ver');
      expect(waitFor(() => cmd.out().includes(token), 10_000)).toBe(true);
      token = cmd.send(`set ${SUPERVISOR_MARK_ENV}=${newMark()}`);
      expect(waitFor(() => cmd.out().includes(token), 10_000)).toBe(true);
      const changed = cleanupWithOutput({ pid: cmd.child.pid!, mark, from });
      expect(changed.output.records.find((r) => r.pid === cmd.child.pid), changed.report.detail).toMatchObject({ state: 'other-mark', bits });
      expect(alive(cmd.child.pid!)).toBe(true);
      token = cmd.send(`set ${SUPERVISOR_MARK_ENV}=`);
      expect(waitFor(() => cmd.out().includes(token), 10_000)).toBe(true);
      const removed = cleanupWithOutput({ pid: cmd.child.pid!, mark, from });
      expect(removed.output.records.find((r) => r.pid === cmd.child.pid), removed.report.detail).toMatchObject({ state: 'no-mark', bits });
      expect(alive(cmd.child.pid!)).toBe(true);
    } finally { cmd.child.kill('SIGKILL'); }
  });
  it('[REQ-252] 印を変えていない WOW64 の cmd.exe は、32 ビットの側の環境で印を確かめて止める', () => {
    const mark = newMark();
    const from = Date.now();
    const cmd = interactiveCmd(join(process.env.SystemRoot ?? 'C:\\Windows', 'SysWOW64', 'cmd.exe'), mark);
    try {
      const token = cmd.send('ver');
      expect(waitFor(() => cmd.out().includes(token), 10_000)).toBe(true);
      const { report, output } = cleanupWithOutput({ pid: 999_999, mark, from });
      expect(report.confirmed, report.detail).toBe(true);
      expect(output.records.find((r) => r.pid === cmd.child.pid)).toMatchObject({ state: 'marked', bits: 32, action: 'terminated', wait: 'exited' });
      expect(waitFor(() => !alive(cmd.child.pid!), 2_000)).toBe(true);
    } finally { cmd.child.kill('SIGKILL'); }
  });
  it('[REQ-252] 列挙のあとに入れ替わった（作成時刻の違う）候補は、印があっても止めない', () => {
    const mark = newMark();
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { stdio: 'ignore', env: envWith(mark) });
    try {
      expect(waitFor(() => alive(child.pid!), 5_000)).toBe(true);
      const { output } = cleanupWithOutput({ pid: 999_999, mark, from: Date.now() }, { candidates: [{ pid: child.pid!, created: '1' }] });
      expect(output.records.find((r) => r.pid === child.pid)).toMatchObject({ state: 'replaced', opens: 1 });
      expect(alive(child.pid!)).toBe(true);
    } finally { child.kill('SIGKILL'); }
  });
  it('[REQ-252][REQ-254] 開けないプロセスは、止めずに理由つきで返す', () => {
    const listed = spawnSync('tasklist', ['/fi', 'imagename eq wininit.exe', '/fo', 'csv', '/nh'], { encoding: 'utf8' }).stdout;
    const pid = Number(/"wininit\.exe","(\d+)"/i.exec(listed)?.[1]);
    expect(pid, listed).toBeGreaterThan(0);
    const { output } = cleanupWithOutput({ pid: 999_999, mark: newMark(), from: Date.now() }, { candidates: [{ pid, created: '1' }] });
    expect(output.records.find((r) => r.pid === pid)).toMatchObject({ state: 'unreadable', reason: 'open:5' });
    expect(alive(pid)).toBe(true);
  });
  it('[REQ-253][REQ-254] 上限を短くすると、PowerShell の起動を含めて打ち切り、時間切れとして停止を確認できないと返す', () => {
    const started = Date.now();
    const { report } = cleanupWithOutput({ pid: 999_999, mark: newMark(), from: Date.now() }, { limitMs: 300 });
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('後片付けの上限（0.3 秒）に達しました');
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
