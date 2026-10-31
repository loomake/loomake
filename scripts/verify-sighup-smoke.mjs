// packしたCLIと監視役へ同じSIGHUPを送り、別グループのopenspecと孫が残らないことを確認する。
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createProcessAlive, createProcessIdentityRecorder } from './process-alive.mjs';

assert.notEqual(process.platform, 'win32', 'この検証はPOSIXのSIGHUPを対象にしています');
assert.ok(process.argv[2], 'package-smokeで準備した検証先を指定してください');
const target = resolve(process.argv[2]);
const splitReady = process.argv[3] === '--split-ready';
assert.ok(!process.argv[3] || splitReady, '未知のfixtureモードです');
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
const leafCode = "process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},100)";
writeFileSync(executable, `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
process.on('SIGTERM',()=>{});
writeFileSync(${JSON.stringify(leader)},String(process.pid));
const child=spawn(process.execPath,['-e',${JSON.stringify(leafCode)},'--',${JSON.stringify(leaf)}],{stdio:'ignore'});
const timer=setInterval(()=>{if(existsSync(${JSON.stringify(leaf)})){clearInterval(timer);${splitReady ? 'writeFileSync(' + JSON.stringify(ready) + ',\'\');setTimeout(()=>writeFileSync(' + JSON.stringify(ready) + ',JSON.stringify([process.pid,child.pid])),50);' : 'writeFileSync(' + JSON.stringify(ready) + ',JSON.stringify([process.pid,child.pid]));'}}},10);
setInterval(()=>{},100);
`);
chmodSync(executable, 0o755);
const child = spawn(process.execPath, [join(consumer, 'node_modules/loomake/dist/cli.js'), 'verify', '--change', 'sample', '--spec-only'], {
  cwd: consumer, env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
const closed = once(child, 'close');
let stdout = ''; let stderr = ''; let pids = [];
child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
const identityRecorder = createProcessIdentityRecorder({ pids: () => pids });
const probes = { platform: process.platform, identities: identityRecorder.identities, events: [], dropped: 0 };
function recordProbe(entry) {
  const event = { ...entry };
  for (const [key, value] of Object.entries(event)) {
    if (typeof value === 'string' && value.length > 4096) {
      event[key] = value.slice(0, 4096);
      event[`${key}Truncated`] = true;
    }
  }
  if (probes.events.length === 512) { probes.events.shift(); probes.dropped += 1; }
  probes.events.push(event);
}
const alive = createProcessAlive({ onProbe: recordProbe });
async function waitFor(check, timeout) {
  const until = Date.now() + timeout;
  while (!check()) { if (Date.now() >= until) return false; await delay(10); }
  return true;
}
try {
  assert.ok(await waitFor(() => {
    if (!existsSync(ready)) return false;
    const text = readFileSync(ready, 'utf8');
    if (!text.trim()) return false;
    let value;
    try { value = JSON.parse(text); } catch (error) { if (error instanceof SyntaxError) return false; throw error; }
    assert.ok(Array.isArray(value) && value.length === 2 && value.every((pid) => Number.isInteger(pid) && pid > 1), 'fixtureのPIDが不正です');
    pids = value;
    return true;
  }, 15000), `openspecの準備が時間切れ：${stdout}\n${stderr}`);
  identityRecorder.capture('ready');
  process.kill(-child.pid, 'SIGHUP');
  assert.ok(await waitFor(() => pids.every((pid) => !alive(pid)), 3000), 'SIGHUP後にopenspecまたは子が残りました');
  const [code, signal] = await closed;
  assert.equal(code, null); assert.equal(signal, 'SIGHUP');
  const remaining = pids.filter(alive);
  if (remaining.length) identityRecorder.capture('failure');
  writeFileSync(join(results, 'results.json'), JSON.stringify({ requirement: 'REQ-333', ok: true, exit: { code, signal }, remaining }, null, 2) + '\n');
  console.log('SIGHUPでCLIが終了してもopenspecと子が停止しました');
} catch (error) {
  identityRecorder.capture('failure');
  throw error;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') { console.error(error); process.exitCode = 1; }
    }
  }
  await closed;
  const targetPid = existsSync(leader) ? Number(readFileSync(leader, 'utf8')) : pids[0];
  if (targetPid) { try { process.kill(-targetPid, 'SIGKILL'); } catch { /* 停止済み */ } }
  writeFileSync(join(results, 'probes.json'), JSON.stringify(probes, null, 2) + '\n');
  writeFileSync(join(results, 'stdout.txt'), stdout); writeFileSync(join(results, 'stderr.txt'), stderr);
}
