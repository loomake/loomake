// PROBE (throwaway, do not merge): does the B-3 holder of PR #22 Q-05 work on Windows?
// All waits are asynchronous (no Atomics.wait in this process), so stdout/fd 3 callbacks keep running.
// Each result is one JSON line on stdout and in LOOMAKE_PROBE_OUT.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const HOLDER = here('./holder.ps1');
const SUP = here('./sup.cjs');
const out = process.env.LOOMAKE_PROBE_OUT;
const log = (o) => { const line = JSON.stringify(o); console.log(line); if (out) appendFileSync(out, line + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function waitFor(check, ms) { const until = Date.now() + ms; for (;;) { if (await check()) return true; if (Date.now() > until) return false; await sleep(20); } }
const ps = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HOLDER];

function startHolder(tag, { detached = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `holder-${tag}-`));
  const pipe = `loomake-holder-${randomBytes(16).toString('hex')}`;
  const started = Date.now();
  const child = spawn('powershell.exe', ps, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, detached, env: { ...process.env, HOLDER_DIR: dir, HOLDER_PIPE: pipe } });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  return { child, dir, pipe, started, stderr: () => stderr, n: 0 };
}
async function ready(h, ms = 20_000) {
  const ok = await waitFor(() => existsSync(join(h.dir, 'ready')), ms);
  return { ok, waitMs: Date.now() - h.started, inner: ok ? JSON.parse(readFileSync(join(h.dir, 'ready'), 'utf8')) : undefined, stderr: h.stderr().slice(0, 500) };
}
async function request(h, body, ms = 12_000) {
  const n = ++h.n;
  const tmp = join(h.dir, `tmp-${n}`);
  writeFileSync(tmp, JSON.stringify(body));
  const t0 = Date.now();
  renameSync(tmp, join(h.dir, `req-${n}.json`));
  const res = join(h.dir, `res-${n}.json`);
  const ok = await waitFor(() => existsSync(res), ms);
  return { ok, ms: Date.now() - t0, value: ok ? JSON.parse(readFileSync(res, 'utf8')) : undefined };
}
function check(pid) {
  const r = spawnSync('powershell.exe', ps, { encoding: 'utf8', windowsHide: true, timeout: 20_000, env: { ...process.env, HOLDER_MODE: 'check', CHECK_PID: String(pid) } });
  try { return JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { return { raw: r.stdout, stderr: r.stderr?.slice(0, 300) }; }
}
/** run sup.cjs; returns the child and a live array of fd 3 records */
function runSup(h, id, command, mode = 'normal', expiresAt = Date.now() + 120_000) {
  const child = spawn(process.execPath, [SUP, JSON.stringify({ pipe: h.pipe, dir: h.dir, id, command, mode, expiresAt })], { stdio: ['ignore', 'ignore', 'inherit', 'pipe'] });
  const records = [];
  let buf = '';
  child.stdio[3].on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { records.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
  return { child, records, exited };
}
const find = (s, key) => s.records.find((r) => key in r);

const dir = mkdtempSync(join(tmpdir(), 'holder-probe-'));
const holder = startHolder('main');
const first = await ready(holder);
log({ experiment: 'ready-cold', ...first });
if (!first.ok) process.exit(1);

// E1: the assumption. Node keeps the target's process handle until it handles 'exit' in JavaScript.
for (let i = 1; i <= 3; i++) {
  const s = runSup(holder, `e1-${i}`, 'exit 0', 'block-target-exit');
  await s.exited;
  const rep = find(s, 'reply');
  log({ experiment: 'E1-block-target-exit', trial: i, reply: rep?.reply, exitedBeforeReply: rep?.exitedBeforeReply, ok: rep?.reply?.ok === true && rep.reply.exitCode === 0 });
  await request(holder, { op: 'release', id: `e1-${i}` });
}
for (let i = 1; i <= 2; i++) {
  const s = runSup(holder, `e1c-${i}`, 'exit 0', 'send-after-exit');
  await s.exited;
  const rep = find(s, 'reply');
  log({ experiment: 'E1-control-after-exit', trial: i, reply: rep?.reply, note: 'expect open to fail (87) or a different process' });
  await request(holder, { op: 'release', id: `e1c-${i}` });
}

// E1b: the same, but the request reaches the holder while the supervisor's event loop is still blocked (target already exited)
for (let i = 1; i <= 3; i++) {
  const s = runSup(holder, `e1b-${i}`, 'exit 0', 'file-hold-blocked');
  await s.exited;
  const rep = find(s, 'fileReply');
  log({ experiment: 'E1b-blocked-hold', trial: i, reply: rep?.fileReply, exitedBeforeReply: rep?.exitedBeforeReply, ok: rep?.fileReply?.ok === true && rep.fileReply.exitCode === 0 && rep.exitedBeforeReply === false });
  await request(holder, { op: 'release', id: `e1b-${i}` });
}
for (let i = 1; i <= 2; i++) {
  const s = runSup(holder, `e1d-${i}`, 'exit 0', 'file-hold-after-exit');
  await s.exited;
  const rep = find(s, 'fileReply');
  log({ experiment: 'E1b-control-after-exit', trial: i, reply: rep?.fileReply, note: 'expect open to fail (87) or a process with another creation time' });
  await request(holder, { op: 'release', id: `e1d-${i}` });
}

// E2: cmd.exe -> quality command -> its child. Kill the supervisor, then clean up through the holder.
const leaf = join(dir, 'leaf.cjs');
writeFileSync(leaf, `const fs=require('node:fs');const [,,a,b]=process.argv;
const c=require('node:child_process').spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},100)",b],{stdio:'ignore'});
fs.writeFileSync(a,String(process.pid));setInterval(()=>{},100);`);
for (let i = 1; i <= 3; i++) {
  const a = join(dir, `q-${i}`); const b = join(dir, `g-${i}`);
  const id = `e2-${i}`;
  const s = runSup(holder, id, `"${process.execPath}" "${leaf}" "${a}" "${b}"`);
  const up = await waitFor(() => existsSync(a) && existsSync(b) && readFileSync(a, 'utf8') && readFileSync(b, 'utf8') && find(s, 'reply'), 20_000);
  if (!up) { log({ experiment: 'E2', trial: i, error: 'did not start', records: s.records }); continue; }
  const q = Number(readFileSync(a, 'utf8')); const g = Number(readFileSync(b, 'utf8'));
  const rep = find(s, 'reply');
  const target = rep.pid;
  process.kill(s.child.pid, 'SIGKILL');
  await s.exited;
  const cmdGone = await waitFor(() => !alive(target), 5_000);
  const stillHeld = check(target); // after supervisor death, the holder still keeps the target object
  const qAlive = alive(q); const gAlive = alive(g);
  const res = await request(holder, { op: 'cleanup', id, deadlineMs: Date.now() + 10_000 });
  const gone = await waitFor(() => !alive(q) && !alive(g), 2_000);
  const recs = res.value?.records ?? [];
  const sameHandle = recs.every((r) => r.opens === 1 && r.stopHandle === r.handle && r.waitHandle === r.handle);
  log({ experiment: 'E2-chain', trial: i, protected: rep.protected, holdMs: rep.holdMs, target, targetCreated: rep.reply.created, cmdGone, stillHeld, qAlive, gAlive, cleanupMs: res.ms, cleanup: res.value, gone, sameHandle,
    ok: rep.protected && cmdGone && stillHeld.ok === true && stillHeld.created === rep.reply.created && qAlive && gAlive && res.value?.confirmed === true && gone && sameHandle && recs.some((r) => r.pid === q) && recs.some((r) => r.pid === g) });
  if (!gone) for (const p of [q, g]) try { process.kill(p, 'SIGKILL'); } catch { /* */ }
}

// E3: no hold (P1-like order or after release) -> nothing stopped, unconfirmed
{
  const res = await request(holder, { op: 'cleanup', id: 'never-held', deadlineMs: Date.now() + 10_000 });
  log({ experiment: 'E3-no-hold', result: res.value, ok: res.value?.confirmed === false && res.value.problems?.[0] === 'no-hold' });
}

// E4: supervisor dies in the windows
{
  const s = runSup(holder, 'e4a', `"${process.execPath}" -e "setInterval(()=>{},100)"`, 'die-before-send');
  await s.exited;
  const st = await request(holder, { op: 'state' });
  log({ experiment: 'E4-die-before-send', records: s.records, holds: st.value?.holds, ok: !s.records.some((r) => 'reply' in r) && !(st.value?.holds ?? []).includes('e4a') });
}
{
  const s = runSup(holder, 'e4b', `"${process.execPath}" -e "setInterval(()=>{},100)"`, 'block-before-reply', Date.now() + 3_000);
  await waitFor(async () => ((await request(holder, { op: 'state' })).value?.holds ?? []).includes('e4b'), 10_000);
  process.kill(s.child.pid, 'SIGKILL');
  await s.exited;
  const before = (await request(holder, { op: 'state' })).value?.holds;
  await sleep(3_500);
  const after = (await request(holder, { op: 'state' })).value?.holds;
  log({ experiment: 'E4-die-before-reply', records: s.records, holdsBefore: before, holdsAfterExpiry: after, ok: !s.records.some((r) => 'reply' in r) && !(after ?? []).includes('e4b') });
}

// E5: normal result -> release; the target object goes away
{
  const s = runSup(holder, 'e5', 'exit 0');
  await s.exited;
  const rep = find(s, 'reply');
  const rel = await request(holder, { op: 'release', id: 'e5' });
  const after = check(rep?.pid);
  log({ experiment: 'E5-release-normal', reply: rep?.reply, released: rel.value, checkAfter: after, ok: rel.value?.released === true && after.ok === false });
}

// E6: parent death. A sub-parent starts a detached holder and is killed; the holder must survive the kill itself, release and exit on stdin EOF
for (const detached of [true, false]) {
  const sub = join(dir, `sub-${detached}.mjs`);
  const info = join(dir, `sub-${detached}.json`);
  writeFileSync(sub, `import { spawn } from 'node:child_process';import { writeFileSync, existsSync } from 'node:fs';
const d=${JSON.stringify(join(dir, `subdir-${detached}`))};(await import('node:fs')).mkdirSync(d,{recursive:true});
const c=spawn('powershell.exe',${JSON.stringify(ps)},{stdio:['pipe','ignore','pipe'],windowsHide:true,detached:${detached},env:{...process.env,HOLDER_DIR:d,HOLDER_PIPE:'loomake-holder-sub-${detached}-'+process.pid}});
const t=setInterval(()=>{if(existsSync(d+'/ready')){clearInterval(t);writeFileSync(${JSON.stringify(info)},JSON.stringify({holder:c.pid}));}},20);let err='';c.stderr.on('data',x=>{err+=x;writeFileSync(${JSON.stringify(info)}+'.err',err)});c.on('exit',(code)=>writeFileSync(${JSON.stringify(info)}+'.exit',String(code)));setInterval(()=>{},1000);`);
  const p = spawn(process.execPath, [sub], { stdio: 'ignore' });
  const started = Date.now();
  const up = await waitFor(() => existsSync(info), 20_000);
  const warmReadyMs = Date.now() - started;
  if (!up) { const rd = (f) => existsSync(f) ? readFileSync(f, 'utf8').slice(0, 800) : undefined; log({ experiment: 'E6-parent-death', detached, error: 'holder not ready', stderr: rd(info + '.err'), exit: rd(info + '.exit') }); try { process.kill(p.pid, 'SIGKILL'); } catch { /* */ } continue; }
  const hp = JSON.parse(readFileSync(info, 'utf8')).holder;
  process.kill(p.pid, 'SIGKILL');
  await sleep(100);
  const aliveRightAfter = alive(hp);
  const goneIn = await waitFor(() => !alive(hp), 5_000);
  log({ experiment: 'E6-parent-death', detached, warmReadyMs, aliveRightAfter, holderGoneWithin5s: goneIn, ok: goneIn });
}

// E7: holder killed abnormally -> requests are not answered (caller must treat as unconfirmed), holder leaves nothing
{
  const s = runSup(holder, 'e7', `"${process.execPath}" -e "setInterval(()=>{},100)"`);
  await waitFor(() => find(s, 'reply'), 10_000);
  const rep = find(s, 'reply');
  process.kill(holder.child.pid, 'SIGKILL');
  await sleep(200);
  const res = await request(holder, { op: 'cleanup', id: 'e7', deadlineMs: Date.now() + 2_000 }, 2_500);
  process.kill(s.child.pid, 'SIGKILL');
  await s.exited;
  const target = rep?.pid;
  const targetGone = await waitFor(() => !alive(target), 5_000);
  const after = target ? check(target) : undefined;
  log({ experiment: 'E7-holder-killed', protected: rep?.protected, answered: res.ok, holderAlive: alive(holder.child.pid), targetGone, checkAfter: after, ok: !res.ok && !alive(holder.child.pid) });
}
log({ experiment: 'done' });
process.exit(0);
