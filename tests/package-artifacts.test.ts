import { afterAll, describe, expect, inject, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const base = mkdtempSync(join(tmpdir(), 'loomake artifacts '));
const target = join(base, 'prepared');
// prepare は、globalSetup が試験の前に 1 回だけ build と pack をした tarball を使う（tests/package-build.setup.ts）
const env = { ...process.env, LOOMAKE_PACKED_TARBALLS: inject('packedTarballs') };
const run = (mode: string) => spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target], { cwd: root, encoding: 'utf8', env });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('実際に配るパッケージ', () => {
  it('[REQ-324][REQ-325] ビルド済み生成入口とpackしたCLIの共通定義・help・usageが一致する', () => {
    const cliTarget = join(base, 'cli-reference');
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', cliTarget], { cwd: root, encoding: 'utf8', env });
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const generator = join(root, 'scripts/generate-cli-reference.mjs');
    // cwdを変えてもスクリプト自身の場所を基準に生成済みページを照合する。
    const checked = spawnSync(process.execPath, [generator, '--check'], { cwd: cliTarget, encoding: 'utf8' });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const argsUrl = pathToFileURL(join(cliTarget, 'consumer/node_modules/loomake/dist/args.js')).href;
    const mainUrl = pathToFileURL(join(cliTarget, 'consumer/node_modules/loomake/dist/main.js')).href;
    const generatorUrl = pathToFileURL(generator).href;
    const baselinePath = join(root, 'packages/cli/test/fixtures/reference-cli-baseline.json');
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
    throw new Error('packしたCLIが原本と異なります：' + JSON.stringify(item.argv));
  }
}
process.exitCode = await runCliReference({ definition: CLI_REFERENCE, check: true });
`], { cwd: cliTarget, encoding: 'utf8' });
    expect(packed.status, packed.stdout + packed.stderr).toBe(0);
  }, 60000);

  it('[REQ-057][REQ-138][REQ-139][REQ-143][REQ-146][REQ-169][REQ-304][REQ-305][REQ-306] packした5パッケージだけで主要コマンドと公開APIを使える', () => {
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
    const declaration = join(target, 'consumer/node_modules/@loomake/core/dist/verify-result-schema.d.ts');
    const original = readFileSync(declaration, 'utf8');
    try {
      expect(original.split('ok: z.ZodBoolean')).toHaveLength(2);
      writeFileSync(declaration, original.replace('ok: z.ZodBoolean', 'ok: z.ZodString'));
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
