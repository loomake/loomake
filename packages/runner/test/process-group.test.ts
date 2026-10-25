import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GROUP_EXIT_TIMEOUT_MS, activeGroupMembers, waitForGroupExit } from '../src/process-group.js';

/** 独立したプロセスグループで動く子を起動し、起動の合図を待つ */
async function groupLeader(source: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['-e', `${source}\nprocess.stdout.write('ready');`], { stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  await once(child.stdout!, 'data');
  return child;
}
const idle = 'setInterval(() => {}, 1000);';
const platforms: NodeJS.Platform[] = process.platform === 'linux' ? ['linux', 'darwin'] : [process.platform];
/** ps の代わりに使う、5 秒止まってから何も返さないスクリプトを作る。exec で置き換えるので、強制終了で孤児は残らない */
function slowPs(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-slow-ps-'));
  const path = join(dir, 'ps');
  writeFileSync(path, '#!/bin/sh\nexec sleep 5\n');
  chmodSync(path, 0o755);
  return { path, cleanup: () => { rmSync(dir, { recursive: true, force: true }); } };
}

describe.runIf(process.platform !== 'win32')('同じプロセスグループの後処理の待機', () => {
  const children: ChildProcess[] = [];
  afterEach(async () => {
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
    }
  });

  // Linux では /proc と ps の両方の経路を試す。ps の先頭文字の意味は macOS でも同じだが、macOS 自体では実行していない
  it.each(platforms)('[REQ-212] %s の判定は、動作中の子を数え、強制終了して回収したあとは数えない', async (platform) => {
    const child = await groupLeader(idle);
    children.push(child);
    expect(activeGroupMembers(child.pid!, platform)).toEqual([child.pid]);
    child.kill('SIGKILL');
    await once(child, 'exit');
    expect(activeGroupMembers(child.pid!, platform)).toEqual([]);
  });

  it.each(platforms)('[REQ-212] %s の判定は、回収されていないゾンビを動作中と数えない', async (platform) => {
    // 子は孫を起動したあと SIGCHLD を処理できないので、終わった孫はゾンビのまま同じグループに残る
    const child = await groupLeader(`const grandchild = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 200)']);
process.stdout.write('ready');
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);`);
    children.push(child);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(activeGroupMembers(child.pid!, platform)).toEqual([child.pid]);
  });

  it('[REQ-212] 待機は、動作中のメンバーが終了するまで戻らず、戻った時点でメンバーは動作していない', async () => {
    const child = await groupLeader(idle);
    children.push(child);
    setTimeout(() => child.kill('SIGKILL'), 150);
    const started = Date.now();
    const settled = await waitForGroupExit(child.pid!, { timeoutMs: 2000 });
    expect(settled).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    expect(activeGroupMembers(child.pid!)).toEqual([]);
  });

  it('[REQ-212] 待機は、上限までにメンバーが終了しなければ false を返して戻る', async () => {
    const child = await groupLeader(idle);
    children.push(child);
    const started = Date.now();
    expect(await waitForGroupExit(child.pid!, { timeoutMs: 100 })).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(activeGroupMembers(child.pid!)).toEqual([child.pid]);
  });

  // macOS 等の ps 経路でも、グループの確認を含めた待機の経過時間が上限に従うことを、遅い ps を差し替えて確かめる
  it('[REQ-212] 待機は、グループの確認に使う ps が止まっていても、上限までに false を返して戻る', async () => {
    const ps = slowPs();
    const child = await groupLeader(idle);
    children.push(child);
    try {
      const started = Date.now();
      expect(await waitForGroupExit(child.pid!, { timeoutMs: 300, platform: 'darwin', psCommand: ps.path })).toBe(false);
      expect(Date.now() - started).toBeLessThan(500);
    } finally {
      ps.cleanup();
    }
  });

  it('[REQ-212] 待機は、期限を過ぎてから届いた「動作中のメンバーなし」の確認結果を採用せず false を返す', async () => {
    // ps が止まったまま期限を迎え、存否の確認がグループの消滅を返しても、期限内に確認できたとは扱わない
    const ps = slowPs();
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore', detached: true });
    await once(child, 'exit');
    try {
      const started = Date.now();
      expect(await waitForGroupExit(child.pid!, { timeoutMs: 300, platform: 'darwin', psCommand: ps.path })).toBe(false);
      expect(Date.now() - started).toBeLessThan(500);
    } finally {
      ps.cleanup();
    }
  });

  it('[REQ-212] 待機の上限の既定値は、仕様どおり 1000ms である', () => {
    expect(GROUP_EXIT_TIMEOUT_MS).toBe(1000);
  });

  it('[REQ-212] 存在しないグループの待機はすぐに戻る', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore', detached: true });
    await once(child, 'exit');
    expect(await waitForGroupExit(child.pid!, { timeoutMs: 1000 })).toBe(true);
  });
});
