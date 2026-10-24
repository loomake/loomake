// package-smokeで準備した専用fixtureの配布物へ、POSIXのSIGINTを実際に送る。
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const target = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'package-smokeで準備した専用の検証先を指定してください');
assert.notEqual(process.platform, 'win32', 'この検証はPOSIXのSIGINTを対象にしています');
const consumer = join(target, 'consumer');
assert.equal(JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8')).name, 'loomake-smoke-consumer');
const resultDir = join(target, 'sigint-results');
mkdirSync(resultDir); // 再実行で前の証拠を上書きしない。
const env = { ...process.env, DEVCONTAINER: '1', GIT_AUTHOR_NAME: 'loomake-smoke', GIT_AUTHOR_EMAIL: 'smoke@example.invalid', GIT_COMMITTER_NAME: 'loomake-smoke', GIT_COMMITTER_EMAIL: 'smoke@example.invalid' };
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: consumer, env, encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const tasks = join(consumer, 'openspec/changes/sample/tasks.md');
writeFileSync(tasks, '## 1. 実装\n- [ ] 1.1 最初の変更\n- [ ] 1.2 途中の変更\n\n## 2. 確認\n- [ ] 2.1 品質を確認する <!-- loomake:gate=done -->\n');
git('add', '-A'); git('commit', '-qm', 'SIGINT fixture');
const initial = git('rev-parse', 'HEAD');
const origin = join(target, 'sigint-origin.git');
assert.equal(spawnSync('git', ['init', '--bare', '-q', origin], { timeout: 5000 }).status, 0);
git('remote', 'add', 'origin', origin);
const bin = join(resultDir, 'bin'); mkdirSync(bin);
const ready = join(resultDir, 'engine-ready.json');
const claude = join(bin, 'claude');
writeFileSync(claude, `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] === '--version') { console.log('sigint-fixture'); process.exit(0); }
readFileSync(0, 'utf8');
if (!existsSync('first.txt')) {
  writeFileSync('first.txt', 'finished\\n');
  console.log(JSON.stringify({ type: 'result', result: '完了' }));
} else {
  writeFileSync('partial.txt', 'unfinished\\n');
  writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid }));
  setInterval(() => {}, 1000);
}
`);
chmodSync(claude, 0o755);
env.PATH = `${bin}${delimiter}${env.PATH ?? ''}`;
const child = spawn(process.execPath, [join(consumer, 'node_modules/loomake/dist/cli.js'), 'run', '--change', 'sample'], { cwd: consumer, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; let stderr = ''; let enginePid;
child.stdout.on('data', (data) => { output += data; });
child.stderr.on('data', (data) => { stderr += data; });
const exited = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolveExit({ code, signal })); });
try {
  await Promise.race([
    (async () => {
      const end = Date.now() + 15000;
      while (!existsSync(ready)) { assert.ok(Date.now() < end, '2つ目のエンジンの起動が時間切れになりました'); await delay(25); }
    })(),
    exited.then((result) => { throw new Error(`信号を送る前にCLIが終了しました：${JSON.stringify(result)}\n${output}\n${stderr}`); }),
  ]);
  enginePid = JSON.parse(readFileSync(ready, 'utf8')).pid;
  assert.equal(child.kill('SIGINT'), true);
  const result = await Promise.race([exited, delay(10000, undefined, { ref: false }).then(() => { throw new Error('SIGINT後の終了が時間切れになりました'); })]);
  assert.deepEqual(result, { code: 1, signal: null });
  assert.equal(git('rev-list', '--count', `${initial}..HEAD`), '1');
  assert.equal(git('log', '-1', '--format=%s'), 'run(sample): 1.1 最初の変更');
  assert.equal(git('show', 'HEAD:first.txt'), 'finished');
  assert.equal(readFileSync(join(consumer, 'partial.txt'), 'utf8'), 'unfinished\n');
  assert.ok(git('status', '--porcelain').includes('partial.txt'));
  const taskText = readFileSync(tasks, 'utf8');
  assert.ok(taskText.includes('- [x] 1.1')); assert.ok(taskText.includes('- [ ] 1.2'));
  const runs = join(consumer, '.loomake/runs');
  const [run] = readdirSync(runs).filter((name) => name !== '.gitignore');
  const summary = JSON.parse(readFileSync(join(runs, run, 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'interrupted');
  assert.deepEqual(summary.doneTasks, ['1.1 最初の変更']);
  assert.deepEqual(summary.remainingTasks, ['1.2 途中の変更', '2.1 品質を確認する']);
  assert.throws(() => process.kill(enginePid, 0), { code: 'ESRCH' });
  writeFileSync(join(resultDir, 'results.json'), JSON.stringify({ requirement: 'REQ-124', ok: true, node: process.version, platform: process.platform, signal: 'SIGINT', exit: result, summary, initial, head: git('rev-parse', 'HEAD'), partial: readFileSync(join(consumer, 'partial.txt'), 'utf8') }, null, 2) + '\n');
  console.log('SIGINT後の記録・先行コミット・途中の変更を確認しました');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  if (enginePid) { try { process.kill(-enginePid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') { console.error(error); process.exitCode = 1; } } }
  writeFileSync(join(resultDir, 'stdout.txt'), output);
  writeFileSync(join(resultDir, 'stderr.txt'), stderr);
}
