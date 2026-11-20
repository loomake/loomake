import { z } from 'zod';
import { evidenceV2Schema } from './trace-schemas.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

const object = <S extends z.ZodRawShape>(shape: S) => preserveUnknownFields(z.looseObject(shape));
const count = z.number().int().nonnegative();
// 1〜Number.MAX_SAFE_INTEGERの正規十進文字列。JSON Schemaでも同じ上限を検査する。
const attempt = z.string().regex(/^(?:[1-9][0-9]{0,14}|[1-8][0-9]{15}|900[0-6][0-9]{12}|90070[0-9]{11}|90071[0-8][0-9]{10}|900719[0-8][0-9]{9}|9007199[0-1][0-9]{8}|90071992[0-4][0-9]{7}|900719925[0-3][0-9]{6}|9007199254[0-6][0-9]{5}|90071992547[0-3][0-9]{4}|9007199254740[0-8][0-9]{2}|90071992547409[0-8][0-9]{1}|9007199254740990|9007199254740991)$/);
export const summaryGapSchema = object({ field: z.string(), kind: z.enum(['unverified', 'not_applicable']), reason: z.string() });
export const summaryArtifactSchema = object({
  kind: z.literal('test-report'), path: z.string(), sha256: z.string(), bytes: count,
  sameRun: object({ status: z.enum(['verified', 'unverified']), reason: z.string().optional() }),
  counts: object({ passed: count, failed: count, skipped: count, todo: count, pending: count, other: count }).nullable(),
  location: object({ type: z.literal('github-actions-artifact'), repository: z.string(), runId: z.string(), runAttempt: attempt,
    artifactName: z.string(), entry: z.string(), createdAt: z.string() }).nullable(),
  availability: z.enum(['not-uploaded', 'uploaded', 'retrieved']), expiresAt: z.string().nullable(),
  retrieval: object({ checkedAt: z.string(), access: z.enum(['project-members', 'owner']), sha256Matched: z.literal(true) }).nullable(),
});
export const evidenceSummarySchema = preserveUnknownFields(z.looseObject({
  ...evidenceV2Schema.shape,
  summaryVersion: z.literal(1), role: z.enum(['development', 'release']),
  ci: object({ runId: z.string(), runAttempt: attempt, source: z.literal('environment') }).nullable(),
  execution: object({
    id: z.string(), origin: z.enum(['local', 'github-actions']),
    evaluator: object({ name: z.literal('@loomake/trace'), version: z.string() }), basisSha256: z.string(),
    environment: object({ node: z.string(), platform: z.string(), arch: z.string() }),
    commands: object({ source: z.enum(['loomake.config.json', 'defaults']), sha256: z.string().nullable(),
      nameRefs: z.array(object({ nameSha256: z.string(), knownName: z.enum(['lint', 'typecheck', 'test']).optional() })).nullable() }),
    producer: object({ name: z.string(), version: z.string() }).nullable(),
    startedAt: z.string(), finishedAt: z.string(), verification: z.literal('executed'),
  }),
  artifacts: z.array(summaryArtifactSchema), request: z.null(), observation: z.null(), gaps: z.array(summaryGapSchema),
}).meta({ $id: 'https://loomake.dev/schema/summary/evidence-summary-1.schema.json', title: 'Loomake evidence summary extension 1' }));
