import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { UsageError, type StaticMetricsReceipt } from '@loomake/kit';
import { EVAL_LOCK, QUALITY_FILES } from '../src/quality-files.js';
import { qualityExecutionFailure, testRunIncomplete } from '../src/quality-execution.js';
import { fixture, git } from './quality-eval-fixtures.js';

vi.setConfig({ testTimeout: 15_000 });
const payload = (value: unknown): StaticMetricsReceipt['report'] => ({ text: JSON.stringify(value), path: 'report.json', sha256: '' });
const report = (failed = false) => ({ success: !failed, numTotalTests: 1, numPassedTests: failed ? 0 : 1, numFailedTests: failed ? 1 : 0, numPendingTests: 0, numTodoTests: 0,
  testResults: [{ name: 'fixture', status: failed ? 'failed' : 'passed', assertionResults: [{ fullName: 'test', status: failed ? 'failed' : 'passed' }] }] });
const producer = { name: 'vitest', version: '5.0.5' };

describe('手動評価の実行と完了証拠', () => {
  it('[REQ-429][REQ-431][REQ-432] 実コマンドとC1で今回の出力だけ評価しFAILも保存成功0', async () => {
    const f = fixture(`const fs=require('node:fs');const value=${JSON.stringify(report(true))};value.startTime=Date.now();fs.writeFileSync('.loomake/test-report.json',JSON.stringify(value));process.exitCode=1;`);
    writeFileSync(join(f.root, '.loomake/test-report.json'), JSON.stringify(report()));
    expect(await f.evaluate()).toBe(0);
    const saved = f.storage(); expect(saved.ledgers.history).toHaveLength(1); expect(saved.index).toEqual(saved.ledgers.history[0]);
    expect(saved.index?.commands).toEqual([{ name: 'test', result: 'failed' }]);
    expect(saved.index?.observations[0]).toMatchObject({ status: 'measured', value: 1, samples: 1, observedAt: saved.index?.evaluatedAt });
    expect(saved.index?.summary.product.verdict).toBe('FAIL'); expect(saved.index?.summary.blockingUnmet).toEqual(['PQ-001']);
    expect(saved.ledgers.requests.map((r) => r.event)).toEqual(['accepted', 'started', 'evaluated']); expect(existsSync(join(f.root, EVAL_LOCK))).toBe(false);
  });
  it('[REQ-429] shell wrapperが0でも実際の失敗件数を維持する', async () => {
    const f = fixture(`const fs=require('node:fs');fs.writeFileSync('.loomake/test-report.json',JSON.stringify({...${JSON.stringify(report(true))},startTime:Date.now()}));`);
    expect(await f.evaluate()).toBe(0); expect(f.storage().index?.commands[0].result).toBe('passed');
    expect(f.storage().index?.observations[0]).toMatchObject({ status: 'measured', value: 1 });
  });
  it('[REQ-429] 出力がなければ前回を採用せず値なしnot_runを保存する', async () => {
    const f = fixture('process.exitCode=0;'); mkdirSync(join(f.root, '.loomake/coverage'), { recursive: true });
    writeFileSync(join(f.root, '.loomake/test-report.json'), JSON.stringify(report())); writeFileSync(join(f.root, '.loomake/coverage/coverage-summary.json'), '{}');
    expect(await f.evaluate()).toBe(0); expect(existsSync(join(f.root, '.loomake/coverage/coverage-summary.json'))).toBe(false);
    expect(f.storage().index?.observations[0]).toMatchObject({ status: 'not_run', detail: expect.stringContaining('途中で止まった可能性') });
    expect(f.storage().index?.observations[0]).not.toHaveProperty('value');
  });
  it('[REQ-429] dirtyと実行中のHEAD・基準・帳簿変化を保存せず失敗として残す', async () => {
    const dirty = fixture(); writeFileSync(join(dirty.root, 'untracked'), 'dirty');
    expect(await dirty.evaluate()).toBe(1); expect(dirty.storage().ledgers.attempts[0].failure).toBe('dirty'); expect(dirty.storage().ledgers.history).toEqual([]);
    for (const script of ["require('node:fs').appendFileSync('quality.yaml','\\n# changed\\n')", "require('node:child_process').execFileSync('git',['commit','--allow-empty','-m','new-head'])", "require('node:fs').appendFileSync('reports/quality/requests.jsonl',' \\n')"]) {
      const f = fixture(script); expect(await f.evaluate()).toBe(1); expect(existsSync(join(f.root, QUALITY_FILES.history))).toBe(false);
      const attempts = JSON.parse(f.read(QUALITY_FILES.attempts).trim()) as { failure: string }; expect(attempts.failure).toBe('changed');
    }
  });
  it('[REQ-429] 品質ファイルの不在・版・構文・内容不正は実行前に2相当で拒否する', async () => {
    for (const value of [null, 'version: 99\n', 'version: [', 'version: 2\nmodel: []\n']) {
      const f = fixture(); if (value === null) rmSync(join(f.root, 'quality.yaml')); else writeFileSync(join(f.root, 'quality.yaml'), value);
      await expect(f.evaluate()).rejects.toBeInstanceOf(UsageError); expect(existsSync(join(f.root, EVAL_LOCK))).toBe(false); expect(existsSync(join(f.root, QUALITY_FILES.requests))).toBe(false);
    }
  });
  it('[REQ-429][REQ-441] 実コマンドの時間切れはhistoryを変えずattemptへ残す', async () => {
    const f = fixture('setInterval(()=>{},1000);'); expect(await f.evaluate({ timeoutMs: 30 })).toBe(3);
    expect(f.storage().ledgers.history).toEqual([]); expect(f.storage().ledgers.attempts[0].failure).toBe('timeout');
  });
  it('[REQ-429] 出力上限・通知欠落・error・signalは全て不完了で分類する', () => {
    const config = { openspecDir: 'openspec', openspecValidate: false as const, tests: { report: 'report.json' }, commands: { test: 'test' }, unknownKeys: [] };
    expect(qualityExecutionFailure(config, [])).toBe('launch');
    expect(qualityExecutionFailure(config, [{ name: 'test', kind: 'output' }])).toBe('launch');
    expect(qualityExecutionFailure(config, [{ name: 'test', kind: 'error', code: 'ENOENT' }])).toBe('launch');
    expect(qualityExecutionFailure(config, [{ name: 'test', kind: 'signal', signal: 'SIGTERM' }])).toBe('interrupted');
    expect(qualityExecutionFailure(config, [{ name: 'test', kind: 'interrupted' }])).toBe('interrupted');
    expect(qualityExecutionFailure(config, [{ name: 'test', kind: 'exited', status: 1 }])).toBeUndefined();
  });
  it('[REQ-429] 明示的不完全性・条件E不成立・未実測producer/版を0でも拒否する', () => {
    for (const patch of [{ wasInterrupted: true }, { numRuntimeErrorTestSuites: 1 }, { numTotalTests: 2 }, { testResults: [] }, { success: false }, { numFailedTests: -1 }, { testResults: [{ name: 'empty', status: 'passed', assertionResults: [] }] }]) {
      expect(testRunIncomplete(payload({ ...report(), ...patch }), producer, 0)).toBeTypeOf('string');
    }
    for (const unknown of [null, { name: 'jest', version: '5.0.5' }, { name: 'vitest', version: '5.0.6' }]) expect(testRunIncomplete(payload(report(true)), unknown, 1)).toBeTypeOf('string');
    expect(testRunIncomplete(payload(report(true)), producer, 1)).toBeUndefined(); expect(testRunIncomplete(payload(report(true)), producer, 0)).toBeUndefined();
    const skip = report(); skip.numPendingTests = 1; skip.numTotalTests = 2; skip.testResults[0].assertionResults.push({ fullName: 'skip', status: 'pending' });
    // REQ-429の保留Scenarioは終了0にも適用する（Q70-31）。既存の成功pending入力を保持する。
    expect(testRunIncomplete(payload(skip), producer, 0)).toBeTypeOf('string');
  });
  it.each(['pending', 'skipped', 'todo'])('[REQ-429][REQ-430] 成功レポートの%sも終了0で完了証拠にしない', (status) => {
    const value = report(); value.numTotalTests = 2;
    if (status === 'todo') value.numTodoTests = 1; else value.numPendingTests = 1;
    value.testResults[0].assertionResults.push({ fullName: status, status });
    expect(testRunIncomplete(payload(value), producer, 0)).toBeTypeOf('string');
  });
  it('[REQ-434] 競合は既存lock bytes/mtimeと台帳を変えず未受付3', async () => {
    const f = fixture(); mkdirSync(join(f.root, '.loomake/quality'), { recursive: true });
    const file = join(f.root, EVAL_LOCK); writeFileSync(file, 'foreign lock'); const before = readFileSync(file), mtime = statSync(file).mtimeMs;
    expect(await f.evaluate()).toBe(3); expect(readFileSync(file)).toEqual(before); expect(statSync(file).mtimeMs).toBe(mtime); expect(existsSync(join(f.root, QUALITY_FILES.requests))).toBe(false);
  });
  it('[REQ-442] 有効な未コミットの帳簿で次の実評価を続け、stage/commitしない', async () => {
    const f = fixture(); const head = git(f.root, 'rev-parse', 'HEAD'); expect(await f.evaluate()).toBe(0); const old = f.read(QUALITY_FILES.history);
    expect(await f.evaluate()).toBe(0); expect(f.read(QUALITY_FILES.history).startsWith(old)).toBe(true); expect(f.storage().ledgers.history.map((r) => r.attempt)).toEqual([1, 2]);
    expect(git(f.root, 'rev-parse', 'HEAD')).toBe(head); expect(git(f.root, 'diff', '--cached', '--name-only')).toBe('');
  });
});
