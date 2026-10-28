// prepareは開発用Node、checkは配布物の対応Nodeで実行する。
import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = ['core', 'kit', 'trace', 'runner', 'cli'];
const win = process.platform === 'win32';
const quote = (value) => win ? `"${value.replace(/"/g, '""')}"` : value;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

function run(command, args, cwd, expected = 0) {
  // PATH から探す固定の名前を引用符で囲むと、pnpm.CMD の %~dp0 がバッチの場所にならない。
  // 空白を含みうる実行パス（.cmd の絶対パス）と引数は囲む
  const bare = command === 'pnpm' || command === 'npm';
  const shell = win && (bare || command.endsWith('.cmd'));
  const result = spawnSync(shell && !bare ? quote(command) : command, shell ? args.map(quote) : args, { cwd, encoding: 'utf8', shell, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
  return result.stdout;
}

/** 試験用のファイルを読み書きして複製し、コピー先や元の権限の共有を避ける。 */
export function copyFixture(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyFixture(from, to);
    else if (entry.isFile()) writeFileSync(to, readFileSync(from));
    else throw new Error(`試験用データに通常のファイルでない項目があります：${entry.name}`);
  }
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};
const latestGeneration = (dir) => {
  let latest = 0;
  for (const name of readdirSync(dir)) {
    const match = /^(\d+)\.owner$/.exec(name);
    if (match) latest = Math.max(latest, Number(match[1]));
  }
  return latest;
};
// 中身を書き終えた一時ファイルを、世代の名前へハードリンクする。リンクは名前が空いているときだけ成功するので、
// 同じ世代を取れるのは 1 つのプロセスだけで、読む側に書きかけの中身は見えない
const createGeneration = (dir, generation, owner) => {
  const temporary = join(dir, `tmp-${owner.token}`);
  writeFileSync(temporary, JSON.stringify(owner));
  try {
    linkSync(temporary, join(dir, `${generation}.owner`));
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    rmSync(temporary, { force: true });
  }
};

/**
 * リポジトリの dist を書き換える処理を、ロックで 1 つずつ動かす。
 * ロックは世代ごとのファイル（1.owner、2.owner…）で表し、いちばん新しい世代の持ち主がロックを持つ。
 * その世代が解放済み（N.released がある）か、持ち主のプロセスが終わっているか、取ってから staleMs を過ぎたときは、
 * 次の世代のファイルを作って取る。ほかのプロセスのロックを消したり移したりしないので、
 * 古いロックを複数の待ち手が同時に見ても、次の世代を作れた 1 つだけが中の処理へ進む（PR #107 のレビュー）。
 * hooks は試験で待ち手の順序を固定するためのもの。
 */
export function withBuildLock(fn, { lockDir = join(root, '.loomake', 'build-lock'), waitMs = 300_000, staleMs = 600_000, pollMs = 100, hooks = {} } = {}) {
  mkdirSync(lockDir, { recursive: true });
  const owner = { pid: process.pid, token: `${process.pid}-${randomUUID()}` };
  const started = Date.now();
  let held;
  for (;;) {
    const current = latestGeneration(lockDir);
    const file = join(lockDir, `${current}.owner`);
    const holder = current ? readJson(file) : undefined;
    // readdir のあとで新しい世代の持ち主が古い世代を消したときは、読み直す
    if (current && !holder && !existsSync(file)) continue;
    // 読めない世代は持ち主が動いているものとみなして待つ
    const free = !current || (holder !== undefined && (existsSync(join(lockDir, `${current}.released`)) || !alive(holder.pid) || Date.now() - holder.acquiredAt > staleMs));
    if (free) {
      const next = current + 1;
      hooks.beforeTake?.(next);
      const taken = createGeneration(lockDir, next, { ...owner, acquiredAt: Date.now() });
      hooks.afterTake?.(next, taken);
      if (taken) {
        held = next;
        break;
      }
      continue;
    }
    if (Date.now() - started > waitMs) throw new Error(`build のロックを ${Math.round(waitMs / 1000)} 秒待っても取れませんでした：${lockDir}（持ち主の PID ${holder?.pid ?? '不明'}）。持ち主がもう動いていなければ、このディレクトリを消してください`);
    hooks.onWait?.();
    sleep(pollMs);
  }
  // 古い世代は、もう誰も取ろうとしない。消せなくてもロックの働きには関わらない
  for (const name of readdirSync(lockDir)) {
    const match = /^(\d+)\./.exec(name);
    if (match && Number(match[1]) < held) {
      try {
        rmSync(join(lockDir, name), { force: true });
      } catch {
        // Windows でほかのプロセスが読んでいる間は消せないことがある
      }
    }
  }
  try {
    return fn();
  } finally {
    writeFileSync(join(lockDir, `${held}.released`), '');
  }
}

/** 既存のディレクトリを上書きせず、配布物と独立した利用先を準備する。 */
export function prepare(target) {
  mkdirSync(target);
  const tarballs = join(target, 'tarballs');
  const consumer = join(target, 'consumer');
  mkdirSync(tarballs);
  mkdirSync(consumer);
  // 試験の中では複数のファイルが同時に prepare を呼ぶ。tsc は出力を空にしてから書くので、
  // build を重ねると、ほかの build が空の .d.ts を読んだり、pack が書きかけの dist を固めたりする（Issue #34）
  withBuildLock(() => {
    run('pnpm', ['-r', 'build'], root);
    for (const name of packages) run('pnpm', ['pack', '--pack-destination', tarballs, '--silent'], join(root, 'packages', name));
  });
  const files = readdirSync(tarballs).filter((name) => name.endsWith('.tgz'));
  assert.equal(files.length, 5);
  writeFileSync(join(consumer, 'package.json'), '{"name":"loomake-smoke-consumer","private":true,"type":"module"}\n');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...files.map((file) => join(tarballs, file))], consumer);
  const fixture = join(root, 'tests/fixtures/verify-project/openspec/changes/sample');
  copyFixture(fixture, join(consumer, 'openspec/changes/sample'));
  writeFileSync(join(consumer, 'AGENTS.md'), '# Package smoke\n');
  writeFileSync(join(consumer, '.gitignore'), 'node_modules/\n.loomake/test-report.json\n');
  writeFileSync(join(consumer, 'loomake.config.json'), JSON.stringify({ openspecValidate: false, commands: { test: 'node test-command.mjs' } }));
  const assertions = Array.from({ length: 25 }, (_, i) => ({ fullName: `[REQ-${String(i + 1).padStart(3, '0')}] smoke`, status: 'passed' }));
  const report = { testResults: [{ name: join(consumer, 'tests/smoke.test.ts'), assertionResults: assertions }] };
  writeFileSync(join(consumer, 'test-command.mjs'), `import { mkdirSync, writeFileSync } from 'node:fs';\nmkdirSync('.loomake', { recursive: true });\nwriteFileSync('.loomake/test-report.json', ${JSON.stringify(JSON.stringify(report))});\n`);
  run('git', ['init', '-q'], consumer);
  run('git', ['config', 'user.name', 'loomake-smoke'], consumer);
  run('git', ['config', 'user.email', 'smoke@example.invalid'], consumer);
  run('git', ['add', '-A'], consumer);
  run('git', ['commit', '-qm', 'smoke fixture'], consumer);
  console.log(`配布物の準備が完了しました：${target}`);
}

/** Nodeと配布済みの5パッケージだけを使い、主要な利用経路を確認する。 */
export async function check(target) {
  const consumer = join(target, 'consumer');
  const require = createRequire(join(consumer, 'package.json'));
  for (const name of packages) {
    const base = join(consumer, 'node_modules', name === 'cli' ? 'loomake' : `@loomake/${name}`);
    const manifest = json(join(base, 'package.json'));
    assert.deepEqual(manifest.repository, { type: 'git', url: 'git+https://github.com/loomake/loomake.git', directory: `packages/${name}` }, 'repositoryの出典が一致しません');
    assert.equal(manifest.publishConfig?.provenance, true, 'provenanceの設定がありません');
  }
  for (const name of packages.filter((name) => name !== 'cli')) {
    const base = join(consumer, 'node_modules/@loomake', name);
    const manifest = json(join(base, 'package.json'));
    assert.ok(!JSON.stringify(manifest.exports).includes('@loomake/source'), '公開物にソース条件が残っています');
    const visit = (value) => {
      if (typeof value === 'string') assert.ok(existsSync(resolve(base, value)), `exportsの参照先がありません：${value}`);
      else for (const child of Object.values(value)) visit(child);
    };
    visit(manifest.exports);
  }
  const core = await import(pathToFileURL(require.resolve('@loomake/core')).href);
  assert.equal(core.parseTasks('tasks.md', '- [x] done').value[0].checked, true);
  assert.equal(json(require.resolve('@loomake/core/schema/verify-result.schema.json')).properties.schemaVersion.const, core.VERIFY_RESULT_SCHEMA_VERSION);
  const cli = join(consumer, 'node_modules/loomake/dist/cli.js');
  const command = (...args) => run(process.execPath, [cli, ...args], consumer);
  const installedBin = join(consumer, 'node_modules/.bin', win ? 'loomake.cmd' : 'loomake');
  assert.ok(existsSync(installedBin), 'CLIのbinがインストールされていません');
  run(installedBin, ['--version'], consumer);
  command('--help');
  assert.equal(command('--version').trim(), json(join(consumer, 'node_modules/loomake/package.json')).version);
  run(process.execPath, [cli], consumer, 2);
  const initRoot = mkdtempSync(join(target, 'init-'));
  run(process.execPath, [cli, 'init', '--codex', '--devcontainer'], initRoot);
  for (const file of ['AGENTS.md', '.agents/skills/req-to-openspec/SKILL.md', '.devcontainer/devcontainer.json']) assert.ok(existsSync(join(initRoot, file)), file);
  command('doctor');
  command('verify', '--change', 'sample', '--spec-only');
  const verified = JSON.parse(command('verify', '--change', 'sample', '--done', '--json'));
  assert.equal(verified.ok, true);
  assert.equal(Object.keys(verified.coverage).length, 25);
  command('trace', 'record', '--change', 'sample');
  const report = JSON.parse(command('trace', 'report', '--change', 'sample', '--format', 'json'));
  assert.equal(report.rows.length, 25);
  assert.ok(report.rows.every((row) => row.result === '合格'));
  console.log(`配布物の検証に合格しました：${process.version} ${process.platform}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, target] = process.argv.slice(2);
  try {
    assert.ok(target && ['prepare', 'check'].includes(mode), 'prepareかcheckと、新規の検証先ディレクトリを指定してください');
    if (mode === 'prepare') prepare(resolve(target));
    else await check(resolve(target));
  } catch (error) {
    console.error(`配布物の検証に失敗しました：${error.message}`);
    process.exitCode = 1;
  }
}
