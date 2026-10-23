// prepareは開発用Node、checkは配布物の対応Nodeで実行する。
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
  const shell = win && (command === 'pnpm' || command === 'npm' || command.endsWith('.cmd'));
  const result = spawnSync(shell ? quote(command) : command, shell ? args.map(quote) : args, { cwd, encoding: 'utf8', shell, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
  return result.stdout;
}

/** 既存のディレクトリを上書きせず、配布物と独立した利用先を準備する。 */
export function prepare(target) {
  mkdirSync(target);
  const tarballs = join(target, 'tarballs');
  const consumer = join(target, 'consumer');
  mkdirSync(tarballs);
  mkdirSync(consumer);
  run('pnpm', ['-r', 'build'], root);
  for (const name of packages) run('pnpm', ['pack', '--pack-destination', tarballs, '--silent'], join(root, 'packages', name));
  const files = readdirSync(tarballs).filter((name) => name.endsWith('.tgz'));
  assert.equal(files.length, 5);
  writeFileSync(join(consumer, 'package.json'), '{"name":"loomake-smoke-consumer","private":true,"type":"module"}\n');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...files.map((file) => join(tarballs, file))], consumer);
  const fixture = join(root, 'tests/fixtures/verify-project/openspec/changes/sample');
  cpSync(fixture, join(consumer, 'openspec/changes/sample'), { recursive: true });
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
