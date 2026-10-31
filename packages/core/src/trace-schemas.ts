// 証拠・リリースレポートの構造。証拠の整合性の検査は trace の同期関数が行う（REQ-302・REQ-303）。
import { z } from 'zod';
import { legacyVerifyResultSchema, verifyResultSchema, verifyResultV2Schema } from './verify-result-schema.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

export const evidenceDocumentSchema = preserveUnknownFields(z.looseObject({ path: z.string(), sha256: z.string(), content: z.string() }));

// 構造は共有し、埋め込み先には単独公開スキーマの識別子を重ねない。
const embedded = <S extends z.ZodType>(schema: S) => preserveUnknownFields(schema.meta({ ...schema.meta(), $id: undefined }));

const evidenceShape = <V extends z.ZodType, S extends z.ZodType>(schemaVersion: S, verify: V) => z.looseObject({
  schemaVersion,
  change: z.string(),
  sha: z.string(),
  committedAt: z.string(),
  recordedAt: z.string(),
  verify,
  documents: z.array(evidenceDocumentSchema).optional(),
});

/** いまの書き出しの版（EVIDENCE_SCHEMA_VERSION）の証拠 */
export const evidenceSchema = preserveUnknownFields(evidenceShape(z.number(), embedded(verifyResultSchema))
  .meta({ $id: 'https://loomake.dev/schema/evidence.schema.json', title: 'Loomake evidence' }));

/** 履歴の Evidence 1（verify 1.0.0 を埋め込む）。閲覧だけに使う（REQ-302） */
export const legacyEvidenceSchema = preserveUnknownFields(evidenceShape(z.number(), embedded(legacyVerifyResultSchema))
  .meta({ $id: 'https://loomake.dev/schema/versions/evidence-1.schema.json', title: 'Loomake evidence 1' }));

/** Evidence 2（verify 2.0.0 を埋め込む）（REQ-302） */
export const evidenceV2Schema = preserveUnknownFields(evidenceShape(z.literal(2), embedded(verifyResultV2Schema))
  .meta({ $id: 'https://loomake.dev/schema/versions/evidence-2.schema.json', title: 'Loomake evidence 2' }));

export const reportRowSchema = preserveUnknownFields(z.looseObject({
  id: z.string(),
  source: z.string(),
  state: z.string(),
  summary: z.string(),
  requirements: z.array(z.string()),
  tests: z.array(z.string()),
  result: z.enum(['合格', '合格（仕様との対応は未確認）', '合格したテストなし']).nullable(),
}));

export const reportSchema = preserveUnknownFields(z.looseObject({
  schemaVersion: z.number(),
  change: z.string(),
  evidence: preserveUnknownFields(z.looseObject({ recordedAt: z.string(), sha: z.string(), committedAt: z.string(), ok: z.boolean(), documents: z.boolean() })),
  attention: preserveUnknownFields(z.looseObject({
    noPassingTests: z.array(z.string()), pending: z.array(z.string()),
    changedDocuments: z.array(z.string()), failedChecks: z.array(z.string()),
  })),
  rows: z.array(reportRowSchema),
  questions: z.array(preserveUnknownFields(z.looseObject({
    id: z.string(), question: z.string(), answer: z.string(), answeredBy: z.string(), answeredAt: z.string(),
  }))),
  assumptions: z.array(preserveUnknownFields(z.looseObject({
    id: z.string(), content: z.string(), approval: z.string(), approvedBy: z.string(), approvedAt: z.string(),
  }))),
  warnings: z.array(z.string()),
}).meta({ $id: 'https://loomake.dev/schema/report.schema.json', title: 'Loomake release report' }));
