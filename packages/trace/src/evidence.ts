import { createHash } from 'node:crypto';
import { EVIDENCE_V2_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, LEGACY_VERIFY_RESULT_SCHEMA_VERSION, VERIFY_RESULT_V2_SCHEMA_VERSION } from '@loomake/core';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const RESULTS = ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE'];
const KINDS = ['usage', 'config', 'permission', 'tool', 'network', 'runtime'];
const DECISIONS = ['CRITERIA_RELAXATION', 'PROTECTED_PATH', 'APPROVAL_REQUIRED', 'LIMIT_EXCEEDED'];

// 履歴の Evidence 1 に埋め込む verify 1.0.0（REQ-073）
function legacyVerifyProblem(verify: Record<string, unknown>, change: string): string | undefined {
  if (verify.schemaVersion !== LEGACY_VERIFY_RESULT_SCHEMA_VERSION) return '検証結果のschemaVersionに対応していません';
  if (verify.change !== change || verify.mode !== 'done') return '検証結果のchangeかモードが対象と一致しません';
  if (typeof verify.ok !== 'boolean' || !Array.isArray(verify.results)) return '検証結果の形が不正です';
  for (const r of verify.results) {
    if (!object(r) || typeof r.check !== 'string' || typeof r.detail !== 'string' || !['pass', 'fail', 'warn', 'skip'].includes(String(r.status))) {
      return '検証結果の各検査の形が不正です';
    }
  }
  return undefined;
}

// Evidence 2 に埋め込む verify 2.0.0。scope と実行状態ごとの必須欄と禁止欄を確かめる（REQ-073・REQ-308・REQ-315）
function verifyV2Problem(verify: Record<string, unknown>, change: string): string | undefined {
  if (verify.schemaVersion !== VERIFY_RESULT_V2_SCHEMA_VERSION) return '検証結果のschemaVersionに対応していません';
  if (verify.change !== change) return '検証結果のchangeが対象と一致しません';
  const run = verify.run;
  if (!object(run) || !['completed', 'partial', 'aborted'].includes(String(run.status)) || !Array.isArray(run.errors)) return '検証結果のrunの形が不正です';
  if (!run.errors.every((e) => object(e) && KINDS.includes(String(e.kind)) && typeof e.target === 'string' && typeof e.message === 'string' && e.message !== '' && typeof e.next === 'string' && e.next !== '')) {
    return '検証結果の実行エラーの形が不正です';
  }
  if ((run.status === 'completed') !== (run.errors.length === 0)) return '検証結果の実行状態と実行エラーの数が合いません';
  if (run.status === 'aborted') {
    const extra = ['scope', 'checks', 'summary', 'decision', 'verdict', 'coverage'].find((key) => key in verify);
    return extra ? `中止した検証結果に${extra}があります` : undefined;
  }
  if (verify.scope !== 'ci' && verify.scope !== 'local') return '検証結果のscopeが不正です';
  if (!Array.isArray(verify.checks) || !verify.checks.every((c) => object(c) && typeof c.id === 'string' && c.id !== '' && RESULTS.includes(String(c.result)) && typeof c.reason === 'string' && strings(c.evidence))) {
    return '検証結果の各検査の形が不正です';
  }
  const summary = verify.summary;
  if (!object(summary) || !['fail', 'insufficient', 'not_applicable', 'evaluated'].every((key) => count(summary[key]))) return '検証結果のsummaryの形が不正です';
  if (verify.scope === 'local' ? !count(summary.pending) || 'verdict' in verify : 'pending' in summary || !RESULTS.includes(String(verify.verdict))) {
    return '検証結果のscopeとsummary・verdictが合いません';
  }
  const decision = verify.decision;
  if (!object(decision) || typeof decision.required !== 'boolean' || !Array.isArray(decision.reasons)
    || !decision.reasons.every((r) => object(r) && DECISIONS.includes(String(r.code)) && typeof r.target === 'string' && typeof r.message === 'string')) {
    return '検証結果のdecisionの形が不正です';
  }
  return undefined;
}

/**
 * 証拠の整合性を検証する。I/Oを行わず、不正な箇所を日本語で返す。
 * Evidence 1（verify 1.0.0）と Evidence 2（verify 2.0.0）を版ごとに確かめ、版と埋め込みの verify の版の混在を拒否する（REQ-073・REQ-315）
 */
export function evidenceProblem(value: unknown, change: string): string | undefined {
  if (!object(value)) return '証拠はオブジェクトである必要があります';
  if (value.schemaVersion !== LEGACY_EVIDENCE_SCHEMA_VERSION && value.schemaVersion !== EVIDENCE_V2_SCHEMA_VERSION) return '証拠のschemaVersionに対応していません';
  if (value.change !== change) return '証拠のchangeが対象と一致しません';
  if (typeof value.sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.sha)) return 'コミットのSHAが不正です';
  if (!date(value.recordedAt) || !date(value.committedAt)) return '記録かコミットの日時が不正です';
  const verify = value.verify;
  if (!object(verify)) return '検証結果がありません';
  const problem = value.schemaVersion === EVIDENCE_V2_SCHEMA_VERSION ? verifyV2Problem(verify, change) : legacyVerifyProblem(verify, change);
  if (problem) return problem;
  if (verify.coverage !== undefined && (!object(verify.coverage) || !Object.values(verify.coverage).every(strings))) return 'coverageの形が不正です';
  if (value.documents === undefined) return undefined;
  if (!Array.isArray(value.documents)) return 'documentsは配列である必要があります';
  const paths = new Set<string>();
  for (const d of value.documents) {
    if (!object(d) || typeof d.path !== 'string' || !d.path || typeof d.content !== 'string' || typeof d.sha256 !== 'string') {
      return '保存した文書の形が不正です';
    }
    if (paths.has(d.path)) return `保存した文書のパスが重複しています：${d.path}`;
    paths.add(d.path);
    if (createHash('sha256').update(d.content).digest('hex') !== d.sha256) return `保存した文書のハッシュが一致しません：${d.path}`;
  }
  if (!paths.has('trace.md')) return '保存した文書にtrace.mdがありません';
  return undefined;
}
