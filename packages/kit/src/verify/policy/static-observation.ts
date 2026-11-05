import { parseTestReport, type Quality, type QualityMeasure } from '@loomake/core';
import type { QualityObservation } from './quality-conditions.js';

export type StaticCommandResult = { name: string; result: 'passed' | 'failed' | 'not_configured' };
type Payload = { path: string; text: string; sha256: string };
/** 呼出側が今回の実行から集めた事実。判定関数はI/O・時計を読まない（REQ-430）。 */
export type StaticMetricsReceipt = {
  producer: { name: string; version: string } | null;
  target: { before: string | null; after: string | null };
  basis: { before: string; after: string };
  invocation: { startedAt: number; finishedAt: number; testCleared: boolean; coverageCleared: boolean };
  commands: readonly StaticCommandResult[];
  report: Payload | null;
  coverage: Payload | null;
};

type Facts = Omit<QualityObservation, 'subject' | 'source' | 'metric'>;
type HashOptions = { sha256Hex: (text: string) => string };
const TEST_METRICS = ['tests_total', 'tests_failed', 'tests_passed'];
const COVERAGE_METRICS: Readonly<Record<string, string>> = { statements_pct: 'statements', branches_pct: 'branches', functions_pct: 'functions', lines_pct: 'lines' };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const facts = (status: QualityObservation['status'], detail: string, evidence: readonly string[] = []): Facts => ({ status, detail, evidence });

function eligibility(r: StaticMetricsReceipt): Facts | undefined {
  if (!r.target.before || !r.target.after) return facts('unverified', '対象のコミットを確かめられません');
  if (r.target.before !== r.target.after || r.basis.before !== r.basis.after) return facts('stale', '実行中に対象または品質基準が変わりました');
  if (!r.producer || !['vitest', 'jest'].includes(r.producer.name) || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(r.producer.version)) {
    return facts('ineligible', 'テストランナーと版を確かめられません');
  }
  const { startedAt, finishedAt } = r.invocation;
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) return facts('unverified', '実行の時間範囲を確かめられません');
  return undefined;
}

function measuredSource(r: StaticMetricsReceipt, source: string, options: HashOptions): { payload: Payload; evidence: string[] } | Facts {
  if (!r.commands.some((c) => c.name === 'test' && c.result !== 'not_configured')) return facts('not_run', 'test コマンドが設定されていません');
  const invalid = eligibility(r);
  if (invalid) return invalid;
  const test = source === 'ci.test_report';
  const payload = test ? r.report : r.coverage;
  const cleared = test ? r.invocation.testCleared : r.invocation.coverageCleared;
  if (!cleared) return facts('unverified', '前回の出力を消してから実行していません');
  if (!payload) return facts(test ? 'not_run' : 'unavailable', test ? 'テストのレポートがありません' : 'カバレッジの集計がありません');
  const evidence = [payload.path, `report:sha256:${payload.sha256}`, `target:${r.target.after}`, `basis:sha256:${r.basis.after}`, `producer:${r.producer?.name}@${r.producer?.version}`];
  if (options.sha256Hex(payload.text) !== payload.sha256) return facts('unverified', '出力のhashが本文と一致しません', evidence);
  return { payload, evidence };
}

function testFacts(r: StaticMetricsReceipt, metric: string, options: HashOptions): Facts {
  const source = measuredSource(r, 'ci.test_report', options);
  if (!('payload' in source)) return source;
  const parsed = parseTestReport(source.payload.path, source.payload.text);
  if (parsed.errors.length) return facts('unverified', 'テストのレポートを読めません', source.evidence);
  const { startTime, files, tests } = parsed.value;
  if (startTime === null) return facts('unverified', 'レポートに開始時刻がありません', source.evidence);
  if (startTime < r.invocation.startedAt || startTime > r.invocation.finishedAt) return facts('stale', '今回の実行で作られたレポートではありません', source.evidence);
  if (files.some((f) => f.status === 'failed' && f.tests === 0)) return facts('unverified', 'テストを実行できなかったファイルがあります', source.evidence);
  const executed = tests.filter((t) => t.status === 'passed' || t.status === 'failed');
  if (!executed.length) return facts('not_run', '実施したテストがありません', source.evidence);
  const value = metric === 'tests_total' ? executed.length : executed.filter((t) => t.status === (metric === 'tests_failed' ? 'failed' : 'passed')).length;
  return { status: 'measured', value, samples: executed.length, evidence: source.evidence };
}

function coverageFacts(r: StaticMetricsReceipt, metric: string, options: HashOptions): Facts {
  const source = measuredSource(r, 'ci.coverage', options);
  if (!('payload' in source)) return source;
  let value: unknown;
  try { value = JSON.parse(source.payload.text); }
  catch { return facts('unverified', 'カバレッジの集計をJSONとして読めません', source.evidence); }
  const total = object(value) && object(value.total) ? value.total : undefined;
  const entry = total?.[COVERAGE_METRICS[metric]];
  if (!object(entry) || typeof entry.pct !== 'number' || !Number.isFinite(entry.pct) || entry.pct < 0 || entry.pct > 100 || !Number.isSafeInteger(entry.total) || (entry.total as number) <= 0) {
    return facts('unavailable', '有限の割合と計測した対象数を取得できません', source.evidence);
  }
  return { status: 'measured', value: entry.pct, samples: entry.total as number, evidence: source.evidence };
}

function supports(m: QualityMeasure): boolean {
  return m.source === 'ci.test_report' ? TEST_METRICS.includes(m.metric)
    : m.source === 'ci.coverage' ? Object.hasOwn(COVERAGE_METRICS, m.metric)
      : m.source.startsWith('ci.command.') && m.source.length > 'ci.command.'.length && m.metric === 'error_count';
}

/** 既存の出力だけを観測し、件数を終了コードから作らない。PQだけが対象（REQ-430）。 */
export function observeStaticMetrics(quality: Quality, receipt: StaticMetricsReceipt | null, options: HashOptions): QualityObservation[] {
  const out: QualityObservation[] = [];
  const items = Object.entries(quality.product) as [string, { evidence: QualityMeasure[]; indicators: QualityMeasure[]; applicability?: string }][];
  for (const [subject, item] of items) {
    if (item.applicability === 'not_applicable') continue;
    const seen = new Set<string>();
    for (const m of [...item.evidence, ...item.indicators]) {
      const key = JSON.stringify([m.source, m.metric]);
      if (!supports(m) || seen.has(key)) continue;
      seen.add(key);
      let result: Facts;
      if (!receipt) result = facts('not_run', '品質コマンドを実行していません');
      else if (m.source.startsWith('ci.command.')) {
        const name = m.source.slice('ci.command.'.length);
        const configured = receipt.commands.some((c) => c.name === name && c.result !== 'not_configured');
        result = configured ? facts('unavailable', '既存の品質コマンドの出力から件数を取得できません（終了コードは件数ではありません）') : facts('not_run', `品質コマンド ${name} が設定されていません`);
      } else result = m.source === 'ci.test_report' ? testFacts(receipt, m.metric, options) : coverageFacts(receipt, m.metric, options);
      out.push({ subject, source: m.source, metric: m.metric, ...result });
    }
  }
  return out;
}
