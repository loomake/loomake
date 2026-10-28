import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CLEANUP_LIMIT_MS, HOLDER_START_LIMIT_MS, ProcessLimitError, remainingProcessTime, closeWindowsHolderForTest, describeUnprotected, holdExpiry, judgeHolderCleanup, missingResultError,
  prepareWindowsHolder, readReport, runExternal, setHolderCommandForTest, setHolderForTest, setTreeCleanupForTest, stopTree, windowsHolder, windowsHolderStateForTest,
  withProcessBudget, type HolderClient, type HolderCleanupOutput, type HolderCleanupRequest, type HolderRecord, type HolderReply,
} from '../src/runtime/process.js';

vi.setConfig({ testTimeout: 60_000 });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** 同期で待つ（runExternal の中の同期の待ちと同じに、イベントループを止める） */
const busyWait = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}
/** イベントループを止めずに待つ（stdout の data などを受け取れるように。レビューの P2） */
async function waitFor(check: () => boolean, ms: number) {
  const until = Date.now() + ms;
  while (!check()) { if (Date.now() > until) return false; await sleep(20); }
  return true;
}
const fileReady = (file: string) => existsSync(file) && readFileSync(file, 'utf8') !== '';
const timing = { enumerate: 60, stop: 1, wait: 1, total: 63 };
const done = (pid: number, ppid: number, extra: Partial<HolderRecord> = {}): HolderRecord => (
  { pid, ppid, created: '134000000000000001', state: 'descendant', opens: 1, access: 'full', handle: 8, stopHandle: 8, waitHandle: 8, action: 'terminated', wait: 'exited', ...extra }
);
const reply = (output: Partial<HolderCleanupOutput>): HolderReply => ({ output: { target: 'held', passes: 2, stable: true, records: [], timing, ...output }, elapsedMs: 90 });

describe('監視役の行の読み取り', () => {
  it('[REQ-250][REQ-252] 起動の直前の行・PID と作成時刻の行・保持を確かめられない行・結果を読む', () => {
    expect(readReport('{"spawning":true}\n{"pid":42,"created":"134000000000000000"}\n{"status":0,"signal":null}')).toEqual({
      target: { spawning: true, pid: 42, created: '134000000000000000' }, outcome: { status: 0, signal: null }, invalid: false,
    });
    expect(readReport('{"spawning":true}\n{"pid":42,"unprotected":"no-reply"}\n')).toEqual({ target: { spawning: true, pid: 42, unprotected: 'no-reply' }, invalid: false });
    expect(readReport('{"spawning":true}\n')).toEqual({ target: { spawning: true }, invalid: false });
    // POSIX は保持役を使わないので、PID だけを書く
    expect(readReport('{"spawning":true}\n{"pid":42}\n').target).toEqual({ spawning: true, pid: 42 });
    expect(readReport('{"pid":42,"created":"1x"}\n').target).toEqual({ spawning: false, pid: 42 });
    expect(readReport('ごみ\n[1]\n{"pid":-1}\n').invalid).toBe(true);
  });
  it('[REQ-254] 対象を起動したが PID を受け取れないときは、未確認として返す。起動の前に終わったときは後片付けをしない', () => {
    expect(stopTree({ spawning: true }, 'id', undefined)).toEqual({ confirmed: false, detail: '対象を起動したあと、PID を受け取る前に監視役が終わりました' });
    expect(stopTree({ spawning: false }, 'id', undefined)).toBeUndefined();
  });
});

describe('保持の期限', () => {
  it('[REQ-255] 対象の期限に、監視役の停止の猶予と後片付けの上限と余裕を足し、起動から決まった短い時間にしない', () => {
    expect(holdExpiry(1_000, 30_000)).toBe(1_000 + 30_000 + 2_000 + CLEANUP_LIMIT_MS + 5_000);
    // 長い品質コマンドの期限も覆う
    expect(holdExpiry(0, 3_600_000)).toBeGreaterThan(3_600_000 + CLEANUP_LIMIT_MS);
  });
});

describe('保持役の後片付けの判定', () => {
  it('[REQ-252][REQ-254][REQ-256] 識別した子孫がすべて止まり、新しい子孫のない探索を終えたら、停止を確認できたと返し、時間を残す', () => {
    const report = judgeHolderCleanup(reply({ records: [done(200, 100), done(300, 200)] }));
    expect(report).toEqual({ confirmed: true, detail: '子孫 2 個を止めました（探索 2 回、探索 60ms、停止 1ms、待機 1ms、保持役の中 63ms、合計 90ms）' });
    expect(judgeHolderCleanup(reply({ passes: 1 })).detail).toMatch(/^止める子孫はありませんでした/);
  });
  it('[REQ-252][REQ-255] 保持がなく対象の作成時刻を確かめられない、または作成時刻が合わないときは、何も止めずに未確認として返す', () => {
    expect(judgeHolderCleanup(reply({ target: 'no-hold' }))).toMatchObject({ confirmed: false, detail: expect.stringContaining('対象の保持がなく') });
    expect(judgeHolderCleanup(reply({ target: 'mismatch' }))).toMatchObject({ confirmed: false, detail: expect.stringContaining('作成時刻が監視役から受け取った値と合わない') });
    expect(judgeHolderCleanup({ output: {}, elapsedMs: 3 })).toMatchObject({ confirmed: false, detail: expect.stringContaining('後片付けの結果を読めません') });
  });
  it('[REQ-252] 親と同じ作成時刻の子は、止めずに理由として報告する', () => {
    const report = judgeHolderCleanup(reply({ records: [{ pid: 300, ppid: 100, created: '5', state: 'same-tick', opens: 1 }] }));
    expect(report.confirmed).toBe(false);
    expect(report.detail).toContain('PID 300 は作成時刻が親（PID 100）と同じで前後を決められないので止めていません');
  });
  it('[REQ-254] 権限不足で止められない子孫は、権限不足を理由とする未確認として返す', () => {
    const report = judgeHolderCleanup(reply({ records: [done(200, 100, { access: 'limited', action: 'skipped', reason: 'terminate:5', wait: 'timeout', stopHandle: undefined })] }));
    expect(report).toMatchObject({ confirmed: false, detail: expect.stringContaining('PID 200 は権限不足で止められません') });
    // TERMINATE の権限なしでしか開けなかったものは、終わっていても権限不足として未確認にする（A-05）
    const exited = judgeHolderCleanup(reply({ records: [done(200, 100, { access: 'limited', action: 'skipped', reason: 'terminate:5', wait: 'exited', stopHandle: undefined })] }));
    expect(exited).toMatchObject({ confirmed: false, detail: expect.stringContaining('PID 200 は権限不足で止められません') });
  });
  it('[REQ-252][REQ-254] 止めるのに失敗しても、同じハンドルの待機で終了を確かめられれば止まったとし、確かめられなければ未確認とする（A-05）', () => {
    expect(judgeHolderCleanup(reply({ records: [done(200, 100, { action: 'failed', reason: 'terminate:5', wait: 'exited' })] })).confirmed).toBe(true);
    const report = judgeHolderCleanup(reply({ records: [done(200, 100, { action: 'failed', reason: 'terminate:5', wait: 'timeout' })] }));
    expect(report).toMatchObject({ confirmed: false, detail: expect.stringContaining('PID 200 は止められず（terminate:5）、終了も確かめられません') });
    expect(judgeHolderCleanup(reply({ records: [done(200, 100, { wait: 'timeout' })] })).detail).toContain('PID 200 は後片付けの上限までに終わりません');
  });
  it('[REQ-253][REQ-254] 探し直しの途中で上限に達したら、時間切れとして未確認にする', () => {
    const report = judgeHolderCleanup(reply({ stable: false, records: [done(200, 100)] }));
    expect(report).toMatchObject({ confirmed: false, detail: expect.stringContaining('後片付けの上限に達したので、探し終えていません') });
  });
  it('[REQ-253][REQ-254] 一覧の取得に失敗したとき、保持役が応答しないときは、停止を確認できないと返す', () => {
    expect(judgeHolderCleanup(reply({ stable: false, error: 'enumerate:Access denied' })).detail).toContain('プロセスの一覧を取得できません（enumerate:Access denied）');
    expect(judgeHolderCleanup({ failure: '保持役が後片付けの上限（10 秒）までに応答しません', elapsedMs: 10_003 }))
      .toEqual({ confirmed: false, detail: '保持役が後片付けの上限（10 秒）までに応答しません（合計 10003ms）' });
  });
  it('[REQ-252] 列挙のあとに入れ替わった候補と、開けない候補は、止めずに判定にも使わない', () => {
    const report = judgeHolderCleanup(reply({ records: [{ pid: 7, state: 'replaced', created: '2', listed: '1', opens: 1 }, { pid: 8, state: 'unopenable', reason: 'open:5', opens: 1 }] }));
    expect(report.confirmed).toBe(true);
  });
  it('[REQ-252] 保持を確かめられない理由の符号を、利用者に見せる文にする', () => {
    expect(describeUnprotected('no-reply')).toBe('保持役の返事が間に合いません');
    expect(describeUnprotected('exited-first')).toBe('保持を確かめる前に対象が終わりました');
    expect(describeUnprotected('open:87')).toBe('保持役が対象を開けません（対象はもう終わっています）');
    expect(describeUnprotected('open:5')).toBe('保持役が対象を開けません（エラー 5）');
    expect(describeUnprotected('mystery')).toBe('mystery');
  });
  it('[REQ-250][REQ-254] 停止を確認できない中断は、停止を確認できた中断と理由で区別する', () => {
    const confirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: true, detail: '子孫 1 個を止めました' });
    const unconfirmed = missingResultError('lint', '', '', '終了コード 1', false, { confirmed: false, detail: '保持役が終わっています' });
    expect(confirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）');
    expect(unconfirmed.reason).toBe('監視役が結果を書かずに終了しました（終了コード 1）。子孫の停止を確認できません：保持役が終わっています');
    expect(unconfirmed.cleanup).toEqual({ confirmed: false, detail: '保持役が終わっています' });
    expect(missingResultError('lint', '', '', 'シグナル SIGKILL', true).reason).toBe('監視役の結果を解釈できません（シグナル SIGKILL）');
  });
});

/**
 * 差し替えた保持役。監視役とのパイプは、別のプロセスで動く偽の保持役（Unix ドメインソケット）が受ける。
 * runExternal は同期で監視役を待つので、同じプロセスの中では返事をできない
 */
async function fakeHolderServer(dir: string, mode: 'ok' | 'fail' | 'silent') {
  const socket = process.platform === 'win32' ? `\\\\.\\pipe\\loomake-fake-holder-${process.pid}-${Date.now()}` : join(dir, 'holder.sock');
  const script = join(dir, 'fake-holder.cjs');
  writeFileSync(script, `const net=require('node:net');const fs=require('node:fs');
const server=net.createServer((c)=>{let b='';c.on('data',(d)=>{b+=d;const i=b.indexOf('\\n');if(i<0)return;const r=JSON.parse(b.slice(0,i));
fs.appendFileSync(${JSON.stringify(join(dir, 'holds'))},JSON.stringify(r)+'\\n');
if(${JSON.stringify(mode)}==='ok')c.end(JSON.stringify({id:r.id,ok:true,created:'134000000000000000'})+'\\n');
else if(${JSON.stringify(mode)}==='fail')c.end(JSON.stringify({id:r.id,ok:false,err:5})+'\\n');});});
server.listen(${JSON.stringify(socket)},()=>console.log('listening'));setTimeout(()=>process.exit(0),60000);`);
  const child = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = '';
  child.stdout!.on('data', (d: Buffer) => { out += d.toString(); });
  expect(await waitFor(() => out.includes('listening'), 10_000)).toBe(true);
  const holds = () => (existsSync(join(dir, 'holds')) ? readFileSync(join(dir, 'holds'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { id: string; pid: number; expiresAt: number }) : []);
  return { socket, child, holds };
}
function recordingClient(prepare: ReturnType<HolderClient['prepare']>, result: HolderReply = reply({})) {
  const calls: (['prepare', number] | ['release', string] | ['cleanup', HolderCleanupRequest, number])[] = [];
  const client: HolderClient = {
    prepare(waitMs) { calls.push(['prepare', waitMs]); return prepare; },
    release(id) { calls.push(['release', id]); },
    cleanup(request, limitMs) { calls.push(['cleanup', request, limitMs]); return result; },
  };
  return { client, calls };
}
// 保持を確かめたあとに監視役を強制終了し、対象は 3 秒で自分で終わる（後片付けを差し替えるので、残さないため）
const killSupervisorLater = "setTimeout(()=>process.kill(process.ppid,'SIGKILL'),300);setTimeout(()=>{},3000)";

describe('差し替えた保持役との順序', () => {
  it('[REQ-255][REQ-257] 有効な通常の結果を読んだあとに保持を解放し、後片付けはしない。最初の外部操作では準備を最大 10 秒待つ', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder-test-')));
    const server = await fakeHolderServer(dir, 'ok');
    const { client, calls } = recordingClient({ pipe: server.socket });
    try {
      setHolderForTest(client);
      const result = withProcessBudget({ timeoutMs: 5_000 }, () => runExternal(process.execPath, ['-e', 'setTimeout(()=>{},200)']));
      expect(result.status).toBe(0);
      expect(calls[0]).toEqual(['prepare', HOLDER_START_LIMIT_MS]);
      const [hold] = server.holds();
      expect(hold).toBeDefined();
      expect(calls.slice(1)).toEqual([['release', hold!.id]]);
      // 保持の期限は、対象の期限と後片付けの上限を覆う
      expect(hold!.expiresAt).toBeGreaterThan(Date.now() + CLEANUP_LIMIT_MS);
    } finally {
      setHolderForTest(undefined);
      server.child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-255][REQ-250][REQ-253] 監視役が結果を書かずに終わったら、保持したまま後片付けを頼み、後片付けの上限を渡す。親は先に解放しない', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder-test-')));
    const server = await fakeHolderServer(dir, 'ok');
    const { client, calls } = recordingClient({ pipe: server.socket }, reply({ records: [done(300, 200)] }));
    const after = join(dir, 'after');
    try {
      setHolderForTest(client);
      withProcessBudget({ timeoutMs: 20_000 }, () => {
        let error: unknown;
        try { runExternal(process.execPath, ['-e', killSupervisorLater]); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('interrupted');
        // Windows では、強制終了した監視役の終わり方が終了コード 1 になる
        expect((error as ProcessLimitError).reason).toBe(`監視役が結果を書かずに終了しました（${process.platform === 'win32' ? '終了コード 1' : 'シグナル SIGKILL'}）`);
        expect((error as ProcessLimitError).cleanup?.confirmed).toBe(true);
        expect(() => runExternal(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`])).toThrow('中断');
      });
      const [hold] = server.holds();
      expect(calls.slice(1)).toEqual([['cleanup', { id: hold!.id, pid: hold!.pid, created: '134000000000000000' }, CLEANUP_LIMIT_MS]]);
      expect(existsSync(after)).toBe(false);
    } finally {
      try { process.kill(server.holds()[0]!.pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
      setHolderForTest(undefined);
      server.child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it.each([
    ['fail', '保持を確かめられないので、何も止めていません：保持役が対象を開けません（エラー 5）'],
    ['silent', '保持を確かめられないので、何も止めていません：保持役の返事が間に合いません'],
  ] as const)('[REQ-252] 保持役が対象を開けないか、返事が間に合わないと（%s）、何も止めずに未確認として返す', async (mode, detail) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder-test-')));
    const server = await fakeHolderServer(dir, mode);
    const { client, calls } = recordingClient({ pipe: server.socket });
    try {
      setHolderForTest(client);
      let error: unknown;
      try { runExternal(process.execPath, ['-e', "setTimeout(()=>process.kill(process.ppid,'SIGKILL'),1500);setInterval(()=>{},100)"]); } catch (e) { error = e; }
      expect((error as ProcessLimitError).cleanup).toEqual({ confirmed: false, detail });
      expect((error as ProcessLimitError).reason).toContain(`子孫の停止を確認できません：${detail}`);
      expect(calls.filter((c) => c[0] === 'cleanup')).toEqual([]);
      expect(calls.at(-1)).toEqual(['release', server.holds()[0]!.id]);
    } finally {
      try { process.kill(server.holds()[0]!.pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
      setHolderForTest(undefined);
      server.child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-252][REQ-257] 保持役の準備が間に合わなければ、保持役なしで起動し、監視役が終わったときは未確認として返す', () => {
    const { client, calls } = recordingClient({ unavailable: 'holder-not-ready' });
    try {
      setHolderForTest(client);
      let error: unknown;
      try { runExternal(process.execPath, ['-e', killSupervisorLater]); } catch (e) { error = e; }
      expect((error as ProcessLimitError).cleanup).toEqual({ confirmed: false, detail: '保持を確かめられないので、何も止めていません：保持役の準備が間に合いません' });
      expect(calls.filter((c) => c[0] === 'cleanup')).toEqual([]);
    } finally {
      setHolderForTest(undefined);
    }
  });
  it('[REQ-257] 最初の外部操作の準備の待ちは、操作の期限にも共有予算にも含めず、2 回目以降は待たない', () => {
    const calls: number[] = [];
    // 準備に 2.5 秒かかり、間に合わなかったことにする
    const client: HolderClient = {
      prepare(waitMs) { calls.push(waitMs); if (waitMs > 0) busyWait(2_500); return { unavailable: 'holder-not-ready' }; },
      release() { /* 保持していない */ },
      cleanup() { throw new Error('呼ばれない'); },
    };
    try {
      setHolderForTest(client);
      withProcessBudget({ timeoutMs: 2_000 }, () => {
        expect(runExternal(process.execPath, ['-e', 'setTimeout(()=>{},100)']).status).toBe(0);
        // 待った 2.5 秒を予算から引いていない
        expect(remainingProcessTime()!).toBeGreaterThan(500);
        expect(runExternal(process.execPath, ['-e', 'setTimeout(()=>{},100)']).status).toBe(0);
      });
      expect(calls).toEqual([HOLDER_START_LIMIT_MS, 0]);
      // 1 操作の期限（ここでは 2 秒）も、待った時間で使い切らない
      setHolderForTest(client);
      expect(runExternal(process.execPath, ['-e', 'setTimeout(()=>{},100)'], { timeoutMs: 2_000 }).status).toBe(0);
      expect(calls).toEqual([HOLDER_START_LIMIT_MS, 0, HOLDER_START_LIMIT_MS]);
    } finally {
      setHolderForTest(undefined);
    }
  });
  it('[REQ-257][REQ-180] 準備の待ちで、すでに使い切った予算を戻さない。残り時間がなければ監視役も対象も起動しない', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder-test-')));
    const started = join(dir, 'started');
    const calls: number[] = [];
    const client: HolderClient = {
      prepare(waitMs) { calls.push(waitMs); if (waitMs > 0) busyWait(1_000); return { unavailable: 'holder-not-ready' }; },
      release() { /* 保持していない */ },
      cleanup() { throw new Error('呼ばれない'); },
    };
    try {
      setHolderForTest(client);
      withProcessBudget({ timeoutMs: 300 }, () => {
        busyWait(400);
        let error: unknown;
        try { runExternal(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(started)},'x')`]); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('timeout');
        expect(remainingProcessTime()).toBe(0);
      });
      expect(existsSync(started)).toBe(false);
      // 使い切った予算の中で待ちを済ませたことにはしないので、次の操作が最初の待ちになる
      expect(runExternal(process.execPath, ['-e', 'setTimeout(()=>{},100)'], { timeoutMs: 2_000 }).status).toBe(0);
      expect(calls).toEqual([HOLDER_START_LIMIT_MS]);
    } finally {
      setHolderForTest(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-252][REQ-253][REQ-254] 後片付けで停止を確認できなくても中断として返し、同じ共有予算の次の操作を起動しない', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-orphans ')));
    const seen: number[] = [];
    try {
      setTreeCleanupForTest((target) => {
        seen.push(target.pid);
        // 試験の後片付けとして、残った対象を止めてから「確認できない」と返す
        if (process.platform !== 'win32') try { process.kill(-target.pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
        else try { process.kill(target.pid, 'SIGKILL'); } catch { /* すでに終わっている */ }
        return { confirmed: false, detail: '子孫を探せません：試験' };
      });
      const after = join(dir, 'after');
      withProcessBudget({ timeoutMs: 20_000 }, () => {
        let error: unknown;
        // Windows では保持を確かめてから PID を受け取るので、監視役を止める前に少し待つ
        try { runExternal(process.execPath, ['-e', "setTimeout(()=>process.kill(process.ppid,'SIGKILL'),300);setInterval(()=>{},100)"]); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('interrupted');
        expect((error as ProcessLimitError).reason).toContain('子孫の停止を確認できません：子孫を探せません：試験');
        expect(() => runExternal(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`])).toThrow('中断');
      });
      expect(existsSync(after)).toBe(false);
      expect(seen).toHaveLength(1);
    } finally {
      setTreeCleanupForTest(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- Windows の実際の保持役（非同期の待機で確かめる） ----

/** 試験から保持役のパイプへ保持を頼む（監視役と同じ形） */
async function askHold(pid: number, id: string, expiresAt = Date.now() + 120_000): Promise<{ ok: boolean; created?: string; err?: unknown }> {
  const prepared = windowsHolder.prepare(60_000);
  if (!('pipe' in prepared)) throw new Error(`保持役の準備ができません：${prepared.unavailable}`);
  return await new Promise((resolve, reject) => {
    const socket = connect(prepared.pipe);
    let buffer = '';
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`${JSON.stringify({ id, pid, expiresAt })}\n`));
    socket.on('data', (d) => { buffer += d.toString(); const i = buffer.indexOf('\n'); if (i >= 0) { socket.destroy(); resolve(JSON.parse(buffer.slice(0, i)) as { ok: boolean }); } });
  });
}
/** 子を 1 つ作って待つ対象。対象と子の PID を返す */
async function targetWithChild(dir: string, tag: string): Promise<{ target: ChildProcess; childPid: number }> {
  const file = join(dir, `${tag}-child`);
  const code = `const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid));setInterval(()=>{},100)`;
  const target = spawn(process.execPath, ['-e', code], { stdio: 'ignore' });
  expect(await waitFor(() => fileReady(file), 15_000)).toBe(true);
  return { target, childPid: Number(readFileSync(file, 'utf8')) };
}
function logCleanup(label: string, value: unknown) {
  // 10 秒の上限に対して各手順にかかった時間を CI の記録に残す
  console.info(`[REQ-253] ${label}：${JSON.stringify(value)}`);
}

/**
 * 作業用のディレクトリで親とやりとりする偽の保持役（windows-holder.ps1 と同じ形）。mode で振る舞いを変える。
 * ok：準備して頼みに答える。slow：準備しない。mute：準備するが頼みに答えない
 */
function fakeFileHolder(dir: string, mode: 'ok' | 'slow' | 'mute') {
  const script = join(dir, 'file-holder.cjs');
  writeFileSync(script, `const fs=require('node:fs');const path=require('node:path');const d=process.env.LOOMAKE_HOLDER_DIR;
const log=(o)=>fs.appendFileSync(path.join(${JSON.stringify(dir)},'requests'),JSON.stringify(o)+'\\n');
if(${JSON.stringify(mode)}!=='slow'){fs.writeFileSync(path.join(d,'ready.tmp'),'{}');fs.renameSync(path.join(d,'ready.tmp'),path.join(d,'ready'));}
setInterval(()=>{for(const f of fs.readdirSync(d)){if(!/^req-.*\\.json$/.test(f))continue;const r=JSON.parse(fs.readFileSync(path.join(d,f),'utf8'));fs.rmSync(path.join(d,f));log(r);
if(${JSON.stringify(mode)}!=='ok'||r.op==='release')continue;
const res=r.op==='state'?{holds:['kept']}:{target:'no-hold',passes:0,stable:false,records:[],timing:{enumerate:0,stop:0,wait:0,total:1}};
fs.writeFileSync(path.join(d,'tmp-'+f),JSON.stringify(res));fs.renameSync(path.join(d,'tmp-'+f),path.join(d,f.replace('req-','res-')));}},5);
process.stdin.on('end',()=>{fs.rmSync(d,{recursive:true,force:true});process.exit(0);});process.stdin.resume();`);
  setHolderCommandForTest({ command: process.execPath, args: [script] });
  const requests = () => (existsSync(join(dir, 'requests')) ? readFileSync(join(dir, 'requests'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>) : []);
  return { requests };
}

describe.runIf(process.platform !== 'win32')('作業用のディレクトリでの保持役とのやりとり', () => {
  it('[REQ-255][REQ-257] 保持役を起動して準備を待ち、解放・後片付け・状態の問い合わせを頼み、親が閉じると保持役は終わる', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-file-holder-')));
    const { requests } = fakeFileHolder(dir, 'ok');
    try {
      const prepared = windowsHolder.prepare(10_000);
      expect(prepared).toMatchObject({ pipe: expect.stringMatching(/^\\\\\.\\pipe\\loomake-holder-[0-9a-f]{32}$/) });
      // 2 回目は同じ保持役を使い、待たない
      expect(windowsHolder.prepare(0)).toEqual(prepared);
      windowsHolder.release('done');
      const reply = windowsHolder.cleanup({ id: 'gone', pid: 1, created: '5' }, CLEANUP_LIMIT_MS);
      expect(judgeHolderCleanup(reply)).toMatchObject({ confirmed: false, detail: expect.stringContaining('対象の保持がなく') });
      expect(windowsHolderStateForTest()).toEqual(['kept']);
      expect(requests().map((r) => r.op)).toEqual(['release', 'cleanup', 'state']);
      expect(requests()[1]).toMatchObject({ id: 'gone', pid: 1, created: '5', deadlineMs: expect.any(Number) });
      const pid = closeWindowsHolderForTest()!;
      expect(await waitFor(() => !alive(pid), 5_000)).toBe(true);
      // 保持役が終わったあとの頼みは、送らずに終わっていると返す
      windowsHolder.release('late');
      expect(windowsHolderStateForTest()).toBeUndefined();
      expect(judgeHolderCleanup(windowsHolder.cleanup({ id: 'late', pid: 1, created: '5' }, CLEANUP_LIMIT_MS)).detail).toContain('保持役が終わっています');
    } finally {
      closeWindowsHolderForTest();
      setHolderCommandForTest(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-257][REQ-253] 保持役の準備が上限に間に合わなければ使えないと返し、後片付けに答えなければ上限で打ち切る', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-file-holder-')));
    try {
      fakeFileHolder(dir, 'slow');
      expect(windowsHolder.prepare(300)).toEqual({ unavailable: 'holder-not-ready' });
      const slow = closeWindowsHolderForTest()!;
      expect(await waitFor(() => !alive(slow), 5_000)).toBe(true);

      fakeFileHolder(dir, 'mute');
      expect(windowsHolder.prepare(10_000)).toHaveProperty('pipe');
      const started = Date.now();
      const report = judgeHolderCleanup(windowsHolder.cleanup({ id: 'mute', pid: 1, created: '5' }, 300));
      expect(report).toMatchObject({ confirmed: false, detail: expect.stringContaining('後片付けの上限（0.3 秒）までに応答しません') });
      expect(Date.now() - started).toBeLessThan(3_000);
      expect(windowsHolderStateForTest(300)).toBeUndefined();
    } finally {
      closeWindowsHolderForTest();
      setHolderCommandForTest(undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-257] 保持役を起動できなければ、準備できないと返す', async () => {
    setHolderCommandForTest({ command: join(tmpdir(), 'loomake-no-such-holder'), args: [] });
    try {
      const result = windowsHolder.prepare(300);
      expect(result).toHaveProperty('unavailable');
      expect(['holder-spawn', 'holder-not-ready', 'holder-exited']).toContain((result as { unavailable: string }).unavailable);
      await sleep(50);
    } finally {
      closeWindowsHolderForTest();
      setHolderCommandForTest(undefined);
    }
  });
  it('[REQ-257] Windows 以外では、試験の準備で保持役を起動しない', () => {
    expect(prepareWindowsHolder()).toBe(false);
  });
});

describe.runIf(process.platform === 'win32')('Windows の実際の保持役', () => {
  it('[REQ-250][REQ-252][REQ-256] cmd.exe → 品質コマンド → さらに子で監視役が強制終了したら、保持中の対象から 2 段をたどって止め、停止を確認できた中断として返す', async () => {
    expect(prepareWindowsHolder()).toBe(true);
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder ')));
    const qualityFile = join(dir, 'quality');
    const leafFile = join(dir, 'leaf');
    const script = join(dir, 'quality.cjs');
    // 品質コマンドは子を作り、cmd.exe の親（監視役）を PowerShell で探して強制終了する
    writeFileSync(script, `const fs=require('node:fs');const cp=require('node:child_process');
cp.spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},100)",${JSON.stringify(leafFile)}],{stdio:'ignore'});
fs.writeFileSync(${JSON.stringify(qualityFile)},String(process.pid));
const sup=Number(cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','(Get-CimInstance Win32_Process -Filter "ProcessId='+process.ppid+'").ParentProcessId'],{encoding:'utf8',windowsHide:true}).stdout.trim());
const until=Date.now()+15000;while(!fs.existsSync(${JSON.stringify(leafFile)})&&Date.now()<until){}
process.kill(sup,'SIGKILL');setInterval(()=>{},100);`);
    let error: unknown;
    try {
      const started = Date.now();
      try { withProcessBudget({ timeoutMs: 40_000 }, () => runExternal(`"${process.execPath}" "${script}"`, [], { shell: true })); } catch (e) { error = e; }
      logCleanup('cmd.exe を経た後片付け', { ms: Date.now() - started, error: String(error), cleanup: (error as ProcessLimitError).cleanup });
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect((error as ProcessLimitError).cleanup?.confirmed, (error as ProcessLimitError).cleanup?.detail).toBe(true);
      expect((error as ProcessLimitError).reason).not.toContain('確認できません');
      expect(await waitFor(() => !alive(Number(readFileSync(qualityFile, 'utf8'))) && !alive(Number(readFileSync(leafFile, 'utf8'))), 2_000)).toBe(true);
      // 後片付けのあと、保持は残らない
      expect(windowsHolderStateForTest()).toEqual([]);
    } finally {
      for (const f of [qualityFile, leafFile]) if (fileReady(f)) try { process.kill(Number(readFileSync(f, 'utf8')), 'SIGKILL'); } catch { /* */ }
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-252] P1 の順：保持のない PID を対象として後片付けすると、作成時刻を確かめられないので何も止めず、未確認として返す', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder ')));
    const { target, childPid } = await targetWithChild(dir, 'p1');
    try {
      expect(prepareWindowsHolder()).toBe(true);
      const result = windowsHolder.cleanup({ id: 'never-held', pid: target.pid!, created: '1' }, CLEANUP_LIMIT_MS);
      logCleanup('保持のない後片付け', result);
      expect(judgeHolderCleanup(result)).toMatchObject({ confirmed: false, detail: expect.stringContaining('対象の保持がなく') });
      expect(alive(target.pid!)).toBe(true);
      expect(alive(childPid)).toBe(true);
    } finally {
      try { process.kill(childPid, 'SIGKILL'); } catch { /* */ }
      target.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-252][REQ-256] 入れ替わった候補は止めず、識別した子孫は 1 回だけ開いたハンドルで識別・停止・待機する', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder ')));
    const first = await targetWithChild(dir, 'swap');
    const second = await targetWithChild(dir, 'same');
    try {
      const held = await askHold(first.target.pid!, 'swap');
      expect(held.ok).toBe(true);
      const swapped = windowsHolder.cleanup({ id: 'swap', pid: first.target.pid!, created: held.created!, candidates: [{ pid: first.childPid, created: '1' }] }, CLEANUP_LIMIT_MS);
      logCleanup('入れ替わった候補', swapped);
      expect('output' in swapped && swapped.output.records?.find((r) => r.pid === first.childPid)).toMatchObject({ state: 'replaced', opens: 1 });
      expect(alive(first.childPid)).toBe(true);

      const held2 = await askHold(second.target.pid!, 'same');
      expect(held2.ok).toBe(true);
      const result = windowsHolder.cleanup({ id: 'same', pid: second.target.pid!, created: held2.created! }, CLEANUP_LIMIT_MS);
      logCleanup('同じハンドル', result);
      expect(judgeHolderCleanup(result).confirmed, judgeHolderCleanup(result).detail).toBe(true);
      const record = 'output' in result ? result.output.records?.find((r) => r.pid === second.childPid) : undefined;
      expect(record).toMatchObject({ state: 'descendant', opens: 1, wait: 'exited' });
      expect(record!.stopHandle).toBe(record!.handle);
      expect(record!.waitHandle).toBe(record!.handle);
      expect(await waitFor(() => !alive(second.childPid), 2_000)).toBe(true);
    } finally {
      for (const t of [first, second]) { try { process.kill(t.childPid, 'SIGKILL'); } catch { /* */ } t.target.kill('SIGKILL'); }
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-252][REQ-254] 開けない候補は、止めずに理由つきで記録する', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder ')));
    const t = await targetWithChild(dir, 'open');
    try {
      const held = await askHold(t.target.pid!, 'open');
      // 使われていない PID は開けない（管理者で動く CI では、System の PID 4 も開けることがある）
      const unused = 2_147_483_644;
      const result = windowsHolder.cleanup({ id: 'open', pid: t.target.pid!, created: held.created!, candidates: [{ pid: unused }] }, CLEANUP_LIMIT_MS);
      logCleanup('開けない候補', result);
      expect('output' in result && result.output.records?.find((r) => r.pid === unused)).toMatchObject({ state: 'unopenable', reason: expect.stringMatching(/^open:/) });
    } finally {
      try { process.kill(t.childPid, 'SIGKILL'); } catch { /* */ }
      t.target.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-253][REQ-254] 上限を短くすると打ち切り、停止を確認できないと返す', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-holder ')));
    const t = await targetWithChild(dir, 'short');
    try {
      const held = await askHold(t.target.pid!, 'short');
      const started = Date.now();
      const report = judgeHolderCleanup(windowsHolder.cleanup({ id: 'short', pid: t.target.pid!, created: held.created! }, 1));
      logCleanup('短い上限', report);
      expect(report.confirmed).toBe(false);
      expect(report.detail).toMatch(/上限/);
      expect(Date.now() - started).toBeLessThan(3_000);
    } finally {
      try { process.kill(t.childPid, 'SIGKILL'); } catch { /* */ }
      t.target.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('[REQ-255] 通常の結果のあとの解放と期限切れで、保持は残らない', async () => {
    expect(prepareWindowsHolder()).toBe(true);
    expect(runExternal(process.execPath, ['-e', 'setTimeout(()=>{},300)']).status).toBe(0);
    expect(await waitFor(() => (windowsHolderStateForTest() ?? ['?']).length === 0, 5_000)).toBe(true);
    const t = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { stdio: 'ignore' });
    try {
      expect((await askHold(t.pid!, 'expiry', Date.now() + 300)).ok).toBe(true);
      let state: string[] | undefined;
      const released = await waitFor(() => { state = windowsHolderStateForTest(); return state !== undefined && !state.includes('expiry'); }, 10_000);
      expect(released, `保持役の状態：${JSON.stringify(state)}`).toBe(true);
    } finally { t.kill('SIGKILL'); }
  });
  it('[REQ-255] 親が終わったとき（stdin の EOF）と保持役が強制終了したとき、保持役は残らず、後片付けは未確認になる', async () => {
    const t = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { stdio: 'ignore' });
    try {
      expect((await askHold(t.pid!, 'eof')).ok).toBe(true);
      const holderPid = closeWindowsHolderForTest()!;
      expect(await waitFor(() => !alive(holderPid), 5_000)).toBe(true);
      // 次の操作では起動し直す
      expect(prepareWindowsHolder()).toBe(true);
      const held = await askHold(t.pid!, 'killed');
      expect(held.ok).toBe(true);
      const pid = closeWindowsHolderForTest()!;
      process.kill(pid, 'SIGKILL');
      expect(await waitFor(() => !alive(pid), 5_000)).toBe(true);
      expect(judgeHolderCleanup(windowsHolder.cleanup({ id: 'killed', pid: t.pid!, created: held.created! }, CLEANUP_LIMIT_MS)))
        .toMatchObject({ confirmed: false, detail: expect.stringContaining('保持役が終わっています') });
    } finally {
      t.kill('SIGKILL');
      prepareWindowsHolder();
    }
  });
});
