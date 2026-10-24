import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const base = mkdtempSync(join(tmpdir(), 'loomake artifacts '));
const target = join(base, 'prepared');
const run = (mode: string) => spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target], { cwd: root, encoding: 'utf8' });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('実際に配るパッケージ', () => {
  it('[REQ-143][REQ-146][REQ-169] packした5パッケージだけで主要コマンドと公開APIを使える', () => {
    const prepared = run('prepare');
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = run('check');
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toContain('配布物の検証に合格');
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
    const prepared = spawnSync(process.execPath, ['scripts/package-smoke.mjs', 'prepare', offlineTarget], { cwd: root, encoding: 'utf8', timeout: 60000 });
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
    const declaration = join(target, 'consumer/node_modules/@loomake/core/dist/verify-result.d.ts');
    const original = readFileSync(declaration, 'utf8');
    try {
      expect(original.split('ok: boolean')).toHaveLength(2);
      writeFileSync(declaration, original.replace('ok: boolean', 'ok: string'));
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
