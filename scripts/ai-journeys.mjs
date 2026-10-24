import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepare } from './package-smoke.mjs';

const win = process.platform === 'win32';
const quote = (text) => `"${text.replace(/"/g, '""')}"`;

/** AIが作成した操作シナリオを配布物で実行する。人の利用者試験や外部接続は含めない。 */
export function runJourneys(target) {
  mkdirSync(target);
  const report = { schemaVersion: 1, kind: 'ai-authored-scenarios', humanParticipants: 0, externalGitHub: false, scenarios: [] };
  const artifacts = join(target, 'artifacts');
  try {
    prepare(artifacts);
    const tarballs = readdirSync(join(artifacts, 'tarballs')).map((name) => join(artifacts, 'tarballs', name));
    const scenario = (id, title) => {
      const value = { id, title, status: 'running', steps: [] };
      report.scenarios.push(value);
      return value;
    };
    const execute = (current, command, args, cwd, expectedExitCode = 0) => {
      const started = Date.now();
      const shell = win && (command === 'npm' || command.endsWith('.cmd'));
      const result = spawnSync(shell ? quote(command) : command, shell ? args.map(quote) : args, { cwd, shell, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const step = { command, args, expectedExitCode, exitCode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', durationMs: Date.now() - started };
      current.steps.push(step);
      assert.equal(result.status, expectedExitCode, `${current.id}: ${command} ${args.join(' ')}\n${step.stdout}${step.stderr}${result.error?.message ?? ''}`);
      return step.stdout;
    };
    const createProject = (current, name) => {
      const project = join(target, name);
      mkdirSync(project);
      writeFileSync(join(project, 'package.json'), '{"name":"journey-project","private":true,"type":"module"}\n');
      execute(current, 'npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], project);
      const cli = join(project, 'node_modules/loomake/dist/cli.js');
      const run = (args, code = 0) => execute(current, process.execPath, [cli, ...args], project, code);
      return { project, run };
    };
    const configure = (current, project) => {
      cpSync(join(artifacts, 'consumer/openspec'), join(project, 'openspec'), { recursive: true });
      writeFileSync(join(project, 'loomake.config.json'), JSON.stringify({ openspecValidate: false, commands: { lint: 'node --check test-command.mjs', test: 'node test-command.mjs' } }));
      writeFileSync(join(project, '.gitignore'), 'node_modules/\n.loomake/*\n!.loomake/evidence/\n');
      const assertions = Array.from({ length: 25 }, (_, index) => ({ fullName: `[REQ-${String(index + 1).padStart(3, '0')}] fixture`, status: 'passed' }));
      const script = `import { mkdirSync, writeFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\nmkdirSync('.loomake', { recursive: true });\nwriteFileSync('.loomake/test-report.json', JSON.stringify({ testResults: [{ name: resolve('tests/fixture.test.ts'), assertionResults: ${JSON.stringify(assertions)} }] }));\n`;
      writeFileSync(join(project, 'test-command.mjs'), script);
      for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.name', 'journey'], ['config', 'user.email', 'journey@example.invalid'], ['add', '-A'], ['commit', '-qm', 'trial setup']]) execute(current, 'git', args, project);
      return script;
    };

    const initial = scenario('first-use', '初回導入と再実行');
    const first = createProject(initial, 'first-use');
    first.run(['init', '--codex', '--devcontainer']);
    const originals = ['AGENTS.md', 'loomake.config.json', '.gitignore', '.agents/skills/req-to-openspec/SKILL.md'].map((file) => [file, readFileSync(join(first.project, file), 'utf8')]);
    first.run(['init', '--codex', '--devcontainer']);
    for (const [file, text] of originals) assert.equal(readFileSync(join(first.project, file), 'utf8'), text, file);
    configure(initial, first.project);
    first.run(['doctor']);
    first.run(['verify', '--change', 'sample', '--spec-only']);
    assert.equal(JSON.parse(first.run(['verify', '--change', 'sample', '--done', '--json'])).ok, true);
    initial.status = 'passed';

    const daily = scenario('daily-use', '既存ファイルの保護と証拠の出力');
    const existing = createProject(daily, 'daily-use');
    existing.run(['init', '--codex']);
    configure(daily, existing.project);
    writeFileSync(join(existing.project, 'AGENTS.md'), '# 既存のルール\n');
    execute(daily, 'git', ['add', '-A'], existing.project);
    execute(daily, 'git', ['commit', '-qm', 'existing rules'], existing.project);
    const before = readFileSync(join(existing.project, 'AGENTS.md'), 'utf8');
    assert.ok(existing.run(['init', '--codex'], 1).includes('確認を受け付けられない'));
    assert.equal(readFileSync(join(existing.project, 'AGENTS.md'), 'utf8'), before);
    existing.run(['--help']);
    existing.run(['doctor']);
    existing.run(['verify', '--change', 'sample', '--done']);
    existing.run(['trace', 'record', '--change', 'sample']);
    const dailyReport = JSON.parse(existing.run(['trace', 'report', '--change', 'sample', '--format', 'json']));
    assert.equal(dailyReport.rows.length, 25);
    assert.ok(dailyReport.rows.every((row) => row.result === '合格'));
    daily.status = 'passed';

    const recovery = scenario('recovery', '原因の確認と修正後の再実行');
    const failed = createProject(recovery, 'recovery');
    failed.run(['init', '--codex']);
    const originalScript = configure(recovery, failed.project);
    const traceFile = join(failed.project, 'openspec/changes/sample/trace.md');
    const trace = readFileSync(traceFile, 'utf8');
    const unanswered = '| Q-01 | REQ-001 | 試験用の確認 | はい | はい | yes | |\n\n';
    writeFileSync(traceFile, trace.replace('## 仮定', `${unanswered}## 仮定`));
    assert.ok(failed.run(['verify', '--change', 'sample', '--spec-only'], 1).includes('Q-01'));
    writeFileSync(traceFile, readFileSync(traceFile, 'utf8').replace('| yes | |', '| yes | 試験用の回答 |'));
    failed.run(['verify', '--change', 'sample', '--spec-only']);
    writeFileSync(join(failed.project, 'test-command.mjs'), "import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('.loomake', { recursive: true }); writeFileSync('.loomake/test-report.json', '{\"testResults\":[]}');\n");
    assert.ok(failed.run(['verify', '--change', 'sample', '--done'], 1).includes('テストが無い要件'));
    writeFileSync(join(failed.project, 'test-command.mjs'), originalScript);
    failed.run(['verify', '--change', 'sample', '--done']);
    assert.ok(failed.run(['trace', 'record', '--change', 'sample'], 1).includes('未コミット'));
    execute(recovery, 'git', ['add', '-A'], failed.project);
    execute(recovery, 'git', ['commit', '-qm', 'trial answers'], failed.project);
    failed.run(['trace', 'record', '--change', 'sample']);
    assert.equal(JSON.parse(failed.run(['trace', 'report', '--change', 'sample', '--format', 'json'])).evidence.ok, true);
    recovery.status = 'passed';
    console.log('AIシナリオ試験3件が成功しました');
  } catch (error) {
    const current = report.scenarios.find((value) => value.status === 'running');
    if (current) { current.status = 'failed'; current.error = error.message; }
    throw error;
  } finally {
    writeFileSync(join(target, 'journeys.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv[2], '新規の試験先ディレクトリを指定してください');
    runJourneys(resolve(process.argv[2]));
  } catch (error) {
    console.error(`AIシナリオ試験に失敗しました：${error.message}`);
    process.exitCode = 1;
  }
}
