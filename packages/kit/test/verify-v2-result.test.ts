import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyResultSchemas, type VerifyCheckResult } from '@loomake/core';
import {
  RUN_ERRORS_CHECK, RuntimeFailure, UsageError, assembleVerifyResult, formatVerifyResult, runVerify, verifyAbortedResult, verifyExitCode,
} from '@loomake/kit';
import { CHANGE, COPY_REPORT, reportJson, withProject } from './project.js';

vi.setConfig({ testTimeout: 60_000 });

const { verifyResultSchema } = await loadVerifyResultSchemas();
const pass = (id: string): VerifyCheckResult => ({ id, result: 'PASS', reason: '', evidence: [] });
const fail = (id: string): VerifyCheckResult => ({ id, result: 'FAIL', reason: '違反', evidence: [] });
const na = (id: string): VerifyCheckResult => ({ id, result: 'NOT_APPLICABLE', reason: '対象外', evidence: [] });
const runtime = { kind: 'runtime' as const, target: 'command: test', message: '中断されたので止めました', next: '確かめる' };
const decision = { required: true, reasons: [{ code: 'APPROVAL_REQUIRED' as const, target: 'A-01', message: '仮定の承認が必要です' }] };

describe('2.0.0 の結果の組み立て', () => {
  it('[REQ-311] partial の ci では PASS を出さず、実行エラーを不足の check として数える', () => {
    const checks = [pass('a')];
    const r = assembleVerifyResult({ change: 'c1', scope: 'ci', checks, errors: [runtime] });
    expect(r).toMatchObject({ scope: 'ci', run: { status: 'partial', errors: [runtime] }, verdict: 'INSUFFICIENT_EVIDENCE' });
    expect(r.checks.map((c) => [c.id, c.result])).toEqual([['a', 'PASS'], [RUN_ERRORS_CHECK, 'INSUFFICIENT_EVIDENCE']]);
    expect(r.summary).toEqual({ fail: 0, insufficient: 1, not_applicable: 0, evaluated: 2 });
    expect(checks).toEqual([pass('a')]);
    expect(verifyExitCode(r)).toBe(1);
    expect(verifyResultSchema.safeParse(r).success).toBe(true);
  });

  it('[REQ-311] partial の local は未完了を数え、終了コードを 0 にしない', () => {
    const r = assembleVerifyResult({ change: 'c1', scope: 'local', checks: [pass('a')], errors: [runtime] });
    expect(r).toMatchObject({ scope: 'local', run: { status: 'partial' }, summary: { pending: 1 } });
    expect(r).not.toHaveProperty('verdict');
    expect(verifyExitCode(r)).toBe(1);
  });

  it('[REQ-311] ci の 0 件と全件 NOT_APPLICABLE は PASS にしない。NA は evaluated に数える', () => {
    const empty = assembleVerifyResult({ change: 'c1', scope: 'ci', checks: [] });
    expect(empty).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE', summary: { evaluated: 0 } });
    const allNa = assembleVerifyResult({ change: 'c1', scope: 'ci', checks: [na('a'), na('b')] });
    expect(allNa).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE', summary: { not_applicable: 2, evaluated: 2 } });
    const mixed = assembleVerifyResult({ change: 'c1', scope: 'ci', checks: [pass('a'), na('b')] });
    expect(mixed).toMatchObject({ run: { status: 'completed', errors: [] }, verdict: 'PASS' });
    expect(verifyExitCode(mixed)).toBe(0);
    for (const r of [empty, allNa]) expect(verifyExitCode(r)).toBe(1);
  });

  it('[REQ-311] 要判断と FAIL が同時にあれば、どちらも保持して終了コード 1。local の完了は最終合格と表示しない', () => {
    const r = assembleVerifyResult({ change: 'c1', scope: 'ci', checks: [fail('a')], decision });
    expect(r).toMatchObject({ decision, verdict: 'FAIL', summary: { fail: 1 } });
    expect(verifyExitCode(r)).toBe(1);
    const local = assembleVerifyResult({ change: 'c1', scope: 'local', checks: [pass('a')] });
    expect(verifyExitCode(local)).toBe(0);
    expect(formatVerifyResult(local).split('\n').at(-1)).toBe('ローカルの項目はすべて完了（CI の最終合格ではありません）');
    expect(formatVerifyResult(local)).not.toMatch(/^合格$/m);
    const decided = assembleVerifyResult({ change: 'c1', scope: 'local', checks: [pass('a')], decision });
    expect(verifyExitCode(decided)).toBe(1);
  });

  it('[REQ-311][REQ-041] 例外を aborted にする。使い方と設定の誤りは 2、実行時の失敗は 3', () => {
    const usage = verifyAbortedResult(new UsageError('--change <id> が必要です'), null, '--spec-only');
    const config = verifyAbortedResult(new UsageError('loomake.config.json の commands は…'), 'c1');
    const runtimeError = verifyAbortedResult(new RuntimeFailure('読めません'), 'c1');
    expect(usage).toEqual({ schemaVersion: '2.0.0', change: null, run: { status: 'aborted', errors: [expect.objectContaining({ kind: 'usage', target: '--spec-only', message: '--change <id> が必要です' })] } });
    expect(config.run.errors[0].kind).toBe('config');
    expect(runtimeError.run.errors[0].kind).toBe('runtime');
    expect([usage, config, runtimeError].map(verifyExitCode)).toEqual([2, 2, 3]);
    for (const r of [usage, config, runtimeError]) {
      expect(verifyResultSchema.safeParse(r).success).toBe(true);
      expect(r.run.errors[0].next).not.toBe('');
      expect(formatVerifyResult(r)).toContain('中止しました');
    }
  });
});

describe('runVerify の 2.0.0', () => {
  it('[REQ-311] scope を省くと、完了ゲートは ci、仕様ゲートと change なしは local。明示した scope はそのまま使う', () => {
    const results = withProject({ config: { openspecValidate: false, commands: {} } }, (root) => [
      runVerify({ root, changeId: CHANGE, gate: 'done' }),
      runVerify({ root, changeId: CHANGE, gate: 'spec-only' }),
      runVerify({ root }),
      runVerify({ root, changeId: CHANGE, gate: 'done', scope: 'local' }),
    ]);
    expect(results.map((r) => ('scope' in r ? r.scope : undefined))).toEqual(['ci', 'local', 'local', 'local']);
    for (const r of results) expect(verifyResultSchema.safeParse(r).success, JSON.stringify(r)).toBe(true);
    expect(results[0]).toHaveProperty('verdict');
    expect(results[3]).not.toHaveProperty('verdict');
  });

  it('[REQ-040] 今回の test コマンドで成功したテストを取得したら、coverage に要件ごとのテストファイルを出す', () => {
    const config = { openspecValidate: false, commands: { test: COPY_REPORT } };
    const r = withProject({ config }, (root) => {
      writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
      return runVerify({ root, changeId: CHANGE, gate: 'done' });
    });
    expect(r).toMatchObject({ scope: 'ci', verdict: 'PASS', coverage: { 'REQ-012': ['tests/a.test.ts'] } });
    expect(verifyExitCode(r)).toBe(0);
  });

  it('[REQ-040] --skip-commands では前回の成功レポートがあっても coverage を出さず、不足で終了コード 1', () => {
    const r = withProject({ config: { openspecValidate: false, commands: { test: 'node -e ""' } } }, (root) => {
      mkdirSync(join(root, '.loomake'), { recursive: true });
      writeFileSync(join(root, '.loomake', 'test-report.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
      return runVerify({ root, changeId: CHANGE, gate: 'done', skipCommands: true });
    });
    expect(r).not.toHaveProperty('coverage');
    expect(r).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE', summary: { insufficient: 2 } });
    expect(verifyExitCode(r)).toBe(1);
  });
});
