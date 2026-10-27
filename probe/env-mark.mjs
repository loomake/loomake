// PROBE（使い捨て・マージしない）：環境変数の印による子孫の識別と停止を、Windows の CI で測る。
// 1 行 1 件の JSON を標準出力と LOOMAKE_PROBE_OUT に書く
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const api = process.env.LOOMAKE_PROBE_API ?? 'emit';
const out = process.env.LOOMAKE_PROBE_OUT;
const script = readFileSync(fileURLToPath(new URL('./env-mark-cleanup.ps1', import.meta.url)), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'loomake-probe-'));
const log = (record) => { const line = JSON.stringify({ api, ...record }); console.log(line); if (out) appendFileSync(out, line + '\n'); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function waitFor(check, ms) { const until = Date.now() + ms; while (!check()) { if (Date.now() > until) return false; sleep(20); } return true; }
const newMark = () => randomBytes(16).toString('hex');
const envWith = (mark) => { const env = { ...process.env }; delete env.LOOMAKE_SUPERVISOR_MARK; if (mark) env.LOOMAKE_SUPERVISOR_MARK = mark; return env; };

function cleanup(name, input) {
  const started = Date.now();
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    env: { ...envWith(undefined), LOOMAKE_PROBE_INPUT: JSON.stringify({ slackMs: 50, limitMs: 10_000, api, terminate: true, maxPasses: 3, ...input }) },
  });
  const wallMs = Date.now() - started;
  const lines = (result.stdout ?? '').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return { kind: 'raw', line: l.slice(0, 500) }; } });
  const timing = lines.find((l) => l.kind === 'timing');
  log({ experiment: name, step: 'cleanup', wallMs, status: result.status, error: result.error?.code, stderr: (result.stderr ?? '').slice(0, 2000), timing: timing?.timing, env: lines.find((l) => l.kind === 'env'), summary: lines.find((l) => l.kind === 'summary') });
  return { lines, processes: lines.filter((l) => l.kind === 'process'), wallMs };
}
const find = (r, pid) => r.processes.find((p) => p.pid === pid);

// E1：cmd.exe を経た孫（64 ビットの node）。cmd.exe だけを止めて孫を残し、印で止める。job の最初に流すので冷えた条件
function e1(tag) {
  const mark = newMark();
  const file = join(dir, `leaf-${tag}`);
  const leaf = join(dir, `leaf-${tag}.cjs`);
  writeFileSync(leaf, `require('node:fs').writeFileSync(${JSON.stringify(file)},String(process.pid));setInterval(()=>{},100)`);
  const from = Date.now();
  const shell = spawn(`"${process.execPath}" "${leaf}"`, { shell: true, stdio: 'ignore', env: envWith(mark) });
  if (!waitFor(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 20_000)) { log({ experiment: `E1-${tag}`, error: 'leaf did not start' }); return; }
  const leafPid = Number(readFileSync(file, 'utf8'));
  process.kill(shell.pid, 'SIGKILL');
  waitFor(() => !alive(shell.pid), 5_000);
  const r = cleanup(`E1-${tag}`, { mark, targetPid: shell.pid, fromMs: from });
  const leafRec = find(r, leafPid);
  const gone = waitFor(() => !alive(leafPid), 2_000);
  log({ experiment: `E1-${tag}`, result: { leafPid, shellPid: shell.pid, leaf: leafRec, leafGone: gone, ok: leafRec?.state === 'marked' && leafRec?.wait === 'exited' && gone } });
  if (!gone) try { process.kill(leafPid, 'SIGKILL'); } catch { /* */ }
}

// E2：WOW64（32 ビット）の cmd.exe の印を読み、止める
function e2() {
  const mark = newMark();
  const from = Date.now();
  const wow = join(process.env.SystemRoot ?? 'C:\\Windows', 'SysWOW64', 'cmd.exe');
  const child = spawn(wow, ['/d', '/k'], { stdio: ['pipe', 'ignore', 'ignore'], env: envWith(mark) });
  sleep(500);
  const r = cleanup('E2-wow64', { mark, targetPid: 999_999, fromMs: from });
  const rec = find(r, child.pid);
  const gone = waitFor(() => !alive(child.pid), 2_000);
  log({ experiment: 'E2-wow64', result: { pid: child.pid, rec, gone, ok: rec?.state === 'marked' && gone } });
  if (!gone) child.kill('SIGKILL');
}

// E3：P1 の順。印のない親 X が子 C を作って終わる。X の PID を対象として後片付けしても、C を止めない
function e3() {
  const mark = newMark();
  const file = join(dir, 'p1-child');
  const from = Date.now();
  const code = `const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'ignore'});c.unref();require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid));`;
  const parent = spawn(process.execPath, ['-e', code], { stdio: 'ignore', env: envWith(undefined) });
  waitFor(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 20_000);
  waitFor(() => !alive(parent.pid), 5_000);
  const childPid = Number(readFileSync(file, 'utf8'));
  // 別の実行の印を持つプロセスも止めない
  const other = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { stdio: 'ignore', env: envWith(newMark()) });
  sleep(300);
  const r = cleanup('E3-p1', { mark, targetPid: parent.pid, fromMs: from });
  const rec = find(r, childPid);
  const otherRec = find(r, other.pid);
  log({ experiment: 'E3-p1', result: { parentPid: parent.pid, childPid, rec, childAlive: alive(childPid), otherRec, otherAlive: alive(other.pid), ok: rec?.state === 'no-mark' && rec?.possible === true && alive(childPid) && otherRec?.state === 'other-mark' && alive(other.pid) } });
  try { process.kill(childPid, 'SIGKILL'); } catch { /* */ }
  other.kill('SIGKILL');
}

// E4：止めずに、すべてのプロセスを調べる（権限不足・読み取り不能の挙動と、探索の時間）
function e4() {
  const r = cleanup('E4-inspect-all', { mark: newMark(), targetPid: 999_999, fromMs: 0, slackMs: 0, terminate: false });
  const states = {};
  const reasons = {};
  for (const p of r.processes) { states[p.state] = (states[p.state] ?? 0) + 1; if (p.reason) reasons[p.reason] = (reasons[p.reason] ?? 0) + 1; }
  log({ experiment: 'E4-inspect-all', result: { states, reasons } });
}

log({ experiment: 'start', node: process.version, arch: process.arch });
e1('cold');
e1('warm');
e2();
e3();
e4();
log({ experiment: 'end' });
