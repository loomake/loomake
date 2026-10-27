// PROBE (throwaway, do not merge): PR #22 tasks 3.3 の補い。B-3 の保持役を、runExternal と同じ同期の親から使う。
// The parent waits for ready, runs the supervisor with spawnSync and asks the holder to release / clean up with
// synchronous file requests (Atomics.wait), so its own event loop never runs during an operation.
// Each result is one JSON line on stdout and in LOOMAKE_PROBE_OUT.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const HOLDER = here('./holder.ps1');
const SUP = here('./sup2.cjs');
const out = process.env.LOOMAKE_PROBE_OUT;
const log = (o) => { const line = JSON.stringify(o); console.log(line); if (out) appendFileSync(out, line + '\n'); };
const block = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const waitSync = (check, ms) => { const until = Date.now() + ms; for (;;) { if (check()) return true; if (Date.now() > until) return false; block(5); } };
const ps = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HOLDER];
const base = mkdtempSync(join(tmpdir(), 'holder-sync-'));

function startHolder(tag) {
  const dir = mkdtempSync(join(base, `${tag}-`));
  const pipe = `loomake-holder-${randomBytes(16).toString('hex')}`;
  const started = Date.now();
  // product shape: stdin is a pipe (EOF = parent gone), stdout / stderr are discarded, windowsHide
  const child = spawn('powershell.exe', ps, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true, env: { ...process.env, HOLDER_DIR: dir, HOLDER_PIPE: pipe } });
  return { child, dir, pipe, started, n: 0 };
}
function readySync(h, ms) {
  const ok = waitSync(() => existsSync(join(h.dir, 'ready')), ms);
  return { ok, waitMs: Date.now() - h.started, inner: ok ? JSON.parse(readFileSync(join(h.dir, 'ready'), 'utf8')) : undefined };
}
function requestSync(h, body, ms) {
  const n = ++h.n;
  const tmp = join(h.dir, `tmp-${n}`);
  writeFileSync(tmp, JSON.stringify(body));
  const t0 = Date.now();
  renameSync(tmp, join(h.dir, `req-${n}.json`));
  const res = join(h.dir, `res-${n}.json`);
  const ok = waitSync(() => existsSync(res), ms);
  return { ok, ms: Date.now() - t0, value: ok ? JSON.parse(readFileSync(res, 'utf8')) : undefined };
}
function holderLog(h) { const f = join(h.dir, 'holder.log'); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; }
function check(pid) {
  const r = spawnSync('powershell.exe', ps, { encoding: 'utf8', windowsHide: true, timeout: 20_000, env: { ...process.env, HOLDER_MODE: 'check', CHECK_PID: String(pid) } });
  try { return JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { return { raw: r.stdout }; }
}
/** spawnSync the supervisor stand-in; returns the fd 3 records */
function runSupSync(h, id, command, extra = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [SUP, JSON.stringify({ pipe: h.pipe, id, command, expiresAt: Date.now() + 120_000, ...extra })], { stdio: ['ignore', 'ignore', 'inherit', 'pipe'], timeout: 60_000 });
  const records = String(r.output?.[3] ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { records, status: r.status, signal: r.signal, ms: Date.now() - t0 };
}

// S0: sub-parent mode. Starts a holder, makes a hold, and exits normally without closing anything explicitly.
if (process.argv[2] === '--sub-exit') {
  const h = startHolder('sub');
  const rd = readySync(h, 20_000);
  const s = rd.ok ? runSupSync(h, 'sub-1', `"${process.execPath}" -e "setTimeout(()=>{},1500)"`) : undefined;
  writeFileSync(process.argv[3], JSON.stringify({ holder: h.child.pid, dir: h.dir, ready: rd, records: s?.records }));
  process.exit(0);
}

// S1: cold first wait (the first holder of this job, i.e. the first Windows external operation of a loomake process)
const h = startHolder('main');
const cold = readySync(h, 20_000);
log({ experiment: 'S1-ready-cold', ...cold, withinLimit10s: cold.ok && cold.waitMs <= 10_000, ok: cold.ok });
if (!cold.ok) process.exit(1);

// S2: normal result -> the parent releases synchronously. The target lives 400ms so the hold is confirmed before exit.
for (let i = 1; i <= 3; i++) {
  const id = `s2-${i}`;
  const s = runSupSync(h, id, `"${process.execPath}" -e "setTimeout(()=>{},400)"`);
  const prot = s.records.find((r) => 'created' in r);
  const status = s.records.find((r) => 'status' in r);
  const rel = requestSync(h, { op: 'release', id }, 10_000);
  const st = requestSync(h, { op: 'state' }, 10_000);
  const after = prot ? check(prot.pid) : undefined;
  log({ experiment: 'S2-normal-release', trial: i, records: s.records, releaseMs: rel.ms, released: rel.value, holdsAfter: st.value?.holds, checkAfter: after,
    ok: Boolean(prot) && Boolean(status) && rel.value?.released === true && !(st.value?.holds ?? []).includes(id) && after?.ok === false });
}

// S3: cmd.exe -> quality command -> its child. The supervisor is killed after the hold is confirmed (spawnSync returns);
// the parent asks the holder to clean up synchronously, with the 10 s limit of REQ-253.
const leaf = join(base, 'leaf.cjs');
writeFileSync(leaf, `const fs=require('node:fs');const [,,a,b]=process.argv;
const c=require('node:child_process').spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},100)",b],{stdio:'ignore'});
fs.writeFileSync(a,String(process.pid));setInterval(()=>{},100);`);
for (let i = 1; i <= 3; i++) {
  const a = join(base, `q-${i}`); const b = join(base, `g-${i}`);
  const id = `s3-${i}`;
  const s = runSupSync(h, id, `"${process.execPath}" "${leaf}" "${a}" "${b}"`, { mode: 'die-after-protected', waitFiles: [a, b] });
  const prot = s.records.find((r) => 'created' in r);
  if (!prot || !existsSync(a) || !existsSync(b)) { log({ experiment: 'S3-chain', trial: i, error: 'did not start', s, ok: false }); continue; }
  const q = Number(readFileSync(a, 'utf8')); const g = Number(readFileSync(b, 'utf8'));
  const resultLine = s.records.some((r) => 'status' in r);
  const cmdGone = waitSync(() => !alive(prot.pid), 5_000);
  const qAlive = alive(q); const gAlive = alive(g);
  const t0 = Date.now();
  const res = requestSync(h, { op: 'cleanup', id, deadlineMs: t0 + 10_000 }, 10_000);
  const parentMs = Date.now() - t0;
  const gone = waitSync(() => !alive(q) && !alive(g), 2_000);
  const recs = res.value?.records ?? [];
  const sameHandle = recs.every((r) => r.opens === 1 && r.stopHandle === r.handle && r.waitHandle === r.handle);
  const st = requestSync(h, { op: 'state' }, 10_000);
  log({ experiment: 'S3-chain', trial: i, supSignal: s.signal, resultLine, holdMs: prot.holdMs, target: prot.pid, cmdGone, qAlive, gAlive, parentMs, cleanup: res.value, gone, sameHandle, holdsAfter: st.value?.holds,
    ok: s.signal === 'SIGKILL' && !resultLine && cmdGone && qAlive && gAlive && res.ok && res.value?.confirmed === true && gone && sameHandle && parentMs <= 10_000
      && recs.some((r) => r.pid === q) && recs.some((r) => r.pid === g) && !(st.value?.holds ?? []).includes(id) });
  if (!gone) for (const p of [q, g]) try { process.kill(p, 'SIGKILL'); } catch { /* */ }
}

// S4: warm start of a second holder, then stdin EOF while it holds a live target -> releases and exits in finite time
{
  const h2 = startHolder('eof');
  const warm = readySync(h2, 20_000);
  const t = spawn(process.execPath, ['-e', 'setTimeout(()=>{},8000)'], { stdio: 'ignore' });
  const held = requestSync(h2, { op: 'hold', id: 'eof-1', pid: t.pid, expiresAt: Date.now() + 120_000 }, 10_000);
  const t0 = Date.now();
  h2.child.stdin.destroy();
  // closing the pipe needs the event loop, so this wait is asynchronous
  let goneMs;
  for (let k = 0; k < 500; k++) { await new Promise((r) => setTimeout(r, 10)); if (!alive(h2.child.pid)) { goneMs = Date.now() - t0; break; } }
  const ev = holderLog(h2);
  log({ experiment: 'S4-stdin-eof', warmReadyMs: warm.waitMs, held: held.value?.ok, goneMs, released: ev.some((e) => e.ev === 'release' && e.why === 'parent-gone'), exitLogged: ev.some((e) => e.ev === 'exit' && e.why === 'stdin-eof'),
    ok: warm.ok && held.value?.ok === true && goneMs !== undefined && ev.some((e) => e.ev === 'release' && e.why === 'parent-gone') });
  try { t.kill(); } catch { /* */ }
}

// S5: the parent exits normally (process.exit) while its holder holds a live target -> the holder does not remain
{
  const info = join(base, 'sub.json');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--sub-exit', info], { stdio: 'ignore', timeout: 60_000 });
  const sub = existsSync(info) ? JSON.parse(readFileSync(info, 'utf8')) : undefined;
  const t0 = Date.now();
  const gone = sub ? waitSync(() => !alive(sub.holder), 10_000) : false;
  log({ experiment: 'S5-parent-exit', subStatus: r.status, subReadyMs: sub?.ready?.waitMs, protected: sub?.records?.some((x) => 'created' in x), holderGoneMs: gone ? Date.now() - t0 : undefined, ok: gone });
}

// S6: after S4 and S5, only the main holder of this job is still running
{
  const leftovers = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }"], { encoding: 'utf8', windowsHide: true }).stdout;
  const holders = (leftovers ?? '').split(/\r?\n/).filter((l) => l.includes('holder.ps1'));
  log({ experiment: 'S6-holders-running', holders, expect: 'only the main holder of this job' , ok: holders.length === 1 });
}

h.child.stdin.destroy();
log({ experiment: 'done' });
setTimeout(() => process.exit(0), 200);
