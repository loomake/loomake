'use strict';
// PROBE (throwaway): a stand-in for supervisor.cjs with the B-3 hold handshake. Writes JSON lines to fd 3.
// modes: normal | die-before-send | block-before-reply | block-target-exit | send-after-exit
const net = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const cfg = JSON.parse(process.argv[2]);
const out = (o) => { try { fs.writeSync(3, `${JSON.stringify(o)}\n`); } catch { /* parent gone */ } };
const block = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const sock = net.connect(`\\\\.\\pipe\\${cfg.pipe}`);
sock.on('error', (e) => out({ pipeError: e.message }));
sock.on('connect', () => {
  out({ spawning: true });
  const t0 = process.hrtime.bigint();
  const child = spawn(cfg.command, [], { shell: true, stdio: ['ignore', 'ignore', 'ignore'] });
  let exited = false;
  child.on('exit', (status) => { exited = true; out({ targetExit: status }); });
  if (cfg.mode === 'die-before-send') process.kill(process.pid, 'SIGKILL');
  const send = () => sock.write(`${JSON.stringify({ id: cfg.id, pid: child.pid, expiresAt: cfg.expiresAt })}\n`);
  if (cfg.mode === 'block-target-exit') block(1500); // target exits while the event loop cannot run 'exit'
  if (cfg.mode === 'file-hold-blocked' || cfg.mode === 'file-hold-after-exit') {
    // the request goes through a file written synchronously, so the holder opens the PID while this event loop is still blocked
    const ask = () => {
      const req = `${cfg.dir}\\req-sup-${cfg.id}.json`;
      fs.writeFileSync(`${req}.tmp`, JSON.stringify({ op: 'hold', id: cfg.id, pid: child.pid, expiresAt: cfg.expiresAt }));
      fs.renameSync(`${req}.tmp`, req);
      const res = `${cfg.dir}\\res-sup-${cfg.id}.json`;
      const until = Date.now() + 5000;
      while (!fs.existsSync(res) && Date.now() < until) block(10);
      out({ pid: child.pid, fileReply: fs.existsSync(res) ? JSON.parse(fs.readFileSync(res, 'utf8')) : null, exitedBeforeReply: exited });
    };
    if (cfg.mode === 'file-hold-blocked') { block(1500); ask(); } else child.once('exit', () => setTimeout(ask, 300));
    child.on('close', (status) => { out({ status }); setTimeout(() => process.exit(0), 50); });
    return;
  }
  if (cfg.mode === 'send-after-exit') child.once('exit', () => setTimeout(send, 300)); else send();
  if (cfg.mode === 'block-before-reply') block(60_000);
  let buf = '';
  sock.on('data', (d) => {
    buf += d;
    const i = buf.indexOf('\n');
    if (i < 0) return;
    const r = JSON.parse(buf.slice(0, i));
    const holdMs = Number(process.hrtime.bigint() - t0) / 1e6;
    out({ pid: child.pid, reply: r, exitedBeforeReply: exited, holdMs, protected: Boolean(r.ok && !exited) });
    replied = true;
    sock.end();
    done();
  });
  let replied = false;
  let closed = false;
  const done = () => { if (closed && replied) setTimeout(() => process.exit(0), 50); };
  sock.on('close', () => { replied = true; done(); });
  child.on('close', (status) => { out({ status }); closed = true; done(); });
});
