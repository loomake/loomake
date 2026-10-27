'use strict';
const T = { boot: Date.now() }; // PROBE（使い捨て）
// runExternal が起動する監視役。対象のコマンドを新しいプロセスグループで動かし、期限・出力の上限・中断で子孫ごと止める。
// 対象の stdout・stderr はそのまま流し、結果（終了コード・シグナル・止めた理由）は fd 3 に JSON で書く。
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');

const [command, args, shell, deadline, limit] = JSON.parse(process.argv[2]);
const remainingMs = () => deadline - Number(process.hrtime.bigint()) / 1_000_000;
process.title = 'loomake: command supervisor';
const win = process.platform === 'win32';
let child, timer, grace;
let count = 0;
let stopping = false;
let ended = false;
let exited = false;
const outcome = { status: null, signal: null };

function kill(signal) {
  if (!child || !child.pid) return;
  if (win) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 1000, killSignal: 'SIGKILL' });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    // すでに終了したプロセスグループは停止済みとして扱う
  }
}

// 出力を流し終えてから結果を書いて終わる
function finish() {
  if (ended) return;
  ended = true;
  T.finish = Date.now(); // PROBE
  clearTimeout(timer);
  clearTimeout(grace);
  let pending = 2;
  const flushed = () => {
    if (--pending === 0) {
      T.flushed = Date.now(); outcome.t = T; // PROBE
      fs.writeSync(3, JSON.stringify(outcome));
      process.exit(0);
    }
  };
  process.stdout.end(flushed);
  process.stderr.end(flushed);
}

function stop(kind) {
  if (stopping || ended) return;
  stopping = true;
  outcome.kind = kind;
  clearTimeout(timer);
  kill('SIGTERM');
  // SIGKILL のあと、子の終了を最大 1 秒待ってから結果を返し、止めた子が残ったまま返さない
  grace = setTimeout(() => {
    kill('SIGKILL');
    if (exited || !child) {
      finish();
      return;
    }
    child.once('exit', finish);
    setTimeout(finish, 1000);
  }, 250);
}

function watchDeadline() {
  if (stopping || ended) return;
  const remaining = remainingMs();
  if (remaining <= 0) {
    stop('timeout');
    return;
  }
  timer = setTimeout(watchDeadline, Math.min(remaining, 2_147_483_647));
}

process.on('SIGINT', () => stop('interrupted'));
process.on('SIGTERM', () => stop('interrupted'));

try {
  if (remainingMs() <= 0) {
    outcome.kind = 'timeout';
    finish();
  } else {
    T.spawn = Date.now(); // PROBE
    child = spawn(command, args, { shell, stdio: ['ignore', 'pipe', 'pipe'], detached: !win });
    T.spawned = Date.now(); // PROBE
    // 合計の上限までだけを流し、超えたら止める
    const forward = (target, data) => {
      if (T.firstData === undefined) T.firstData = Date.now(); // PROBE
      T.lastData = Date.now(); // PROBE
      if (stopping) return;
      const room = Math.max(0, limit - count);
      const part = data.subarray(0, room);
      if (part.length) target.write(part);
      count += data.length;
      if (count > limit) stop('output');
    };
    child.stdout.on('data', (data) => forward(process.stdout, data));
    child.stderr.on('data', (data) => forward(process.stderr, data));
    child.on('error', (error) => {
      outcome.error = { message: error.message, code: error.code };
      finish();
    });
    child.on('exit', (status, signal) => {
      exited = true;
      T.exit = Date.now(); // PROBE
      outcome.status = status;
      outcome.signal = signal;
      T.killStart = Date.now(); // PROBE
      if (!stopping) kill('SIGKILL');
      T.killEnd = Date.now(); // PROBE
    });
    child.on('close', () => {
      T.close = Date.now(); // PROBE
      if (!stopping) finish();
    });
    // close が来なくても、通常終了後のグループを片付けて待機を終える
    child.on('exit', () => {
      if (!stopping) grace = setTimeout(finish, 250);
    });
    watchDeadline();
  }
} catch (error) {
  outcome.error = { message: error.message, code: error.code };
  finish();
}
