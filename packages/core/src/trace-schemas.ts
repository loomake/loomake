// 証拠・リリースレポートの構造。証拠の整合性の検査は trace の同期関数が行う（REQ-302・REQ-303）。
import { z } from 'zod';
import { verifyResultSchema } from './verify-result-schema.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

export const evidenceDocumentSchema = preserveUnknownFields(z.looseObject({ path: z.string(), sha256: z.string(), content: z.string() }));

export const evidenceSchema = preserveUnknownFields(z.looseObject({
  schemaVersion: z.number(),
  change: z.string(),
  sha: z.string(),
  committedAt: z.string(),
  recordedAt: z.string(),
  // 構造は共有し、埋め込み先には単独公開スキーマの識別子を重ねない。
  verify: preserveUnknownFields(verifyResultSchema.meta({ ...verifyResultSchema.meta(), $id: undefined })),
  documents: z.array(evidenceDocumentSchema).optional(),
}).meta({ $id: 'https://loomake.dev/schema/evidence.schema.json', title: 'Loomake evidence' }));

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
