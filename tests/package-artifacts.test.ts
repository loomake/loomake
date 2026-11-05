import { packedTarballsEnv } from './packed-tarballs.js';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { markPhase } from '../scripts/ci-heartbeat.mjs';
import { currentBaseline } from '../packages/cli/test/cli-baseline.js';
import { loadVerifyResultSchemas, type VerifyResult } from '../packages/core/src/index.js';
import { loadVerifyQualitySchema, runVerify, verifyExitCode } from '../packages/kit/src/index.js';
import { CHANGE, commitAll, traceMd, vitestCommand, withProject } from '../packages/kit/test/project.js';

const root = join(import.meta.dirname, '..');
const base = mkdtempSync(join(tmpdir(), 'loomake artifacts '));
const target = join(base, 'prepared');
// prepare は、globalSetup が試験の前に 1 回だけ build と pack をした tarball を使う（tests/package-build.setup.ts）
const env = packedTarballsEnv(inject('packedTarballs'));
const run = (mode: string) => spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target], { cwd: root, encoding: 'utf8', env });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('実際に配るパッケージ', () => {
  it('[REQ-324][REQ-325] ビルド済み生成入口とpackしたCLIの共通定義・help・usageが一致する', () => {
    const cliTarget = join(base, 'cli-reference');
    // 時間切れの段階を見分けるため、LOOMAKE_CI_HEARTBEAT_DIR があるときだけ段階を記録する（REQ-345、Issue #183）
    markPhase('package-reference', 'prepare-start');
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', cliTarget], { cwd: root, encoding: 'utf8', env });
    markPhase('package-reference', 'prepare-end');
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const generator = join(root, 'scripts/generate-cli-reference.mjs');
    // cwdを変えてもスクリプト自身の場所を基準に生成済みページを照合する。
    markPhase('package-reference', 'check-start');
    const checked = spawnSync(process.execPath, [generator, '--check'], { cwd: cliTarget, encoding: 'utf8' });
    markPhase('package-reference', 'check-end');
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const argsUrl = pathToFileURL(join(cliTarget, 'consumer/node_modules/loomake/dist/args.js')).href;
    const mainUrl = pathToFileURL(join(cliTarget, 'consumer/node_modules/loomake/dist/main.js')).href;
    const generatorUrl = pathToFileURL(generator).href;
    // 原本に、改版の change で承認した具体差分を当てた期待値（REQ-324）
    const baselinePath = join(base, 'reference-cli-baseline-current.json');
    writeFileSync(baselinePath, JSON.stringify({ cases: currentBaseline() }));
    markPhase('package-reference', 'compare-start');
    const packed = spawnSync(process.execPath, ['--input-type=module', '-e', `
import { readFileSync } from 'node:fs';
import { CLI_REFERENCE } from ${JSON.stringify(argsUrl)};
import { main } from ${JSON.stringify(mainUrl)};
import { runCliReference } from ${JSON.stringify(generatorUrl)};
const baseline = JSON.parse(readFileSync(${JSON.stringify(baselinePath)}, 'utf8'));
for (const item of baseline.cases) {
  const stdout = [], stderr = [];
  const code = await main(item.argv, { cwd: process.cwd(), stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) });
  if (JSON.stringify({ code, stdout, stderr }) !== JSON.stringify({ code: item.code, stdout: item.stdout, stderr: item.stderr })) {
    throw new Error('packしたCLIが基準と異なります：' + JSON.stringify(item.argv));
  }
}
process.exitCode = await runCliReference({ definition: CLI_REFERENCE, check: true });
`], { cwd: cliTarget, encoding: 'utf8' });
    markPhase('package-reference', 'compare-end');
    expect(packed.status, packed.stdout + packed.stderr).toBe(0);
  }, 60000);

  it('[REQ-057][REQ-138][REQ-139][REQ-143][REQ-146][REQ-169][REQ-304][REQ-305][REQ-306][REQ-393] packした5パッケージだけで主要コマンドと公開APIを使える', () => {
    const prepared = run('prepare');
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = run('check');
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toContain('配布物の検証に合格');
    for (const name of ['core', 'kit', 'trace', 'runner', 'cli']) {
      const installed = join(target, 'consumer/node_modules', name === 'cli' ? 'loomake' : `@loomake/${name}`);
      const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
      expect(manifest.license, name).toBe('MIT');
      expect(manifest.homepage, name).toBe('https://github.com/loomake/loomake#readme');
      expect(manifest.bugs?.url, name).toBe('https://github.com/loomake/loomake/issues');
      expect(manifest.description, name).toEqual(expect.any(String));
      expect(manifest.description.trim(), name).not.toBe('');
      expect(manifest.keywords, name).toContain('openspec');
      const readme = readFileSync(join(installed, 'README.md'), 'utf8');
      expect(readme, name).toBe(readFileSync(join(root, 'packages', name, 'README.md'), 'utf8'));
      if (name === 'cli') {
        for (const text of ['npx loomake init', 'https://github.com/loomake/loomake', 'openspec', 'gh']) expect(readme).toContain(text);
        for (const command of ['init', 'verify', 'trace', 'run', 'doctor']) expect(manifest.description).toContain(command);
      } else {
        expect(readme, name).toContain('内部用');
        expect(readme, name).toContain('`0.y.z` のあいだは、API が予告なく変わることがある');
      }
    }
    for (const name of ['core', 'kit', 'trace', 'runner']) {
      const manifest = JSON.parse(readFileSync(join(target, 'consumer/node_modules/@loomake', name, 'package.json'), 'utf8'));
      expect(JSON.stringify(manifest.exports)).not.toContain('@loomake/source');
    }
    const manifestPath = join(target, 'consumer/node_modules/loomake/package.json');
    const originalManifest = readFileSync(manifestPath, 'utf8');
    const wrongSource = JSON.parse(originalManifest);
    wrongSource.repository.url = 'git+https://github.com/example/other.git';
    writeFileSync(manifestPath, JSON.stringify(wrongSource));
    const wrong = run('check');
    expect(wrong.status).not.toBe(0);
    expect(wrong.stderr).toContain('repository');
    writeFileSync(manifestPath, originalManifest);
    // テンプレートが欠けた配布物を成功扱いにしないことも確認する。
    rmSync(join(target, 'consumer/node_modules/@loomake/kit/templates/AGENTS.md'));
    const broken = run('check');
    expect(broken.status).not.toBe(0);
    expect(broken.stderr).toContain('AGENTS.md');
  }, 120000);

  it('[REQ-393] tarballの公開入口からVitest runnerを導入し未設定の移行影響も確かめる', () => {
    const consumerTarget = join(base, 'body-consumer');
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', consumerTarget], { cwd: root, encoding: 'utf8', env });
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = spawnSync(process.execPath, ['scripts/check-body-consumer.mjs', consumerTarget, join(base, 'body-consumer-results')], { cwd: root, encoding: 'utf8', timeout: 60_000 });
    expect(checked.error, checked.stderr).toBeUndefined();
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(readFileSync(join(base, 'body-consumer-results/results.json'), 'utf8'));
    expect(result.ok).toBe(true);
    expect(result.results.map((entry: { mode: string }) => entry.mode)).toEqual(['identity', 'standard', 'custom', 'unconfigured']);
  }, 90_000);

  it.runIf(process.platform !== 'win32').each([false, true])('[REQ-333] packしたCLIと監視役を同じSIGHUPで終わらせてもopenspecと孫を残さない（分割ready=%s）', (splitReady) => {
    const verifyTarget = join(base, splitReady ? 'verify-sighup-split-ready' : 'verify-sighup');
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', verifyTarget], { cwd: root, encoding: 'utf8', env });
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = spawnSync(process.execPath, ['scripts/verify-sighup-smoke.mjs', verifyTarget, ...(splitReady ? ['--split-ready'] : [])], { cwd: root, encoding: 'utf8', timeout: 30000 });
    const probesPath = join(verifyTarget, 'verify-sighup-results/probes.json');
    const diagnostics = checked.stdout + checked.stderr + (existsSync(probesPath) ? readFileSync(probesPath, 'utf8') : '');
    expect(checked.status, diagnostics).toBe(0);
    expect(JSON.parse(readFileSync(join(verifyTarget, 'verify-sighup-results/results.json'), 'utf8')), diagnostics).toEqual({ requirement: 'REQ-333', ok: true, exit: { code: null, signal: 'SIGHUP' }, remaining: [] });
  }, 60_000);

  it('[REQ-124] POSIXの配布物を実際のSIGINTで中断する。Windowsでは検証対象外を明示する', () => {
    const checked = spawnSync(process.execPath, ['scripts/run-sigint-smoke.mjs', target], { cwd: root, encoding: 'utf8', timeout: 60000 });
    if (process.platform === 'win32') {
      expect(checked.status).toBe(1);
      expect(checked.stderr).toContain('この検証はPOSIXのSIGINTを対象にしています');
    } else {
      expect(checked.status, checked.stdout + checked.stderr).toBe(0);
      const result = JSON.parse(readFileSync(join(target, 'sigint-results/results.json'), 'utf8'));
      expect(result).toMatchObject({ requirement: 'REQ-124', ok: true, platform: process.platform, signal: 'SIGINT', exit: { code: 1, signal: null }, summary: { status: 'interrupted', doneTasks: ['1.1 最初の変更'], remainingTasks: ['1.2 途中の変更', '2.1 品質を確認する'] }, partial: 'unfinished\n' });
    }
  }, 70000);

  it.each(['SIGTERM', 'SIGHUP'])('[REQ-208] POSIXの配布物を実際の%sで中断し、エンジンを残さない', (signal) => {
    if (process.platform === 'win32') return;
    const checked = spawnSync(process.execPath, ['scripts/run-sigint-smoke.mjs', target, signal], { cwd: root, encoding: 'utf8', timeout: 30000 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(readFileSync(join(target, `${signal.toLowerCase()}-results/results.json`), 'utf8'));
    expect(result).toMatchObject({ requirement: 'REQ-208', ok: true, signal, exit: { code: 1, signal: null }, summary: { status: 'interrupted', doneTasks: ['1.1 最初の変更'], remainingTasks: ['1.2 途中の変更', '2.1 品質を確認する'] }, partial: 'unfinished\n' });
  }, 35000);

  it('[REQ-084] Linuxで通信を拒否して配布物を使う。他OSでは検証対象外を明示する', () => {
    const offlineTarget = join(base, 'offline');
    const args = ['scripts/runtime-compatibility.mjs', offlineTarget];
    if (process.platform !== 'linux') {
      const unsupported = spawnSync(process.execPath, [...args, join(base, 'unsupported'), process.versions.node], { cwd: root, encoding: 'utf8', timeout: 10000 });
      expect(unsupported.status).toBe(1);
      expect(unsupported.stderr).toContain('この通信拒否の検証はLinuxを対象にしています');
      return;
    }
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', offlineTarget], { cwd: root, encoding: 'utf8', timeout: 60000, env });
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const unrestricted = spawnSync(process.execPath, [...args, join(base, 'unrestricted'), process.versions.node], { cwd: root, encoding: 'utf8', timeout: 20000 });
    expect(unrestricted.status).toBe(1);
    expect(unrestricted.stderr).toContain('ECONNREFUSED');
    const output = join(base, 'runtime-results');
    const checked = spawnSync('python3', ['scripts/deny-network.py', process.execPath, ...args, output, process.versions.node], { cwd: root, encoding: 'utf8', timeout: 70000 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(readFileSync(join(output, 'results.json'), 'utf8'));
    expect(result.node).toBe(process.version);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.every((entry: { ok: boolean }) => entry.ok)).toBe(true);
    expect(result.checks[0].result).toBe('EPERM');
  }, 160000);

  it('[REQ-146] 配布物の公開型を使い、型の破壊的変更を利用側のコンパイルで検出する', () => {
    const types = (name: string) => spawnSync(process.execPath, ['scripts/check-public-types.mjs', target, join(base, name)], { cwd: root, encoding: 'utf8', timeout: 70000 });
    const healthy = types('types-healthy');
    expect(healthy.status, healthy.stdout + healthy.stderr).toBe(0);
    // 現行の verify 2.0.0 の公開型（要判断の required）を壊し、利用側のコンパイルで検出する（REQ-318）
    const declaration = join(target, 'consumer/node_modules/@loomake/core/dist/verify-result-v2-schema.d.ts');
    const original = readFileSync(declaration, 'utf8');
    try {
      const marker = 'export declare const verifyDecisionSchema';
      expect(original.split(marker)).toHaveLength(2);
      const at = original.indexOf(marker);
      expect(original.slice(at).indexOf('required: z.ZodBoolean')).toBeLessThan(original.slice(at).indexOf('reasons:'));
      writeFileSync(declaration, original.slice(0, at) + original.slice(at).replace('required: z.ZodBoolean', 'required: z.ZodString'));
      const broken = types('types-broken');
      expect(broken.status).toBe(1);
      expect(broken.stdout).toContain('error TS2322');
      expect(broken.stdout).toContain("Type 'boolean' is not assignable to type 'string'");
    } finally { writeFileSync(declaration, original); }
    const restored = types('types-restored');
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
  }, 220000);

  it('[REQ-153] 配布物の診断はold spaceを32MiBに制限して64MiBの単語を処理し通常の出力へ戻る', () => {
    const module = pathToFileURL(join(target, 'consumer/node_modules/@loomake/runner/dist/mask.js')).href;
    const checked = spawnSync(process.execPath, ['--max-old-space-size=32', '--input-type=module', '-e', `
import { createDiagnosticRedactor } from ${JSON.stringify(module)};
let output = '';
const redactor = createDiagnosticRedactor((text) => { output += text; });
const chunk = 'x'.repeat(4096);
for (let i = 0; i < 16384; i++) redactor.write(chunk);
redactor.write(' next 日本語\\n'); redactor.end();
console.log(JSON.stringify({ output, heapUsed: process.memoryUsage().heapUsed }));
`], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(checked.stdout);
    expect(result.output).toBe('*** next 日本語\n');
    expect(result.heapUsed).toBeLessThan(32 * 1024 * 1024);
  }, 36000);
});


it('[REQ-396][REQ-397][REQ-398] tarballの実CLIが空Gitへ雛形と見本を配置し、不在時は読取最小と合格条件を案内する', () => {
  const previewTarget = join(base, 'init-preview');
  const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', previewTarget], { cwd: root, encoding: 'utf8', env });
  expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
  const installed = join(previewTarget, 'consumer/node_modules');
  const cli = join(installed, 'loomake/dist/cli.js');
  const kitTemplates = join(installed, '@loomake/kit/templates');
  const samplePath = '.github/loomake/workflow.example.yml';
  const files = ['AGENTS.md', 'CLAUDE.md', 'loomake.config.json', 'quality.yaml', samplePath, '.claude/skills/req-to-openspec/SKILL.md'];
  for (const optIn of [false, true]) {
    const project = join(previewTarget, optIn ? 'empty-git-opt-in' : 'empty-git');
    mkdirSync(project);
    const git = spawnSync('git', ['init', '-q'], { cwd: project, encoding: 'utf8' });
    expect(git.status, git.stderr).toBe(0);
    const init = spawnSync(process.execPath, [cli, 'init', ...(optIn ? ['--codex', '--devcontainer'] : [])], { cwd: project, encoding: 'utf8' });
    expect(init.status, init.stdout + init.stderr).toBe(0);
    for (const file of files) {
      expect(existsSync(join(project, file)), file).toBe(true);
      expect(init.stdout).toContain(`作成：${file}`);
    }
    expect(readFileSync(join(project, 'quality.yaml'), 'utf8')).toBe(readFileSync(join(kitTemplates, 'quality.yaml'), 'utf8'));
    expect(readFileSync(join(project, 'quality.yaml'), 'utf8')).toContain('objectives: {}\nproduct: {}');
    expect(readFileSync(join(project, 'quality.yaml'), 'utf8')).not.toContain('PQ-900');
    expect(init.stdout).toContain('品質目標未設定');
    const sample = readFileSync(join(project, samplePath), 'utf8');
    expect(sample).toContain('未提供');
    for (const job of ['gate', 'run', 'evaluate', 'propose']) expect(sample).toContain(`uses: loomake/loomake/.github/workflows/${job}.yml@v1`);
    expect(existsSync(join(project, '.github/workflows'))).toBe(false);
    expect(existsSync(join(project, '.agents/skills/req-to-openspec/SKILL.md'))).toBe(optIn);
    expect(existsSync(join(project, '.devcontainer/devcontainer.json'))).toBe(optIn);
    const config = JSON.parse(readFileSync(join(project, 'loomake.config.json'), 'utf8'));
    expect(config.commands).toEqual({ lint: 'npm run lint', typecheck: 'npm run typecheck', test: 'npm test' });
    expect(config).not.toHaveProperty('quality');
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toContain('.loomake/test-report.json');
  }
  const consumer = join(previewTarget, 'consumer');
  rmSync(join(consumer, 'quality.yaml'));
  const missing = spawnSync(process.execPath, [cli, 'verify', '--change', 'sample', '--done', '--scope', 'ci', '--json'], { cwd: consumer, encoding: 'utf8' });
  expect(missing.status, missing.stdout + missing.stderr).toBe(3);
  const result = JSON.parse(missing.stdout);
  expect(result.run.status).toBe('aborted');
  expect(result.run.errors).toEqual([expect.objectContaining({ kind: 'runtime', target: 'quality.yaml', next: expect.stringMatching(/最小の quality.yaml.*読取.*品質の対象.*証拠/) })]);
  for (const source of ['quality.yaml', 'workflow.example.yml']) {
    const path = join(kitTemplates, source);
    const content = readFileSync(path, 'utf8');
    rmSync(path);
    try {
      const project = mkdtempSync(join(previewTarget, 'missing-template-'));
      const broken = spawnSync(process.execPath, [cli, 'init'], { cwd: project, encoding: 'utf8' });
      expect(broken.status).not.toBe(0);
      expect(broken.stderr).toContain(source);
      expect(existsSync(join(project, 'AGENTS.md'))).toBe(false);
    } finally { writeFileSync(path, content); }
  }
}, 60_000);

it('[REQ-419][REQ-420][REQ-421] tarballのinitは非TTYとパイプでも明示方針で完了し無指定は案内して中止する', () => {
  const initTarget = join(base, 'init-noninteractive');
  const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', initTarget], { cwd: root, encoding: 'utf8', env });
  expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
  const installed = join(initTarget, 'consumer/node_modules');
  const cli = join(installed, 'loomake/dist/cli.js');
  const templates = join(installed, '@loomake/kit/templates');
  for (const input of ['', 'y\nn\n']) {
    for (const flag of [undefined, '--yes', '--keep-existing']) {
      const project = mkdtempSync(join(initTarget, 'existing-'));
      const agents = '# custom agents\n';
      const quality = '# custom quality\n';
      writeFileSync(join(project, 'AGENTS.md'), agents);
      writeFileSync(join(project, 'quality.yaml'), quality);
      const result = spawnSync(process.execPath, [cli, 'init', '--codex', '--devcontainer', ...(flag ? [flag] : [])], { cwd: project, input, encoding: 'utf8', timeout: 10000 });
      expect(result.error, result.stdout + result.stderr).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(flag ? 0 : 1);
      expect(result.stderr).not.toContain('AbortError');
      expect(result.stdout).not.toContain('[y/N]');
      expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toBe(flag === '--yes' ? readFileSync(join(templates, 'AGENTS.md'), 'utf8') : agents);
      expect(readFileSync(join(project, 'quality.yaml'), 'utf8')).toBe(flag === '--yes' ? readFileSync(join(templates, 'quality.yaml'), 'utf8') : quality);
      if (flag) {
        expect(readFileSync(join(project, 'CLAUDE.md'), 'utf8')).toBe(readFileSync(join(templates, 'CLAUDE.md'), 'utf8'));
        expect(existsSync(join(project, '.agents/skills/req-to-openspec/SKILL.md'))).toBe(true);
        expect(existsSync(join(project, '.devcontainer/devcontainer.json'))).toBe(true);
        expect(result.stdout).toContain(flag === '--yes' ? '上書き：AGENTS.md' : '上書きしなかった：AGENTS.md');
      } else {
        expect(existsSync(join(project, 'CLAUDE.md'))).toBe(false);
        expect(existsSync(join(project, '.gitignore'))).toBe(false);
        expect(result.stdout).toContain('--yes');
        expect(result.stdout).toContain('--keep-existing');
        expect(result.stdout).toContain('どのファイルも置かずに中止');
      }
    }
  }
}, 60_000);

// #64: REQ-311/312/319の既存契約を、main関数の呼出だけでなく実CLI入口でも確かめる。
describe('CI=1でのverify APIと実CLIの判定一致', () => {
  type Case = {
    name: string; mode: 'done' | 'spec-only' | 'bare'; scope?: 'local' | 'ci';
    skip?: boolean; failed?: boolean; approval?: boolean; quality?: 'invalid' | 'missing';
    exit: number; verdict?: 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE'; pending?: boolean;
  };
  const cases: Case[] = [
    { name: 'ci PASS', mode: 'done', exit: 0, verdict: 'PASS' },
    { name: 'ci FAIL', mode: 'done', failed: true, exit: 1, verdict: 'FAIL' },
    { name: 'ci不足', mode: 'done', skip: true, exit: 1, verdict: 'INSUFFICIENT_EVIDENCE' },
    { name: '要判断とFAIL併存', mode: 'done', failed: true, approval: true, exit: 1, verdict: 'FAIL' },
    { name: 'local完了', mode: 'done', scope: 'local', exit: 0 },
    { name: 'local未完了', mode: 'done', scope: 'local', skip: true, pending: true, exit: 1 },
    { name: '既定localの仕様ゲート', mode: 'spec-only', exit: 0 },
    { name: '明示ciの仕様ゲート', mode: 'spec-only', scope: 'ci', exit: 0, verdict: 'PASS' },
    { name: 'changeなしの品質検査', mode: 'bare', exit: 0 },
    { name: 'quality設定不正', mode: 'done', quality: 'invalid', exit: 2 },
    { name: '必須quality不在', mode: 'done', quality: 'missing', exit: 3 },
  ];
  // 実行ごとに変わるレポートの時刻・hash・receiptではなく、公開された判定を比較する。
  const judgment = (result: VerifyResult) => ({
    schemaVersion: result.schemaVersion, change: result.change,
    run: { status: result.run.status, errors: result.run.errors.map(({ kind, target }) => ({ kind, target })) },
    ...(result.scope === undefined ? {} : {
      scope: result.scope,
      hasVerdict: Object.hasOwn(result, 'verdict'),
      verdict: 'verdict' in result ? result.verdict : undefined,
      checks: result.checks.map(({ id, result }) => ({ id, result })),
      summary: result.summary,
      decision: result.decision,
    }),
  });

  it.each(cases)('[REQ-311][REQ-312][REQ-319] $name: APIと子プロセスの判定・exitが一致し入力を待たない', async (item) => {
    const qualitySchema = await loadVerifyQualitySchema();
    const { verifyResultSchema } = await loadVerifyResultSchemas();
    const command = `${vitestCommand()} && node -e "require('fs').writeFileSync('command-ran','yes')"`;
    const trace = item.approval
      ? traceMd({ assumptions: ['| A-01 | REQ-012 | 8文字以上 | 記載なし | |'] }) : traceMd();
    withProject({
      config: { openspecValidate: false, commands: { test: command } }, trace,
      quality: item.quality === 'invalid' ? 'version: 2\nproduct: [\n' : true,
      files: { 'tests/a.test.ts': `it('[REQ-012] 実際のassertion', () => { expect(1).toBe(${item.failed ? 2 : 1}); });\n` },
    }, (project) => {
      if (item.quality === 'missing') {
        rmSync(join(project, 'quality.yaml'));
        commitAll(project, '必須qualityを除く');
      }
      const argv = ['verify'];
      if (item.mode !== 'bare') argv.push('--change', CHANGE, `--${item.mode}`);
      if (item.scope) argv.push('--scope', item.scope);
      if (item.skip) argv.push('--skip-commands');
      const savedCi = process.env.CI;
      let api: VerifyResult;
      try {
        process.env.CI = '1';
        api = runVerify({ root: project, qualitySchema,
          ...(item.mode === 'bare' ? {} : { changeId: CHANGE, gate: item.mode }),
          ...(item.scope ? { scope: item.scope } : {}), skipCommands: item.skip });
      } finally {
        if (savedCi === undefined) delete process.env.CI;
        else process.env.CI = savedCi;
      }
      const executes = item.mode !== 'spec-only' && !item.skip && !item.quality && !item.failed;
      expect(existsSync(join(project, 'command-ran'))).toBe(executes);
      rmSync(join(project, 'command-ran'), { force: true });
      const child = spawnSync(process.execPath, [join(root, 'packages/cli/dist/cli.js'), ...argv, '--json'], {
        cwd: project, encoding: 'utf8', env: { ...process.env, CI: '1' },
        stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000,
      });
      expect(child.error, child.stderr).toBeUndefined();
      expect(child.signal, child.stderr).toBeNull();
      expect(child.status, child.stdout + child.stderr).toBe(item.exit);
      expect(existsSync(join(project, 'command-ran'))).toBe(executes);
      const cli: VerifyResult = JSON.parse(child.stdout);
      for (const result of [api, cli]) {
        expect(verifyResultSchema.safeParse(result).success, JSON.stringify(result)).toBe(true);
        expect(verifyExitCode(result)).toBe(item.exit);
        expect(result.schemaVersion).toBe('2.0.0');
        expect(result.change).toBe(item.mode === 'bare' ? null : CHANGE);
        if (item.quality) {
          expect(result.run.status).toBe('aborted');
          expect(result.run.errors.map(({ kind }) => kind)).toEqual([item.quality === 'invalid' ? 'config' : 'runtime']);
          for (const key of ['scope', 'checks', 'summary', 'verdict', 'decision']) expect(result).not.toHaveProperty(key);
          continue;
        }
        expect(result.run.status).toBe('completed');
        expect(result.run.errors).toEqual([]);
        if (result.scope === undefined) throw new Error('completedにはscopeとchecksが必要です');
        expect(result.scope).toBe(item.scope ?? (item.mode === 'done' ? 'ci' : 'local'));
        if (item.verdict) expect(result).toHaveProperty('verdict', item.verdict);
        else expect(result).not.toHaveProperty('verdict');
        expect(result.decision.required).toBe(item.approval === true);
        expect(result.decision.reasons).toEqual(item.approval
          ? [{ code: 'APPROVAL_REQUIRED', target: 'A-01', message: '仮定 A-01 が未承認です' }] : []);
        if (item.failed) {
          expect(result.checks.some((check) => check.result === 'FAIL')).toBe(true);
          expect(result.summary.fail).toBeGreaterThan(0);
        }
        if (result.scope === 'local') {
          expect(result.summary.fail).toBe(0);
          if (item.pending) expect(result.summary.pending).toBeGreaterThan(0);
          else expect(result.summary.pending).toBe(0);
        }
        if (item.mode === 'spec-only') {
          expect(result.checks.some(({ id }) => id.startsWith('quality:'))).toBe(false);
        }
      }
      expect(judgment(cli)).toEqual(judgment(api));
      expect(child.status).toBe(verifyExitCode(api));
    });
  }, 30_000);
});

it('[REQ-466] tarballのeffort入口・導出型・help・既存公開元とarchive探索を使える', () => {
  const effortTarget = join(base, 'effort-record');
  const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', effortTarget], { cwd: root, encoding: 'utf8', env });
  expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
  const consumer = join(effortTarget, 'consumer');
  const code = `
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { EFFORT_SCHEMA_VERSION, loadEffortSchema, loadTraceSchemas, loadParserSchemas } from '@loomake/core';
import { resolveChangeDir } from '@loomake/kit';
import { parseDuration, parseCost, parseEffortOption, runEffortRecord, runRecord, runReport } from '@loomake/trace';
import { main } from './node_modules/loomake/dist/main.js';
const git = (...args) => { const r = spawnSync('git', args, { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const commit = () => { git('add', '-A'); git('commit', '-qm', 'effort receipt'); };
assert.equal(EFFORT_SCHEMA_VERSION, 1); assert.equal(parseDuration('0.05h'), 3);
assert.deepEqual(parseEffortOption('review=0m'), { minutes: { review: 0 } });
assert.deepEqual(parseCost('actual-usd:0.01'), [{ kind: 'actual-usd', cents: 1 }]);
assert.equal(typeof runRecord, 'function'); assert.equal(typeof runReport, 'function');
assert.ok((await loadTraceSchemas()).evidenceSchema); assert.ok((await loadParserSchemas()).traceSchema);
const lines = []; const io = { cwd: process.cwd(), stdout: t => lines.push(t), stderr: t => lines.push(t) };
assert.equal(await main(['trace', 'record', '--help'], io), 0);
for (const name of ['--effort', '--decisions', '--attempts', '--cost', '--note']) assert.ok(lines.join('\\n').includes(name));
const record = () => runEffortRecord({ root: process.cwd(), changeId: 'sample', effort: '0m', stdout: () => {} });
assert.equal(record(), 0); const dir = '.loomake/evidence/sample/effort'; const first = readdirSync(dir)[0];
const value = JSON.parse(readFileSync(dir + '/' + first, 'utf8')); assert.ok((await loadEffortSchema()).effortRecordSchema.safeParse(value).success);
assert.equal(value.totalMinutes, 0); assert.ok(!('verify' in value)); assert.ok(!('documents' in value)); commit();
mkdirSync('openspec/changes/archive', { recursive: true }); renameSync('openspec/changes/sample', 'openspec/changes/archive/2026-11-06-sample'); commit();
assert.equal(resolveChangeDir('openspec/changes', 'sample').kind, 'archived'); assert.equal(record(), 0); commit();
mkdirSync('openspec/changes/archive/2026-11-05-sample'); writeFileSync('openspec/changes/archive/2026-11-05-sample/.keep', ''); commit();
assert.equal(resolveChangeDir('openspec/changes', 'sample').kind, 'ambiguous'); assert.throws(record);
assert.equal(resolveChangeDir('openspec/changes', 'missing').kind, 'missing');
assert.throws(() => runEffortRecord({ root: process.cwd(), changeId: 'missing', effort: '1m', stdout: () => {} }));
`;
  const executed = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: consumer, encoding: 'utf8' });
  expect(executed.status, executed.stdout + executed.stderr).toBe(0);
  const types = join(consumer, 'effort-consumer.ts');
  writeFileSync(types, `import { loadEffortSchema, type EffortRecord, type EffortMinutes, type EffortCost } from '@loomake/core';
import { resolveChangeDir } from '@loomake/kit';
import { runEffortRecord, type EffortRecordOptions } from '@loomake/trace';
const minutes: EffortMinutes = { review: 0 }; const cost: EffortCost = { kind: 'tokens', count: 1 };
const value: EffortRecord = { schemaVersion: 1, kind: 'loomake-effort', change: 'sample', sha: 'a'.repeat(40), recordedAt: new Date().toISOString(), minutes, cost: [cost] };
const options: EffortRecordOptions = { root: '.', changeId: value.change, effort: '0m', stdout: () => {} };
const result: number = runEffortRecord(options); const location = resolveChangeDir('openspec/changes', 'sample');
void [result, location, loadEffortSchema];
`);
  const checked = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'nodenext', '--types', 'node', '--typeRoots', join(root, 'node_modules/@types'), types], { cwd: consumer, encoding: 'utf8' });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
}, 60000);

it('[REQ-473][REQ-475][REQ-476] tarballのreuse公開入口と5オプションのhelpを利用できる', () => {
  const destination = join(base, 'evidence-reuse');
  const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', destination], { cwd: root, encoding: 'utf8', env });
  expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
  const code = `
import assert from 'node:assert/strict';
import { readEvidenceRange, createGitEvidenceReader } from '@loomake/kit';
import { runReuse, reuseRecordProblem, REUSE_RECORD_VERSION } from '@loomake/trace';
import { main } from './node_modules/loomake/dist/main.js';
for (const fn of [readEvidenceRange, createGitEvidenceReader, runReuse, reuseRecordProblem]) assert.equal(typeof fn, 'function');
assert.equal(REUSE_RECORD_VERSION, 1);
assert.equal(typeof reuseRecordProblem({}, 'sample'), 'string');
const stdout = []; const stderr = [];
assert.equal(await main(['trace', 'reuse', '--help'], { cwd: '/not-a-repository', stdout: t => stdout.push(t), stderr: t => stderr.push(t) }), 0);
assert.equal(stdout.length, 1); assert.deepEqual(stderr, []);
for (const option of ['--change', '--summary', '--anchor', '--scope', '--json']) assert.ok(stdout[0].includes(option));
assert.ok(stdout[0].includes('真正性は確かめない'));
`;
  const executed = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: join(destination, 'consumer'), encoding: 'utf8' });
  expect(executed.status, executed.stdout + executed.stderr).toBe(0);
}, 60000);
