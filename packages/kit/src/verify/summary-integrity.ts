import { sha256Hex } from './hash.js';

export type SummaryTrustAnchor = {
  summarySha256: string;
  runId: string;
  runAttempt: string;
  sha: string;
};

export type FixedSummaryProblemCode =
  | 'TRUST_MISSING'
  | 'SUMMARY_UNREADABLE'
  | 'SUMMARY_HASH_MISMATCH'
  | 'RUN_ID_MISMATCH'
  | 'RUN_ATTEMPT_MISMATCH'
  | 'TARGET_SHA_MISMATCH';

export type FixedSummaryCheck = {
  reusable: boolean;
  result: 'PASS' | 'FAIL';
  returnToHuman: boolean;
  reasons: { code: FixedSummaryProblemCode; message: string }[];
};

const HASH = /^[a-f0-9]{64}$/;
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const FIXED_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ATTEMPT = /^[1-9]\d*$/;
const ISOLATED_SURROGATE = /\p{Cs}/u;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function trustAnchor(value: unknown): SummaryTrustAnchor | undefined {
  try {
    if (!object(value)) return undefined;
    const { summarySha256, runId, runAttempt, sha } = value;
    if (typeof summarySha256 !== 'string' || !HASH.test(summarySha256) || !nonempty(runId) ||
        typeof runAttempt !== 'string' || !ATTEMPT.test(runAttempt) || typeof sha !== 'string' || !FIXED_SHA.test(sha)) return undefined;
    return { summarySha256, runId, runAttempt, sha };
  } catch {
    return undefined;
  }
}

function result(reasons: FixedSummaryCheck['reasons']): FixedSummaryCheck {
  const reusable = reasons.length === 0;
  return { reusable, result: reusable ? 'PASS' : 'FAIL', returnToHuman: !reusable, reasons };
}

/**
 * 要約とは別に渡された固定ハッシュと CI の識別子で照合する。自己ハッシュは読まない。
 * 信頼値の取得元の確認は呼び出し側が行う。I/O・時計・環境を読まず、入力を変更しない。
 * 形式の誤りは例外にせず、再利用不可・FAIL・人への差し戻しと日本語の理由を返す。
 */
export function checkFixedSummary(summaryText: unknown, anchor: unknown): FixedSummaryCheck {
  const expected = trustAnchor(anchor);
  if (!expected) return result([{ code: 'TRUST_MISSING', message: '固定時の信頼値が不足しているか、形式が不正です。' }]);

  const reasons: FixedSummaryCheck['reasons'] = [];
  const unreadable = () => result([...reasons, { code: 'SUMMARY_UNREADABLE', message: '要約を必要な欄を持つ JSON の文字列として読めません。' }]);
  if (typeof summaryText !== 'string' || ISOLATED_SURROGATE.test(summaryText)) return unreadable();

  if (sha256Hex(summaryText) !== expected.summarySha256) {
    reasons.push({ code: 'SUMMARY_HASH_MISMATCH', message: '要約の SHA-256 が固定時のハッシュと一致しません。' });
  }
  let summary: unknown;
  try { summary = JSON.parse(summaryText); }
  catch { return unreadable(); }
  if (!object(summary) || typeof summary.sha !== 'string' || !SHA.test(summary.sha) || !object(summary.ci) ||
      !nonempty(summary.ci.runId) || typeof summary.ci.runAttempt !== 'string' || !ATTEMPT.test(summary.ci.runAttempt)) return unreadable();

  if (summary.ci.runId !== expected.runId) {
    reasons.push({ code: 'RUN_ID_MISMATCH', message: '要約の CI 実行 ID が固定時の実行 ID と一致しません。' });
  }
  if (summary.ci.runAttempt !== expected.runAttempt) {
    reasons.push({ code: 'RUN_ATTEMPT_MISMATCH', message: '要約の CI 試行番号が固定時の試行番号と一致しません。' });
  }
  if (summary.sha !== expected.sha) {
    reasons.push({ code: 'TARGET_SHA_MISMATCH', message: '要約の対象 SHA が固定時の対象 SHA と一致しません。' });
  }
  return result(reasons);
}
