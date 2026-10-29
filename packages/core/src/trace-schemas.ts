// 証拠・リリースレポートの構造。証拠の整合性の検査は trace の同期関数が行う（REQ-302・REQ-303）。
import { z } from 'zod';
import { verifyResultSchema } from './verify-result-schema.js';

export const evidenceDocumentSchema = z.looseObject({ path: z.string(), sha256: z.string(), content: z.string() });

export const evidenceSchema = z.looseObject({
  schemaVersion: z.number(),
  change: z.string(),
  sha: z.string(),
  committedAt: z.string(),
  recordedAt: z.string(),
  verify: verifyResultSchema,
  documents: z.array(evidenceDocumentSchema).optional(),
}).meta({ $id: 'https://loomake.dev/schema/evidence.schema.json', title: 'Loomake evidence' });

export const reportRowSchema = z.looseObject({
  id: z.string(),
  source: z.string(),
  state: z.string(),
  summary: z.string(),
  requirements: z.array(z.string()),
  tests: z.array(z.string()),
  result: z.enum(['合格', '合格（仕様との対応は未確認）', '合格したテストなし']).nullable(),
});

export const reportSchema = z.looseObject({
  schemaVersion: z.number(),
  change: z.string(),
  evidence: z.looseObject({ recordedAt: z.string(), sha: z.string(), committedAt: z.string(), ok: z.boolean(), documents: z.boolean() }),
  attention: z.looseObject({
    noPassingTests: z.array(z.string()), pending: z.array(z.string()),
    changedDocuments: z.array(z.string()), failedChecks: z.array(z.string()),
  }),
  rows: z.array(reportRowSchema),
  questions: z.array(z.looseObject({ id: z.string(), question: z.string(), answer: z.string(), answeredBy: z.string(), answeredAt: z.string() })),
  assumptions: z.array(z.looseObject({ id: z.string(), content: z.string(), approval: z.string(), approvedBy: z.string(), approvedAt: z.string() })),
  warnings: z.array(z.string()),
}).meta({ $id: 'https://loomake.dev/schema/report.schema.json', title: 'Loomake release report' });
