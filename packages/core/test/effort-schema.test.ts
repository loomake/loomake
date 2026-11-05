import { expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { EFFORT_SCHEMA_VERSION, loadEffortSchema, type EffortRecord, type EffortMinutes, type EffortCost } from '../src/index.js';
const { effortRecordSchema, effortMinutesSchema, effortCostSchema } = await loadEffortSchema();
const base = { schemaVersion: 1, kind: 'loomake-effort', change: 'add-x', sha: 'a'.repeat(40), recordedAt: '2026-11-06T00:00:00.000Z' };
it('[REQ-466] Effort 1 の排他形式と省略/0を保つ導出型', () => {
  expect(EFFORT_SCHEMA_VERSION).toBe(1);
  expect(effortMinutesSchema.parse({ review: 0 })).toEqual({ review: 0 });
  expect(effortCostSchema.parse({ kind: 'tokens', count: 0 })).toEqual({ kind: 'tokens', count: 0 });
  expectTypeOf<EffortRecord>().toEqualTypeOf<z.output<typeof effortRecordSchema>>();
  expectTypeOf<EffortMinutes>().toEqualTypeOf<z.output<typeof effortMinutesSchema>>();
  expectTypeOf<EffortCost>().toEqualTypeOf<z.output<typeof effortCostSchema>>();
  for (const amount of [{ totalMinutes: 0 }, { minutes: { review: 0 } }, { minutes: { instruct: 1, search: 1 } }]) {
    const value = { ...base, ...amount };
    expect(effortRecordSchema.parse(value)).toEqual(value);
  }
});
it('[REQ-466] 不正な構造・範囲・余剰キー・総計と内訳の混在を拒否する', () => {
  const invalid = [ {}, { totalMinutes: 1, minutes: { review: 1 } }, { totalMinutes: -1 }, { totalMinutes: 100001 }, { totalMinutes: 1.5 }, { totalMinutes: NaN }, { minutes: {} }, { minutes: { search: 1 } }, { minutes: { review: 0, search: 1 } }, { minutes: { other: 1 } } ];
  for (const amount of invalid) expect(effortRecordSchema.safeParse({ ...base, ...amount }).success).toBe(false);
  for (const extra of [{ schemaVersion: 2 }, { kind: 'quality' }, { change: 'archive' }, { change: 'add-x\n' }, { sha: 'a'.repeat(40) + '\n' }, { sha: 'x' }, { recordedAt: 'bad' }, { decisions: Number.MAX_SAFE_INTEGER + 1 }, { attempts: -1 }, { note: 'a\nb' }, { note: '😀'.repeat(501) }, { cost: [{ kind: 'tokens', count: 0.5 }] }, { cost: [{ kind: 'tokens', count: 1 }, { kind: 'tokens', count: 2 }] }, { verify: {} }]) {
    expect(effortRecordSchema.safeParse({ ...base, totalMinutes: 1, ...extra }).success).toBe(false);
  }
  expect(effortRecordSchema.safeParse({ ...base, sha: 'b'.repeat(64), totalMinutes: 100000, note: '😀'.repeat(500) }).success).toBe(true);
});
