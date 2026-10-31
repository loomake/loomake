import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { MEASURE_TEST_FILES, saveMeasureMetadata } from '../scripts/ci-measure-metadata.mjs';

const originalMeasureFiles = [
  'packages/runner/test/external-budget.test.ts',
  'tests/ai-journeys.test.ts',
  'tests/domain-mutations.test.ts',
  'tests/package-artifacts.test.ts',
  'packages/runner/test/publication-retry.test.ts',
  'packages/runner/test/evidence-storage.test.ts',
  'packages/runner/test/auth-prompts.test.ts',
  'packages/runner/test/engine-long-deadline.test.ts',
  'packages/runner/test/guards.test.ts',
  'packages/runner/test/pr.test.ts',
  'packages/runner/test/run-no-change.test.ts',
  'packages/runner/test/run.test.ts',
  'packages/runner/test/scenario-timeout-evidence.test.ts',
  'packages/runner/test/signal-during-sync.test.ts',
  'tests/domain-mutations-conditions.test.ts',
] as const;
const movedMeasureFiles = ['packages/runner/test/run-timeout.test.ts', 'packages/runner/test/external-budget-deadline.test.ts'] as const;
const requiredMeasureFiles = [...originalMeasureFiles, ...movedMeasureFiles];

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
    expect(result).toEqual({ schemaVersion: 2, selection: 'all', checkoutSha: sha, node: process.version, os: process.platform, sample: 2, requiredFiles: MEASURE_TEST_FILES, files: [], missingRequiredFiles: MEASURE_TEST_FILES, collectionState: 'recorded', testOutcome: 'failure', reportPresent: true });
    expect(readFileSync(join(directory, 'test-report.json'))).toEqual(raw);
    expect(JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'))).toEqual(result);
    expect(readdirSync(directory).sort()).toEqual(['metadata.json', 'test-report.json']);
    expect(readFileSync(join(directory, 'metadata.json'), 'utf8')).not.toContain('must-not-be-copied');
  });

  it('全件の実suiteと旧15file・移動先2fileの包含を記録し、新suiteと同名の多重度を失わない', () => {
    const repo = repository(); const directory = fixture();
    const files = [...requiredMeasureFiles, 'tests/test-partition-integration.test.ts', 'tests/claude-result-timer-validation.test.ts', originalMeasureFiles[0]];
    mkdirSync(join(repo, '.loomake'));
    writeFileSync(join(repo, '.loomake/test-report.json'), JSON.stringify({ testResults: files.map((file) => ({ name: join(repo, file), assertionResults: [] })) }));
    const result = saveMeasureMetadata(repo, directory, 1, 'success');
    expect(result).toMatchObject({ schemaVersion: 2, selection: 'all', collectionState: 'recorded', requiredFiles: MEASURE_TEST_FILES, missingRequiredFiles: [] });
    expect(result.files).toEqual(files);
    expect(result.files!.filter((file: string) => file === MEASURE_TEST_FILES[0])).toHaveLength(2);
    expect(MEASURE_TEST_FILES.slice(0, 15)).toEqual(originalMeasureFiles);
    expect(MEASURE_TEST_FILES).toEqual(requiredMeasureFiles);
    expect(MEASURE_TEST_FILES).toHaveLength(17);
  });

  it.each(movedMeasureFiles)('旧15fileがすべてあっても移動先の欠落を記録する: %s', (missing) => {
    const repo = repository(); const directory = fixture();
    const files = requiredMeasureFiles.filter((file) => file !== missing);
    const raw = JSON.stringify({ testResults: files.map((file) => ({ name: join(repo, file), assertionResults: [] })), success: false });
    mkdirSync(join(repo, '.loomake'));
    writeFileSync(join(repo, '.loomake/test-report.json'), raw);
    const result = saveMeasureMetadata(repo, directory, 2, 'failure');
    expect(result).toMatchObject({ schemaVersion: 2, selection: 'all', sample: 2, collectionState: 'recorded', files, missingRequiredFiles: [missing], testOutcome: 'failure', reportPresent: true });
    expect(readFileSync(join(directory, 'test-report.json'), 'utf8')).toBe(raw);
  });

  it('repoのsymlink表記と実パスのsuiteを同じrepo内として記録する', () => {
    const repo = repository(); const directory = fixture(); const alias = join(fixture(), 'alias');
    symlinkSync(repo, alias, 'junction');
    mkdirSync(join(repo, '.loomake'));
    writeFileSync(join(repo, '.loomake/test-report.json'), JSON.stringify({ testResults: [{ name: join(realpathSync(repo), 'tests/additional.test.ts') }] }));
    expect(saveMeasureMetadata(alias, directory, 1, 'success')).toMatchObject({ collectionState: 'recorded', files: ['tests/additional.test.ts'] });
  });

  it('全件の指定でも元対象が欠けたreportを包含済みと記録しない', () => {
    const repo = repository(); const directory = fixture();
    mkdirSync(join(repo, '.loomake'));
    writeFileSync(join(repo, '.loomake/test-report.json'), JSON.stringify({ testResults: MEASURE_TEST_FILES.slice(1).map((file) => ({ name: join(repo, file) })) }));
    expect(saveMeasureMetadata(repo, directory, 2, 'failure')).toMatchObject({ selection: 'all', files: MEASURE_TEST_FILES.slice(1), missingRequiredFiles: [MEASURE_TEST_FILES[0]], collectionState: 'recorded', testOutcome: 'failure' });
  });

  it('不正なreportやrepo外のsuiteを固定の不正状態にし、元JSONを保存する', () => {
    const repo = repository(); const directory = fixture();
    mkdirSync(join(repo, '.loomake'));
    for (const raw of ['{', '{}', '{"testResults":{}}', JSON.stringify({ testResults: [{ name: 'relative.test.ts' }] }), JSON.stringify({ testResults: [{ name: join(repo, '..', 'outside.test.ts') }] }), JSON.stringify({ testResults: [{ name: join(repo, 'not-a-test.txt') }] })]) {
      writeFileSync(join(repo, '.loomake/test-report.json'), raw);
      expect(saveMeasureMetadata(repo, directory, 3, 'failure')).toMatchObject({ selection: 'all', collectionState: 'invalid', files: null, missingRequiredFiles: null, reportPresent: true, testOutcome: 'failure' });
      expect(readFileSync(join(directory, 'test-report.json'), 'utf8')).toBe(raw);
    }
  });

  it('未実行やJSON欠損を成功にせず、以前コピーしたreportを残さない', () => {
    const repo = repository(); const directory = fixture();
    writeFileSync(join(directory, 'test-report.json'), 'previous-report');
    expect(saveMeasureMetadata(repo, directory, 1, 'skipped')).toMatchObject({ sample: 1, testOutcome: 'skipped', reportPresent: false, selection: 'all', collectionState: 'missing', files: null, missingRequiredFiles: null });
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
  it('計測branchへのpushだけで3OS×3sampleを実行し、元15fileを含む全件を選ぶ', () => {
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
    expect(new Set(MEASURE_TEST_FILES).size).toBe(17);
    expect(MEASURE_TEST_FILES).toEqual(requiredMeasureFiles);
    expect(MEASURE_TEST_FILES.every((file) => existsSync(join(root, file)))).toBe(true);
    expect(workflow).not.toContain('MEASURE_FILES');
    expect(stepOf('id: test').match(/^ {8}run: (.*)$/m)![1]).toBe('pnpm test');
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
