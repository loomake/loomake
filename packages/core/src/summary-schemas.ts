import { z } from 'zod';
import { evidenceV2Schema } from './trace-schemas.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

const object = <S extends z.ZodRawShape>(shape: S) => preserveUnknownFields(z.looseObject(shape));
const count = z.number().int().nonnegative();
export const summaryGapSchema = object({ field: z.string(), kind: z.enum(['unverified', 'not_applicable']), reason: z.string() });
export const summaryArtifactSchema = object({
  kind: z.literal('test-report'), path: z.string(), sha256: z.string(), bytes: count,
  sameRun: object({ status: z.enum(['verified', 'unverified']), reason: z.string().optional() }),
  counts: object({ passed: count, failed: count, skipped: count, todo: count, pending: count, other: count }).nullable(),
  location: object({ type: z.literal('github-actions-artifact'), repository: z.string(), runId: z.string(), runAttempt: count,
    artifactName: z.string(), entry: z.string(), createdAt: z.string() }).nullable(),
  availability: z.enum(['not-uploaded', 'uploaded', 'retrieved']), expiresAt: z.string().nullable(),
  retrieval: object({ checkedAt: z.string(), access: z.enum(['project-members', 'owner']), sha256Matched: z.literal(true) }).nullable(),
});
export const evidenceSummarySchema = object({
  ...evidenceV2Schema.shape,
  summaryVersion: z.literal(1), role: z.enum(['development', 'release']),
  ci: object({ runId: z.string(), runAttempt: count, source: z.literal('environment') }).nullable(),
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
}).meta({ $id: 'https://loomake.dev/schema/summary/evidence-summary-1.schema.json', title: 'Loomake evidence summary extension 1' });
