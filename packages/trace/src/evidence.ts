import { createHash } from 'node:crypto';
import { VERIFY_RESULT_SCHEMA_VERSION } from '@loomake/core';
import { EVIDENCE_SCHEMA_VERSION } from './record.js';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** 証拠の整合性を検証する。I/Oを行わず、不正な箇所を日本語で返す。 */
export function evidenceProblem(value: unknown, change: string): string | undefined {
  if (!object(value)) return '証拠はオブジェクトである必要があります';
  if (value.schemaVersion !== EVIDENCE_SCHEMA_VERSION) return '証拠のschemaVersionに対応していません';
  if (value.change !== change) return '証拠のchangeが対象と一致しません';
  if (typeof value.sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.sha)) return 'コミットのSHAが不正です';
  if (!date(value.recordedAt) || !date(value.committedAt)) return '記録かコミットの日時が不正です';
  const verify = value.verify;
  if (!object(verify)) return '検証結果がありません';
  if (verify.schemaVersion !== VERIFY_RESULT_SCHEMA_VERSION) return '検証結果のschemaVersionに対応していません';
  if (verify.change !== change || verify.mode !== 'done') return '検証結果のchangeかモードが対象と一致しません';
  if (typeof verify.ok !== 'boolean' || !Array.isArray(verify.results)) return '検証結果の形が不正です';
  for (const r of verify.results) {
    if (!object(r) || typeof r.check !== 'string' || typeof r.detail !== 'string' || !['pass', 'fail', 'warn', 'skip'].includes(String(r.status))) {
      return '検証結果の各検査の形が不正です';
    }
  }
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
