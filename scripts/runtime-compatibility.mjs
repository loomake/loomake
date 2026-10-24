// 開発用Nodeでprepareした配布物を、指定したNodeと通信拒否下で検証する。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check } from './package-smoke.mjs';

const [targetArg, outputArg, expectedNode] = process.argv.slice(2);
assert.ok(targetArg && outputArg && expectedNode, '準備済みの検証先・新しい結果の保存先・Nodeの版を指定してください');
assert.equal(process.versions.node, expectedNode, '指定したNodeで実行してください');
assert.equal(process.platform, 'linux', 'この通信拒否の検証はLinuxを対象にしています');
const target = resolve(targetArg); const output = resolve(outputArg);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(output); // 成功・失敗の記録を上書きしない。
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const checks = [];
const report = () => {
  const testResults = [{ name: join(root, 'scripts/runtime-compatibility.mjs'), assertionResults: checks.map((entry) => ({ fullName: entry.name, status: entry.ok ? 'passed' : 'failed' })) }];
  writeFileSync(join(output, 'report.json'), JSON.stringify({ success: checks.length === 4 && checks.every((entry) => entry.ok), testResults }, null, 2) + '\n');
  writeFileSync(join(output, 'results.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, executable: process.execPath, checks, inputs: { script: sha256(join(root, 'scripts/runtime-compatibility.mjs')), networkFilter: sha256(join(root, 'scripts/deny-network.py')), packageSmoke: sha256(join(root, 'scripts/package-smoke.mjs')), sigintSmoke: sha256(join(root, 'scripts/run-sigint-smoke.mjs')), tarballs: Object.fromEntries(readdirSync(join(target, 'tarballs')).sort().map((file) => [file, sha256(join(target, 'tarballs', file))])) } }, null, 2) + '\n');
};
try {
  // 接続拒否(ECONNREFUSED)ではなく、socket生成がカーネルで拒否されることを確認する。
  const control = spawnSync(process.execPath, ['-e', `
const net = require('node:net');
const socket = net.connect({ host: '127.0.0.1', port: 9 });
socket.on('error', (error) => { console.log(error.code); process.exitCode = error.code === 'EPERM' ? 0 : 1; });
socket.on('connect', () => { socket.destroy(); process.exitCode = 1; });
setTimeout(() => { socket.destroy(); process.exitCode = 1; }, 1000).unref();
`], { encoding: 'utf8', timeout: 5000 });
  assert.equal(control.status, 0, control.stdout + control.stderr);
  assert.equal(control.stdout.trim(), 'EPERM');
  checks.push({ name: '通信拒否の対照実験', ok: true, result: control.stdout.trim() });
  await check(target);
  checks.push({ name: '[REQ-144][REQ-089] 指定したNodeの配布物で主要コマンドと公開APIを検証する', ok: true });
  const consumer = join(target, 'consumer');
  assert.ok(readdirSync(join(consumer, '.loomake/evidence/sample')).some((file) => file.endsWith('.json')));
  const trace = spawnSync(process.execPath, [join(consumer, 'node_modules/loomake/dist/cli.js'), 'trace', 'report', '--change', 'sample', '--format', 'json'], { cwd: consumer, encoding: 'utf8', timeout: 10000 });
  assert.equal(trace.status, 0, trace.stdout + trace.stderr);
  const rows = JSON.parse(trace.stdout).rows;
  assert.equal(rows.length, 25); assert.ok(rows.every((row) => row.result === '合格'));
  checks.push({ name: '[REQ-084] 通信拒否の下でtrace recordが保存されtrace reportの全25行を出力する', ok: true });
  const interrupted = spawnSync(process.execPath, [join(root, 'scripts/run-sigint-smoke.mjs'), target], { encoding: 'utf8', timeout: 30000 });
  assert.equal(interrupted.status, 0, interrupted.stdout + interrupted.stderr);
  const summary = JSON.parse(readFileSync(join(target, 'sigint-results/results.json'), 'utf8'));
  assert.equal(summary.node, process.version); assert.equal(summary.ok, true);
  checks.push({ name: '[REQ-125][REQ-124] 指定したNodeの配布物でrunのタスクコミットとSIGINT後の変更保持を検証する', ok: true });
  report(); console.log(`通信拒否下の配布物の検証に合格しました：${process.version}`);
} catch (error) {
  checks.push({ name: '実行時の失敗', ok: false, reason: error.message }); report(); throw error;
}
