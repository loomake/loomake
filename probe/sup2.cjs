'use strict';
// PROBE (throwaway, do not merge): a stand-in for supervisor.cjs with the B-3 hold handshake (design.md の「保持の手順と順序」).
// The parent runs this with spawnSync, so the parent's event loop is blocked for the whole run (as in runExternal).
// modes: normal | die-after-protected (SIGKILL itself after the hold is confirmed and cfg.waitFiles exist)
const net = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const cfg = JSON.parse(process.argv[2]);
const out = (o) => { try { fs.writeSync(3, `${JSON.stringify(o)}\n`); } catch { /* parent gone */ } };
const sock = net.connect(`\\\\.\\pipe\\${cfg.pipe}`);
sock.on('error', (e) => out({ pipeError: e.message }));
sock.on('connect', () => {
  out({ spawning: true });
  const t0 = process.hrtime.bigint();
  const child = spawn(cfg.command, [], { shell: true, stdio: ['ignore', 'ignore', 'ignore'] });
  let exited = false;
  child.on('exit', () => { exited = true; });
  sock.write(`${JSON.stringify({ id: cfg.id, pid: child.pid, expiresAt: cfg.expiresAt })}\n`);
  let answered = false;
  const timer = setTimeout(() => { if (!answered) { answered = true; out({ pid: child.pid, unprotected: 'no-reply-1s' }); } }, 1000);
  let buf = '';
  sock.on('data', (d) => {
    buf += d;
    const i = buf.indexOf('\n');
    if (i < 0 || answered) return;
    answered = true; clearTimeout(timer);
    const r = JSON.parse(buf.slice(0, i));
    const holdMs = Number(process.hrtime.bigint() - t0) / 1e6;
    if (r.ok && !exited) out({ pid: child.pid, created: r.created, holdMs });
    else out({ pid: child.pid, unprotected: r.ok ? 'exited-first' : `open:${r.err}`, holdMs });
    sock.end();
    if (cfg.mode === 'die-after-protected' && r.ok && !exited) {
      const until = Date.now() + 20_000;
      const tick = () => {
        if ((cfg.waitFiles ?? []).every((f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8')) || Date.now() > until) process.kill(process.pid, 'SIGKILL');
        else setTimeout(tick, 20);
      };
      tick();
    }
  });
  child.on('close', (status) => { out({ status }); setTimeout(() => process.exit(0), 50); });
});
