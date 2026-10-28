'use strict';
// runExternal が起動する監視役。対象のコマンドを新しいプロセスグループで動かし、期限・出力の上限・中断で子孫ごと止める。
// 対象の stdout・stderr はそのまま流す。fd 3 には、対象を起動する直前にそのことを、起動した直後に対象の PID の行を、最後に結果（終了コード・シグナル・止めた理由）を JSON で書く。
// 親が保持役（windows-holder.ps1）を渡したときは、対象を起動した直後に保持役へ PID を送り、保持を確かめてから PID と作成時刻を書く（REQ-252）。
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');

const [command, args, shell, deadline, limit, hold] = JSON.parse(process.argv[2]);
/** 保持役の返事を待つ上限（design.md の「保持の手順と順序」） */
const HOLD_REPLY_MS = 1000;
const remainingMs = () => deadline - Number(process.hrtime.bigint()) / 1_000_000;
process.title = 'loomake: command supervisor';
const win = process.platform === 'win32';
let child, timer, grace;
let count = 0;
let stopping = false;
let ended = false;
let exited = false;
let started = false;
const outcome = { status: null, signal: null };
const line = (value) => fs.writeSync(3, `${JSON.stringify(value)}\n`);
// 対象の PID の行。保持を確かめる前に結果を書くときは、保持を確かめられないこととして先に書く
let pidLine;
function writePid(value) {
  if (pidLine) return;
  pidLine = value;
  line(value);
}

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
  clearTimeout(timer);
  clearTimeout(grace);
  let pending = 2;
  if (child && child.pid && !pidLine) writePid({ pid: child.pid, unprotected: 'no-reply' });
  const flushed = () => {
    if (--pending === 0) {
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

/** 保持役に対象の PID を送り、返事を受け取った時点で対象の exit をまだ処理していなければ、保持を確かめたとする */
function askHold(socket) {
  let buffer = '';
  const timer = setTimeout(() => done({ pid: child.pid, unprotected: 'no-reply' }), HOLD_REPLY_MS);
  function done(value) {
    clearTimeout(timer);
    writePid(value);
    socket.destroy();
  }
  socket.on('data', (data) => {
    buffer += data.toString('utf8');
    const end = buffer.indexOf('\n');
    if (end < 0) return;
    let reply;
    try { reply = JSON.parse(buffer.slice(0, end)); } catch { reply = undefined; }
    if (!reply || typeof reply !== 'object') done({ pid: child.pid, unprotected: 'invalid-reply' });
    else if (reply.ok === true && typeof reply.created === 'string' && /^\d+$/.test(reply.created) && !exited) done({ pid: child.pid, created: reply.created });
    else if (reply.ok === true) done({ pid: child.pid, unprotected: exited ? 'exited-first' : 'invalid-reply' });
    else done({ pid: child.pid, unprotected: `open:${String(reply.err)}` });
  });
  socket.on('error', () => done({ pid: child.pid, unprotected: 'disconnected' }));
  socket.on('close', () => done({ pid: child.pid, unprotected: 'disconnected' }));
  socket.write(`${JSON.stringify({ id: hold.id, pid: child.pid, expiresAt: hold.expiresAt })}\n`);
}

function start(socket, problem) {
  if (started || stopping || ended) {
    if (socket) socket.destroy();
    if (!started && !ended) finish();
    return;
  }
  started = true;
  try {
    if (remainingMs() <= 0) {
      if (socket) socket.destroy();
      outcome.kind = 'timeout';
      finish();
      return;
    }
    // 対象を起動する前に監視役が終わったのか、起動したあとに PID を渡す前に終わったのかを、親が区別できるようにする（REQ-254）
    line({ spawning: true });
    child = spawn(command, args, { shell, stdio: ['ignore', 'pipe', 'pipe'], detached: !win });
    // 対象の exit の処理は、保持役の返事より前に登録する。返事より先に exit を処理したら、保持を確かめたとしない
    child.on('exit', (status, signal) => {
      exited = true;
      outcome.status = status;
      outcome.signal = signal;
      if (!stopping) kill('SIGKILL');
    });
    // 監視役が結果を書かずに終わっても親が子孫を止められるよう、対象の PID を先に 1 行で渡す（REQ-250）
    if (child.pid) {
      if (socket) askHold(socket);
      else if (hold) writePid({ pid: child.pid, unprotected: problem ?? 'no-holder' });
      else writePid({ pid: child.pid });
    } else if (socket) socket.destroy();
    // 合計の上限までだけを流し、超えたら止める
    const forward = (target, data) => {
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
    child.on('close', () => {
      if (!stopping) finish();
    });
    // close が来なくても、通常終了後のグループを片付けて待機を終える
    child.on('exit', () => {
      if (!stopping) grace = setTimeout(finish, 250);
    });
    watchDeadline();
  } catch (error) {
    outcome.error = { message: error.message, code: error.code };
    finish();
  }
}

if (hold && typeof hold.pipe === 'string') {
  // 対象を起動する前に保持役のパイプにつなぐ。つなげなければ保持役なしで起動し、後片付けは未確認になる
  const socket = net.connect(hold.pipe);
  const timer = setTimeout(() => { socket.destroy(); start(undefined, 'connect-timeout'); }, HOLD_REPLY_MS);
  socket.once('connect', () => { clearTimeout(timer); start(socket); });
  socket.once('error', () => { clearTimeout(timer); start(undefined, 'connect'); });
} else start(undefined, hold && typeof hold.unavailable === 'string' ? hold.unavailable : undefined);
