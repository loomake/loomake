import { z } from 'zod';
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const minutes = count.max(100000);
export const effortMinutesSchema = z.strictObject({
  instruct: minutes.optional(), review: minutes.optional(), rework: minutes.optional(),
  run: minutes.optional(), wait: minutes.optional(), search: minutes.optional(),
}).refine((value) => ['instruct', 'review', 'rework', 'run', 'wait'].some((key) => value[key as keyof typeof value] !== undefined))
  .refine((value) => (value.search ?? 0) <= (value.instruct ?? 0) + (value.review ?? 0) + (value.rework ?? 0) + (value.run ?? 0) + (value.wait ?? 0));
export const effortCostSchema = z.union([
  z.strictObject({ kind: z.enum(['actual-usd', 'estimated-usd']), cents: count }),
  z.strictObject({ kind: z.literal('tokens'), count }),
]);
const common = {
  schemaVersion: z.literal(1), kind: z.literal('loomake-effort'),
  change: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine((value) => value !== 'archive'),
  sha: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i), recordedAt: z.iso.datetime({ offset: true }),
  decisions: count.optional(), attempts: count.optional(),
  cost: z.array(effortCostSchema).max(3).refine((value) => new Set(value.map((item) => item.kind)).size === value.length).optional(),
  note: z.string().refine((value) => [...value].length <= 500 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)).optional(),
};
/** Effort 1 のみの構造。品質検証の証拠は含めない。 */
export const effortRecordSchema = z.union([
  z.strictObject({ ...common, totalMinutes: minutes }),
  z.strictObject({ ...common, minutes: effortMinutesSchema }),
]);
