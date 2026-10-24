import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyMutation, mutateOnce } from '../scripts/domain-mutations.mjs';

const names = ['[REQ-148] agreement'];
const report = (status = 'passed', failureMessages: string[] = []) => ({
  numRuntimeErrorTestSuites: 0,
  numTotalTests: 1,
  numPassedTests: status === 'passed' ? 1 : 0,
  numFailedTests: status === 'failed' ? 1 : 0,
  numPendingTests: status === 'pending' ? 1 : 0,
  numTodoTests: 0,
  success: status === 'passed',
  testResults: [{ assertionResults: [{ fullName: names[0], status, failureMessages }] }],
});

describe('mutationの検出と試験エラーの区別', () => {
  it('[REQ-162] 同じテストのassertion失敗だけを検出として数える', () => {
    expect(classifyMutation(1, report('failed', ['AssertionError: expected false to be true']), names)).toEqual({ status: 'killed', failedTests: names });
    expect(classifyMutation(0, report(), names)).toEqual({ status: 'survived', failedTests: [] });
  });

  it.each([
    [null, report('failed', ['AssertionError: expected true'])],
    [1, undefined],
    [1, { testResults: [] }],
    [1, report('failed', ['TypeError: cannot read value'])],
    [1, report('failed', ['Error: Test timed out'])],
    [0, report('pending')],
    [0, { ...report(), success: false }],
    [0, { ...report(), numTotalTests: undefined }],
    [0, { ...report(), numFailedTests: 1 }],
    [0, { ...report(), numRuntimeErrorTestSuites: undefined }],
    [1, { ...report('failed', ['AssertionError: expected true']), numRuntimeErrorTestSuites: 1 }],
    [1, { testResults: [{ assertionResults: [] }] }],
  ])('[REQ-162] 不成立の試行 %j を検出として数えない', (exitCode, value) => {
    expect(classifyMutation(exitCode, value, names).status).toBe('error');
  });

  it('[REQ-162] テスト名の追加・欠落・重複を成功扱いにしない', () => {
    expect(classifyMutation(1, report('failed', ['AssertionError: expected true']), ['different']).status).toBe('error');
    const value = report();
    value.testResults[0].assertionResults.push(value.testResults[0].assertionResults[0]);
    expect(classifyMutation(0, value, names).status).toBe('error');
  });

  it('[REQ-163] 変更箇所が一意の場合だけコピーの文字列を変更する', () => {
    expect(mutateOnce('a b c', 'b', 'B')).toBe('a B c');
    expect(() => mutateOnce('a b b', 'b', 'B')).toThrow('1か所');
    expect(() => mutateOnce('a b', 'c', 'C')).toThrow('1か所');
  });
});

describe('既存のドメインテストで13条件を壊して確認する', () => {
  it('[REQ-161][REQ-162][REQ-163] 正常な実装と13条件を実行し、元ファイルと通常のレポートを変更しない', () => {
    const root = join(import.meta.dirname, '..');
    const parent = join(root, '.loomake/quality');
    mkdirSync(parent, { recursive: true });
    const target = join(parent, `domain-mutations-${randomUUID()}`);
    const normalReport = join(root, '.loomake/test-report.json');
    const before = existsSync(normalReport) ? readFileSync(normalReport, 'utf8') : undefined;
    try {
      const result = spawnSync(process.execPath, ['scripts/domain-mutations.mjs', target], { cwd: root, encoding: 'utf8', timeout: 180000 });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const summary = JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'));
      expect(summary.scope).toBe('selected-domain-conditions');
      expect(summary.baseline.status).toBe('passed');
      expect(summary.baseline.tests).toHaveLength(10);
      expect(summary.mutations).toHaveLength(13);
      expect(summary.mutations.every((m: { status: string; failedTests: string[] }) => m.status === 'killed' && m.failedTests.length > 0)).toBe(true);
      expect(summary.originalsUnchanged).toBe(true);
      for (const source of summary.sources) {
        expect(createHash('sha256').update(readFileSync(join(root, source.path))).digest('hex')).toBe(source.sha256);
      }
      expect(existsSync(normalReport) ? readFileSync(normalReport, 'utf8') : undefined).toBe(before);
      const rerun = spawnSync(process.execPath, ['scripts/domain-mutations.mjs', target], { cwd: root, encoding: 'utf8' });
      expect(rerun.status).toBe(1);
      expect(JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'))).toEqual(summary);
    } finally { rmSync(target, { recursive: true, force: true }); }
  }, 200000);
});
