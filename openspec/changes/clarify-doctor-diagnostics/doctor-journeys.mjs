import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(root, 'packages/cli/dist/cli.js');
const hash = (file) => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
const snapshot = (dir) => {
  const files = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.name === '.git' ? [] : entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
  return Object.fromEntries(files(dir).map((file) => [relative(dir, file), readFileSync(file, 'utf8')]));
};
function runJourneys(target) {
  mkdirSync(target);
  const sources = ['packages/kit/src/doctor/doctor.ts', 'packages/kit/src/doctor/command.ts', 'packages/kit/src/process.ts', 'packages/cli/src/main.ts', 'packages/kit/dist/doctor/doctor.js', 'packages/kit/dist/doctor/command.js', 'packages/kit/dist/process.js', 'packages/cli/dist/main.js', 'packages/cli/dist/cli.js', 'openspec/changes/clarify-doctor-diagnostics/doctor-journeys.mjs'];
  const report = { schemaVersion: 1, kind: 'ai-authored-scenarios', artifact: 'built-workspace-cli', humanParticipants: 0, externalGitHub: false, sourceSha256: Object.fromEntries(sources.map((file) => [file, hash(file)])), scenarios: [] };
  try {
    for (const id of ['missing-script', 'unsupported-shell', 'invalid-manifest']) {
      const start = Date.now(); const project = join(target, id); const bin = join(project, 'bin'); mkdirSync(project); mkdirSync(bin);
      const scenario = { id, status: 'running', steps: [], durationMs: 0 }; report.scenarios.push(scenario);
      for (const name of ['pnpm', 'openspec', 'claude', 'gh']) { const file = join(bin, process.platform === 'win32' ? `${name}.cmd` : name); writeFileSync(file, ''); chmodSync(file, 0o755); }
      const env = { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` };
      const execute = (args, expected, include, unchanged = false) => {
        const before = unchanged ? snapshot(project) : undefined;
        const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, env, encoding: 'utf8', timeout: 30_000 });
        scenario.steps.push({ args, expectedExitCode: expected, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
        assert.equal(result.status, expected, result.stdout + result.stderr);
        if (include) assert.ok(result.stdout.includes(include), include);
        if (before) assert.deepEqual(snapshot(project), before, 'doctorがファイルを変更した');
        assert.equal(existsSync(join(project, 'executed')), false);
      };
      const packageFile = join(project, 'package.json');
      const manifest = { name: 'doctor-trial', private: true, packageManager: 'pnpm@12.10.1', scripts: { lint: 'unused', typecheck: 'unused', test: `node -e "require('node:fs').writeFileSync('executed','x')"` } };
      writeFileSync(packageFile, JSON.stringify(manifest));
      execute(['doctor', '--help'], 0, 'loomake doctor');
      execute(['init', '--codex'], 0);
      mkdirSync(join(project, 'openspec'));
      assert.equal(spawnSync('git', ['init', '-q'], { cwd: project }).status, 0);
      if (id === 'missing-script') {
        writeFileSync(packageFile, JSON.stringify({ ...manifest, scripts: { lint: 'unused', typecheck: 'unused' } }));
        execute(['doctor'], 1, 'scripts.test に空でない文字列', true);
        writeFileSync(packageFile, JSON.stringify(manifest));
      } else if (id === 'unsupported-shell') {
        const configFile = join(project, 'loomake.config.json'); const config = JSON.parse(readFileSync(configFile, 'utf8'));
        writeFileSync(configFile, JSON.stringify({ ...config, commands: { ...config.commands, test: 'CI=1 pnpm test' } }));
        execute(['doctor'], 0, 'test のコマンドの静的診断は未確認', true);
        writeFileSync(configFile, JSON.stringify(config));
      } else {
        writeFileSync(packageFile, '{'); execute(['doctor'], 1, 'package.json のJSON形式が不正', true);
        writeFileSync(packageFile, JSON.stringify(manifest));
      }
      execute(['doctor'], 0, '問題 0 件、注意 0 件', true);
      assert.ok(scenario.steps.at(-1).stdout.includes('未確認：品質コマンドの成功・レポート生成・認証・ネットワーク接続'));
      scenario.status = 'passed'; scenario.durationMs = Date.now() - start;
    }
  } finally { writeFileSync(join(target, 'results.json'), JSON.stringify(report, null, 2) + '\n'); }
  return report;
}
try { assert.ok(process.argv[2], '新規の試験先ディレクトリを指定してください'); runJourneys(resolve(process.argv[2])); }
catch (error) { console.error(`doctorのAI操作試験に失敗しました：${error.message}`); process.exitCode = 1; }
