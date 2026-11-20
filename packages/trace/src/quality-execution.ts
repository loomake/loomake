import { lstatSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createInputReader, JSON_LIMITS, observeStaticMetrics, sha256Hex, UsageError,
  type LoomakeConfig, type QualityCommandOutcome, type StaticCommandResult, type StaticMetricsReceipt } from '@loomake/kit';
import type { Quality } from '@loomake/core';
import { nonnegativeInteger, qualityObject } from './quality-model.js';
import { EVAL_LOCK, QUALITY_FILES } from './quality-files.js';

export const COVERAGE_REPORT = '.loomake/coverage/coverage-summary.json';
export type Producer = StaticMetricsReceipt['producer'];

/** Runner metadata is read only from this project, never an unrelated parent or a global executable. */
export function qualityProducer(root: string): Producer {
  for (const name of ['vitest', 'jest']) {
    try {
      const value: unknown = JSON.parse(createInputReader().read(join(root, 'node_modules', name, 'package.json')));
      if (qualityObject(value) && value.name === name && typeof value.version === 'string') return { name, version: value.version };
    } catch { /* Unknown producer remains unmeasured. */ }
  }
  return null;
}

/** Never traverse a link when clearing or collecting either fixed output. */
function outputPath(root: string, relative: string): string {
  const parts = relative.split('/');
  for (let i = 0; i < parts.length; i++) {
    try {
      const stat = lstatSync(join(root, ...parts.slice(0, i + 1)));
      if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new UsageError('評価の出力先は通常のファイルとディレクトリにしてください');
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error; }
  }
  return join(root, relative);
}

/** 大文字小文字を区別しないファイルシステムでも同じ実体を指す保護パスを拒否する。 */
function overlapsProtected(report: string): boolean {
  const target = report.toLowerCase();
  const protectedFiles = ['quality.yaml', 'loomake.config.json', EVAL_LOCK, ...Object.values(QUALITY_FILES)].map((file) => file.toLowerCase());
  return protectedFiles.some((file) => file === target || file.startsWith(`${target}/`) || target.startsWith(`${file}/`));
}

/** 設定の誤りとして、ロックを取る前に呼ぶ（design 手順 1）。 */
export function assertReportOutsideProtected(report: string): void {
  if (overlapsProtected(report)) throw new UsageError('テストのレポート先に品質基準・設定・評価の帳簿は指定できません');
}

export function clearQualityOutputs(root: string, report: string): void {
  assertReportOutsideProtected(report);
  for (const file of new Set([report, COVERAGE_REPORT])) {
    try { unlinkSync(outputPath(root, file)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new UsageError('前回の品質出力を消せません。出力先と権限を確認してください'); }
  }
}

export function collectQualityPayload(root: string, path: string): StaticMetricsReceipt['report'] {
  try { const text = createInputReader(JSON_LIMITS).read(outputPath(root, path)); return { path, text, sha256: sha256Hex(text) }; }
  catch { return null; }
}

export function qualityCommands(config: LoomakeConfig, outcomes: readonly QualityCommandOutcome[]): StaticCommandResult[] {
  return Object.entries(config.commands).map(([name, command]) => ({ name,
    result: !command ? 'not_configured' : outcomes.some((outcome) => outcome.name === name && outcome.kind === 'exited' && outcome.status === 0) ? 'passed' : 'failed' }));
}

export function qualityExecutionFailure(config: LoomakeConfig, outcomes: readonly QualityCommandOutcome[]): 'timeout' | 'interrupted' | 'launch' | undefined {
  for (const [name, command] of Object.entries(config.commands)) {
    if (!command) continue;
    const found = outcomes.filter((outcome) => outcome.name === name);
    if (found.length !== 1) return 'launch';
    const outcome = found[0];
    if (outcome.kind === 'timeout') return 'timeout';
    if (outcome.kind === 'signal' || outcome.kind === 'interrupted') return 'interrupted';
    if (outcome.kind !== 'exited') return 'launch';
  }
  return undefined;
}

/** Explicit completeness checks; this does not claim to detect every hidden bail mechanism. */
export function testRunIncomplete(report: StaticMetricsReceipt['report'], producer: Producer, exitStatus: number): string | undefined {
  if (!report) return 'レポートなし';
  let data: unknown;
  try { data = JSON.parse(report.text); } catch { return 'JSON不正'; }
  if (!qualityObject(data) || !Array.isArray(data.testResults) || !data.testResults.length) return 'テストファイルなし';
  if (data.wasInterrupted === true || (data.numRuntimeErrorTestSuites !== undefined && data.numRuntimeErrorTestSuites !== 0)) return '中断またはruntime error';
  const counts = { passed: 0, failed: 0, pending: 0, todo: 0 };
  for (const file of data.testResults) {
    if (!qualityObject(file) || !['passed', 'failed', 'skipped', 'pending', 'todo'].some((status) => file.status === status)
      || !Array.isArray(file.assertionResults) || !file.assertionResults.length) return '空または不正なファイル';
    let failures = 0;
    for (const assertion of file.assertionResults) {
      if (!qualityObject(assertion) || typeof assertion.fullName !== 'string') return '不正なassertion';
      if (assertion.status === 'passed') counts.passed++;
      else if (assertion.status === 'failed') { counts.failed++; failures++; }
      else if (assertion.status === 'todo') counts.todo++;
      else if (assertion.status === 'pending' || assertion.status === 'skipped') counts.pending++;
      else return '未知のassertion状態';
    }
    if ((file.status === 'failed') !== (failures > 0)) return 'ファイルの成否不整合';
  }
  const expected = { numPassedTests: counts.passed, numFailedTests: counts.failed, numPendingTests: counts.pending,
    numTodoTests: counts.todo, numTotalTests: counts.passed + counts.failed + counts.pending + counts.todo };
  for (const [key, count] of Object.entries(expected)) if (!nonnegativeInteger(data[key]) || data[key] !== count) return '件数不整合';
  if (counts.pending || counts.todo || data.testResults.some((file: unknown) => qualityObject(file) && file.status !== 'passed' && file.status !== 'failed')) return '保留を含むレポート';
  const failed = exitStatus !== 0 || counts.failed > 0 || data.success === false;
  if (failed) {
    if (producer?.name !== 'vitest' || producer.version !== '5.0.5') return '未実測のproducer/版';
    if (data.success !== false || !counts.failed || counts.pending || counts.todo
      || data.testResults.some((file: unknown) => !qualityObject(file) || (file.status !== 'passed' && file.status !== 'failed'))) return '条件E未成立';
  } else if (data.success !== true || !counts.passed) return '成功を照合できない';
  return undefined;
}

export function staticEvaluationObservations(quality: Quality, receipt: StaticMetricsReceipt | null, incomplete?: string) {
  return observeStaticMetrics(quality, receipt, { sha256Hex }).map((observation) => !receipt && incomplete
    ? { ...observation, detail: `途中で止まった可能性を否定できないため、件数を測定していません（${incomplete}）` } : observation);
}
