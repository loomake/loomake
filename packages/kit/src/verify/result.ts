// verify 2.0.0 の結果を組み立てる（REQ-311）。scope・実行状態・summary・verdict の整合は、ここで保証する
import { VERIFY_RESULT_SCHEMA_VERSION, type VerifyCheckResult, type VerifyDecision, type VerifyResult, type VerifyResultV2Aborted, type VerifyRunError, type VerifyScope } from '@loomake/core';
import { UsageError } from '../runtime/errors.js';
import { summarizeVerifyChecks } from './policy/quality-conditions.js';

export type VerifyResultParts = {
  change: string | null;
  scope: VerifyScope;
  checks: readonly VerifyCheckResult[];
  /** 対象が決まったあとの実行エラー。1 件以上あれば partial になる */
  errors?: readonly VerifyRunError[];
  coverage?: Record<string, string[]>;
  /** 人の判断。省略すると要判断なし */
  decision?: VerifyDecision;
};

/** 実行エラーがあるのに、どの検査も不合格や不足にならなかったときに足す check の ID */
export const RUN_ERRORS_CHECK = 'run:errors';

/**
 * 検査の結果から 2.0.0 の結果を組み立てる（REQ-311）。入力を変えない。
 * 実行エラーがあれば partial にし、partial では PASS を出さない（不合格か不足の check がなければ RUN_ERRORS_CHECK を不足として足す）。
 * ci は既存の集約で verdict を返す。0 件・全件 NOT_APPLICABLE は不足で、PASS にならない。local は verdict を返さない
 */
export function assembleVerifyResult(parts: VerifyResultParts): Exclude<VerifyResult, VerifyResultV2Aborted> {
  const errors = [...(parts.errors ?? [])];
  const checks = [...parts.checks];
  if (errors.length && !checks.some((c) => c.result === 'FAIL' || c.result === 'INSUFFICIENT_EVIDENCE')) {
    checks.push({ id: RUN_ERRORS_CHECK, result: 'INSUFFICIENT_EVIDENCE', reason: `実行エラーで証拠を取りきれませんでした：${errors.map((e) => e.message).join(' / ')}`, evidence: [] });
  }
  const run = errors.length ? { status: 'partial' as const, errors } : { status: 'completed' as const, errors: [] };
  const decision = parts.decision ?? { required: false, reasons: [] };
  const coverage = parts.coverage ? { coverage: parts.coverage } : {};
  const base = { schemaVersion: VERIFY_RESULT_SCHEMA_VERSION as typeof VERIFY_RESULT_SCHEMA_VERSION, change: parts.change, run, checks, decision };
  const summarized = summarizeVerifyChecks(checks, parts.scope);
  if (summarized.scope === 'ci') return { ...base, scope: 'ci' as const, summary: summarized.summary, verdict: summarized.verdict, ...coverage };
  return { ...base, scope: 'local' as const, summary: summarized.summary, ...coverage };
}

const CONFIG_ERROR = /^loomake\.config\.json/;

/**
 * 例外を 2.0.0 の aborted の結果にする（REQ-311・仮定 A-04）。使い方の誤りは usage、loomake.config.json の誤りは config（どちらも終了コード 2）、
 * それ以外は runtime（終了コード 3）。change は確定したときだけ渡し、確定しないときは null と、受け取った入力を target に残す
 */
export function verifyAbortedResult(error: unknown, change: string | null, target = change ?? 'verify'): VerifyResultV2Aborted {
  const message = error instanceof Error ? error.message : String(error);
  const kind: VerifyRunError['kind'] = error instanceof UsageError ? (CONFIG_ERROR.test(message) ? 'config' : 'usage') : 'runtime';
  const next = kind === 'usage'
    ? 'loomake verify --help で使い方を確かめてから、もう一度実行してください'
    : kind === 'config' ? 'loomake.config.json を直してから、もう一度実行してください' : '原因を確かめてから、もう一度実行してください';
  return { schemaVersion: VERIFY_RESULT_SCHEMA_VERSION, change, run: { status: 'aborted', errors: [{ kind, target, message: message || '実行エラーです', next }] } };
}
