import { describe, it, expect, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import {
  loadVerifyResultSchemas, LEGACY_VERIFY_RESULT_SCHEMA_VERSION, VERIFY_RESULT_SCHEMA_VERSION, VERIFY_RESULT_V2_SCHEMA_VERSION,
  type LegacyVerifyResult, type VerifyResultV2, type VerifyResultV2Ci, type VerifyResultV2Local, type VerifyResultV2Aborted, type VerifyRunError,
} from '../src/index.js';
import { abortedValue, ciValue, localValue } from './fixtures/verify-v2-values.js';

const schemas = await loadVerifyResultSchemas();
const { verifyResultV2Schema, legacyVerifyResultSchema, verifyResultSchema } = schemas;
const ok = (value: unknown) => verifyResultV2Schema.safeParse(value).success;

describe('verify 2.0.0 の Zod スキーマ', () => {
  it('[REQ-274][REQ-308] ci・local の completed と aborted を受け付け、版で 1.0.0 と区別する', () => {
    for (const value of [ciValue(), localValue(), abortedValue()]) {
      expect(verifyResultV2Schema.parse(value)).toEqual(value);
      expect(legacyVerifyResultSchema.safeParse(value).success).toBe(false);
    }
    expect(VERIFY_RESULT_V2_SCHEMA_VERSION).toBe('2.0.0');
    expect(ok({ ...ciValue(), schemaVersion: '1.0.0' })).toBe(false);
    expect(ok({ ...ciValue(), coverage: undefined })).toBe(true);
  });

  it('[REQ-274][REQ-311] 履歴の 1.0.0 を別名のスキーマで受け付け、いまの書き出しの版は 2.0.0', () => {
    const legacy = { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: true, results: [{ check: 'x', status: 'warn', detail: '' }], coverage: { 'REQ-001': [] } };
    expect(legacyVerifyResultSchema.parse(legacy)).toEqual(legacy);
    expect(verifyResultSchema.safeParse(legacy).success).toBe(false);
    for (const value of [ciValue(), localValue(), abortedValue()]) expect(verifyResultSchema.parse(value)).toEqual(value);
    expect([VERIFY_RESULT_SCHEMA_VERSION, LEGACY_VERIFY_RESULT_SCHEMA_VERSION]).toEqual(['2.0.0', '1.0.0']);
    const withoutOk: Record<string, unknown> = { ...legacy };
    delete withoutOk.ok;
    expect(legacyVerifyResultSchema.safeParse(withoutOk).success).toBe(false);
    expect(legacyVerifyResultSchema.safeParse({ ...legacy, results: [{ check: 'x', status: 'error', detail: '' }] }).success).toBe(false);
    expect(verifyResultV2Schema.safeParse(legacy).success).toBe(false);
  });

  it('[REQ-308] completed と aborted の必須項目を検査し、禁止キーを拒否する', () => {
    for (const key of ['schemaVersion', 'change', 'run', 'scope', 'checks', 'summary', 'decision', 'verdict']) {
      const value: Record<string, unknown> = ciValue();
      delete value[key];
      expect(ok(value), key).toBe(false);
    }
    for (const key of ['scope', 'checks', 'summary', 'decision']) {
      const value: Record<string, unknown> = localValue();
      delete value[key];
      expect(ok(value), key).toBe(false);
    }
    expect(ok({ ...localValue(), verdict: 'PASS' })).toBe(false);
    expect(ok({ ...localValue(), summary: { ...localValue().summary, pending: undefined } })).toBe(false);
    for (const [key, value] of Object.entries({ scope: 'ci', checks: [], summary: ciValue().summary, decision: ciValue().decision, verdict: 'FAIL', coverage: {} })) {
      expect(ok({ ...abortedValue(), [key]: value }), key).toBe(false);
    }
    expect(ok({ ...abortedValue(), run: { status: 'aborted', errors: [] } })).toBe(false);
    expect(ok({ ...ciValue(), run: { status: 'completed', errors: abortedValue().run.errors } })).toBe(false);
    expect(ok({ ...ciValue(), checks: [{ ...ciValue().checks[0], result: 'pass' }] })).toBe(false);
    expect(ok({ ...ciValue(), verdict: 'OK' })).toBe(false);
    expect(ok({ ...ciValue(), summary: { ...ciValue().summary, evaluated: -1 } })).toBe(false);
    expect(ok({ ...ciValue(), decision: { required: true, reasons: [{ code: 'OTHER', target: 'x', message: 'y' }] } })).toBe(false);
  });

  it('[REQ-308] ci・local の partial は 1 件以上の実行エラーを持ち、scope ごとの必須項目を受け付ける', () => {
    const errors = [{ kind: 'permission', target: 'ci.test_report', message: '成果物を取得できません', next: '閲覧権限を確認してください' }];
    expect(ok({ ...ciValue(), run: { status: 'partial', errors } })).toBe(true);
    expect(ok({ ...localValue(), run: { status: 'partial', errors } })).toBe(true);
    expect(ok({ ...ciValue(), run: { status: 'partial', errors: [] } })).toBe(false);
    expect(ok({ ...localValue(), run: { status: 'partial', errors }, verdict: 'PASS' })).toBe(false);
    expect(ok({ ...abortedValue(), run: { status: 'partial', errors } })).toBe(false);
  });

  it('[REQ-309] 実行エラーは種別・対象・日本語の message・next を持ち、change が確定しないときは null と元の入力を残す', () => {
    const aborted = verifyResultV2Schema.parse(abortedValue()) as VerifyResultV2Aborted;
    expect(aborted.change).toBeNull();
    expect(aborted.run.errors[0]).toEqual({ kind: 'usage', target: '../x', message: 'change-id の形が正しくありません', next: '--change に change 名を指定してください' });
    for (const kind of ['usage', 'config', 'permission', 'tool', 'network', 'runtime']) {
      expect(ok({ ...abortedValue(), run: { status: 'aborted', errors: [{ ...abortedValue().run.errors[0], kind }] } }), kind).toBe(true);
    }
    const base = abortedValue().run.errors[0];
    for (const error of [{ ...base, kind: 'quality' }, { ...base, message: '' }, { ...base, next: '' }, { kind: 'usage', target: 'x', message: 'm' }]) {
      expect(ok({ ...abortedValue(), run: { status: 'aborted', errors: [error] } }), JSON.stringify(error)).toBe(false);
    }
  });

  it('[REQ-274][REQ-308] 型はスキーマから導出する', () => {
    expectTypeOf<VerifyResultV2>().toEqualTypeOf<z.infer<typeof verifyResultV2Schema>>();
    expectTypeOf<VerifyResultV2>().toEqualTypeOf<VerifyResultV2Ci | VerifyResultV2Local | VerifyResultV2Aborted>();
    expectTypeOf<LegacyVerifyResult>().toEqualTypeOf<z.infer<typeof legacyVerifyResultSchema>>();
    expectTypeOf<VerifyRunError['kind']>().toEqualTypeOf<'usage' | 'config' | 'permission' | 'tool' | 'network' | 'runtime'>();
    expectTypeOf<VerifyResultV2Local['verdict']>().toEqualTypeOf<undefined>();
  });
});
