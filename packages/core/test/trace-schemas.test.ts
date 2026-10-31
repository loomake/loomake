import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION, loadTraceSchemas, type Evidence, type EvidenceDocument, type Report, type ReportRow } from '../src/index.js';
// いまの書き出しは Evidence 2。履歴の Evidence 1 は evidence-v2-schema.test.ts で確かめる
import { evidenceV2Value as evidenceValue, reportValue } from './fixtures/trace-contract-values.js';

const { evidenceSchema, evidenceDocumentSchema, reportSchema, reportRowSchema } = await loadTraceSchemas();

describe('証拠とリリースレポートの構造', () => {
  it('[REQ-302] 既存の任意フィールド・版の型・日本語結果を保持する', () => {
    expect([EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION]).toEqual([2, 2]);
    const old = evidenceValue();
    expect(evidenceSchema.parse(old)).toEqual(old);
    expect(evidenceSchema.parse(old)).not.toHaveProperty('documents');
    const saved = { ...old, documents: [{ path: '', sha256: '', content: '' }] };
    expect(evidenceSchema.parse(saved)).toEqual(saved);
    for (const schemaVersion of [-1, 0, 1.5, 99]) {
      expect(evidenceSchema.parse({ ...old, schemaVersion }).schemaVersion).toBe(schemaVersion);
      expect(reportSchema.parse({ ...reportValue(), schemaVersion }).schemaVersion).toBe(schemaVersion);
    }
    for (const result of ['合格', '合格（仕様との対応は未確認）', '合格したテストなし', null]) {
      const value = reportValue();
      const row = { ...value.rows[0], result };
      expect(reportSchema.parse({ ...value, rows: [row] }).rows[0].result).toBe(result);
    }
    expect(evidenceSchema.safeParse({ ...old, sha: '', recordedAt: 'not a date', committedAt: '' }).success).toBe(true);
  });

  it('[REQ-302] 必須の型・配列・nullable の区別を検証する', () => {
    const old = evidenceValue();
    expect(evidenceSchema.safeParse({ ...old, sha: 1 }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...old, documents: null }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...old, verify: { ...old.verify, verdict: 'true' } }).success).toBe(false);
    const report = reportValue();
    expect(reportSchema.safeParse({ ...report, warnings: null }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, evidence: { ...report.evidence, documents: undefined } }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, rows: [{ ...report.rows[0], result: 'pass' }] }).success).toBe(false);
    expect(reportRowSchema.safeParse({ ...report.rows[0], result: undefined }).success).toBe(false);
    expect(evidenceDocumentSchema.safeParse({ path: '', content: '' }).success).toBe(false);
  });

  it('[REQ-302] 全 object 階層の未知フィールドを残す', () => {
    const old = evidenceValue();
    const value = { ...old, extra: [1], verify: { ...old.verify, extra: { note: 'x' }, checks: [{ ...old.verify.checks[0], extra: null }] }, documents: [{ path: '', sha256: '', content: '', extra: { nested: true } }] };
    expect(evidenceSchema.parse(value)).toEqual(value);
    const report = reportValue();
    const reportExtra = { ...report, extra: true, evidence: { ...report.evidence, extra: [1] }, attention: { ...report.attention, extra: 'x' }, rows: [{ ...report.rows[0], extra: null }], questions: [{ ...report.questions[0], extra: {} }], assumptions: [{ ...report.assumptions[0], extra: [false] }] };
    expect(reportSchema.parse(reportExtra)).toEqual(reportExtra);
  });

  it('[REQ-302] 4 型をスキーマから導出し、版は number・documents は任意のままにする', () => {
    expectTypeOf<Evidence>().toEqualTypeOf<z.output<typeof evidenceSchema>>();
    expectTypeOf<EvidenceDocument>().toEqualTypeOf<z.output<typeof evidenceDocumentSchema>>();
    expectTypeOf<Report>().toEqualTypeOf<z.output<typeof reportSchema>>();
    expectTypeOf<ReportRow>().toEqualTypeOf<z.output<typeof reportRowSchema>>();
    expectTypeOf<Evidence['schemaVersion']>().toEqualTypeOf<number>();
    expectTypeOf<Report['schemaVersion']>().toEqualTypeOf<number>();
    expectTypeOf<Evidence['documents']>().toEqualTypeOf<EvidenceDocument[] | undefined>();
    expectTypeOf<ReportRow['result']>().toEqualTypeOf<'合格' | '合格（仕様との対応は未確認）' | '合格したテストなし' | null>();
  });
});
