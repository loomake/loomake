// packしたCLIと監視役へ同じSIGHUPを送り、別グループのopenspecと孫が残らないことを確認する。
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

assert.notEqual(process.platform, 'win32', 'この検証はPOSIXのSIGHUPを対象にしています');
assert.ok(process.argv[2], 'package-smokeで準備した検証先を指定してください');
const target = resolve(process.argv[2]);
const consumer = join(target, 'consumer-verify-sighup');
cpSync(join(target, 'consumer'), consumer, { recursive: true, verbatimSymlinks: true });
writeFileSync(join(consumer, 'loomake.config.json'), JSON.stringify({ openspecValidate: true, commands: {} }));
const results = join(target, 'verify-sighup-results');
mkdirSync(results);
const bin = join(results, 'bin'); mkdirSync(bin);
const ready = join(results, 'ready.json');
const leaf = join(results, 'leaf.pid');
const leader = join(results, 'leader.pid');
const executable = join(bin, 'openspec');
const leafCode = `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(leaf)},String(process.pid));setInterval(()=>{},100)`;
writeFileSync(executable, `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
process.on('SIGTERM',()=>{});
writeFileSync(${JSON.stringify(leader)},String(process.pid));
const child=spawn(process.execPath,['-e',${JSON.stringify(leafCode)}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(leaf)})){clearInterval(timer);writeFileSync(${JSON.stringify(ready)},JSON.stringify([process.pid,child.pid]));}},10);
setInterval(()=>{},100);
`);
chmodSync(executable, 0o755);
const child = spawn(process.execPath, [join(consumer, 'node_modules/loomake/dist/cli.js'), 'verify', '--change', 'sample', '--spec-only'], {
  cwd: consumer, env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
const closed = once(child, 'close');
let stdout = ''; let stderr = ''; let pids = [];
child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
function alive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
    if (process.platform === 'darwin') return !/^Z/.test(spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim());
    return true;
  } catch { return false; }
}
async function waitFor(check, timeout) {
  const until = Date.now() + timeout;
  while (!check()) { if (Date.now() >= until) return false; await delay(10); }
  return true;
}
try {
  assert.ok(await waitFor(() => existsSync(ready), 15000), `openspecの準備が時間切れ：${stdout}\n${stderr}`);
  pids = JSON.parse(readFileSync(ready, 'utf8'));
  process.kill(-child.pid, 'SIGHUP');
  assert.ok(await waitFor(() => pids.every((pid) => !alive(pid)), 3000), 'SIGHUP後にopenspecまたは子が残りました');
  const [code, signal] = await closed;
  assert.equal(code, null); assert.equal(signal, 'SIGHUP');
  writeFileSync(join(results, 'results.json'), JSON.stringify({ requirement: 'REQ-333', ok: true, exit: { code, signal }, remaining: pids.filter(alive) }, null, 2) + '\n');
  console.log('SIGHUPでCLIが終了してもopenspecと子が停止しました');
} finally {
  if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL');
  await closed;
  const targetPid = existsSync(leader) ? Number(readFileSync(leader, 'utf8')) : pids[0];
  if (targetPid) { try { process.kill(-targetPid, 'SIGKILL'); } catch { /* 停止済み */ } }
  writeFileSync(join(results, 'stdout.txt'), stdout); writeFileSync(join(results, 'stderr.txt'), stderr);
}
