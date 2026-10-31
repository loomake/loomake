import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { MEASURE_TEST_FILES, saveMeasureMetadata } from '../scripts/ci-measure-metadata.mjs';

const root = join(import.meta.dirname, '..');
const directories: string[] = [];
const fixture = () => { const dir = mkdtempSync(join(tmpdir(), 'loomake-measure-')); directories.push(dir); return dir; };
afterEach(() => { vi.unstubAllEnvs(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const repository = () => {
  const dir = fixture();
  execFileSync('git', ['init', '--quiet', dir]);
  execFileSync('git', ['-c', 'user.name=Measure Test', '-c', 'user.email=measure@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: dir });
  return dir;
};

describe('速度対策の測定metadata', () => {
  it('CLIは別cwdからも自身のrepoを記録し、入力エラーの値を出力しない', () => {
    const directory = join(fixture(), 'saved');
    const script = join(root, 'scripts/ci-measure-metadata.mjs');
    const saved = spawnSync(process.execPath, [script, directory, '3', 'failure'], { cwd: fixture(), encoding: 'utf8' });
    expect(saved.status, saved.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'))).toMatchObject({
      checkoutSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sample: 3, testOutcome: 'failure',
    });
    const invalid = spawnSync(process.execPath, [script, directory, '3', 'must-not-be-printed'], { encoding: 'utf8' });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('計測metadataを保存できませんでした');
    expect(invalid.stderr).not.toContain('must-not-be-printed');
  });

  it('失敗時も元JSONをそのまま保存し、実HEADと固定項目だけを残す', () => {
    const repo = repository(); const directory = join(fixture(), 'saved');
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    vi.stubEnv('GITHUB_SHA', 'f'.repeat(40));
    vi.stubEnv('MEASURE_PRIVATE_VALUE', 'must-not-be-copied');
    mkdirSync(join(repo, '.loomake'));
    const raw = Buffer.from('{"testResults":[],"success":false}\r\n');
    writeFileSync(join(repo, '.loomake/test-report.json'), raw);
    const result = saveMeasureMetadata(repo, directory, 2, 'failure');
    expect(result).toEqual({ schemaVersion: 1, checkoutSha: sha, node: process.version, os: process.platform, sample: 2, files: MEASURE_TEST_FILES, testOutcome: 'failure', reportPresent: true });
    expect(readFileSync(join(directory, 'test-report.json'))).toEqual(raw);
    expect(JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'))).toEqual(result);
    expect(readdirSync(directory).sort()).toEqual(['metadata.json', 'test-report.json']);
    expect(readFileSync(join(directory, 'metadata.json'), 'utf8')).not.toContain('must-not-be-copied');
  });

  it('未実行やJSON欠損を成功にせず、以前コピーしたreportを残さない', () => {
    const repo = repository(); const directory = fixture();
    writeFileSync(join(directory, 'test-report.json'), 'previous-report');
    expect(saveMeasureMetadata(repo, directory, 1, 'skipped')).toMatchObject({ sample: 1, testOutcome: 'skipped', reportPresent: false });
    expect(existsSync(join(directory, 'test-report.json'))).toBe(false);
    for (const [sample, outcome] of [[0, 'success'], [4, 'failure'], [1, 'untrusted-value']] as const)
      expect(() => saveMeasureMetadata(repo, join(directory, 'invalid'), sample, outcome)).toThrow();
    expect(existsSync(join(directory, 'invalid'))).toBe(false);
  });
});

const workflow = readFileSync(join(root, '.github/workflows/measure-slow-tests.yml'), 'utf8').replace(/\r\n/g, '\n');
const steps = workflow.slice(workflow.indexOf('\n    steps:\n')).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
const stepOf = (text: string) => { const found = steps.find((step) => step.includes(text)); expect(found, text).toBeDefined(); return found!; };
const evaluate = (expression: string, cancelled: boolean) => runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), { cancelled: () => cancelled });

describe('速度対策の測定経路', () => {
  it('計測branchへのpushだけで3OS×3sampleを実行し、既存15fileを全件選ぶ', () => {
    const onStart = workflow.indexOf('\non:\n'); const permissions = workflow.indexOf('\npermissions:\n');
    expect(onStart).toBeGreaterThan(0); expect(permissions).toBeGreaterThan(onStart);
    expect(workflow.slice(onStart + 5, permissions).trim()).toBe("push:\n    branches: ['ci/measure-*']");
    expect(workflow).toContain('fail-fast: false');
    const os = workflow.match(/^ {8}os: \[([^\]]+)\]$/m)![1]!.split(', ');
    const samples = workflow.match(/^ {8}sample: \[([^\]]+)\]$/m)![1]!.split(', ').map(Number);
    expect(os).toEqual(['ubuntu-latest', 'macos-latest', 'windows-latest']); expect(samples).toEqual([1, 2, 3]);
    expect(new Set(os.flatMap((value) => samples.map((sample) => `${value}-${sample}`))).size).toBe(9);
    expect(stepOf('node-version:')).toContain('node-version: 24');
    expect(stepOf('actions/checkout@')).toContain('ref: ${{ github.sha }}');
    const files = workflow.match(/^ {6}MEASURE_FILES: >-\n((?: {8}[^\n]+\n)+)/m)![1]!.trim().split(/\s+/);
    expect(files).toEqual(MEASURE_TEST_FILES); expect(new Set(files).size).toBe(15);
    expect(files.every((file) => existsSync(join(root, file)))).toBe(true);
    expect(stepOf('id: test').match(/^ {8}run: (.*)$/m)![1]).toBe('pnpm test $MEASURE_FILES');
    expect(workflow).not.toMatch(/continue-on-error|--shard|--retry|--maxWorkers|--reporter|--outputFile|--testNamePattern|--testTimeout|--project|\bTMP\b|\bTEMP\b|LOOMAKE_/);
  });

  it('試験失敗後も保存し、キャンセル時だけ飛ばす。sampleごとの成果物を混ぜない', () => {
    const metadata = stepOf('id: metadata'); const upload = stepOf('actions/upload-artifact@');
    for (const step of [metadata, upload]) {
      const condition = step.match(/^ {8}if: (.*)$/m)?.[1] ?? step.match(/^ {6}if: (.*)$/m)![1]!;
      expect(Boolean(evaluate(condition, false))).toBe(true); expect(Boolean(evaluate(condition, true))).toBe(false);
    }
    expect(steps.indexOf(metadata)).toBeGreaterThan(steps.indexOf(stepOf('id: test')));
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(metadata));
    expect(metadata).toContain('TEST_OUTCOME: ${{ steps.test.outcome }}');
    expect(metadata).toContain('MEASURE_SAMPLE: ${{ matrix.sample }}');
    expect(upload).toContain('ci-measure-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.os }}-${{ matrix.sample }}');
    expect(upload).toContain('path: ${{ runner.temp }}/loomake-ci-measure/');
    expect(upload).toContain('retention-days: 7');
    expect(upload).toContain('if-no-files-found: warn');
  });
});
