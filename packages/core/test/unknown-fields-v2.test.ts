import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { loadTraceSchemas, loadVerifyResultSchemas } from '../src/index.js';
import { evidenceValue } from './fixtures/trace-contract-values.js';
import { abortedValue, ciValue, localValue } from './fixtures/verify-v2-values.js';

const verify = await loadVerifyResultSchemas();
const trace = await loadTraceSchemas();

// JSON の own property として __proto__・constructor・prototype を持つ値
const special = () => JSON.parse('{"__proto__":{"loomakeProbe":true},"constructor":{"prototype":{"loomakeProbe":true}},"prototype":{"value":1},"extra":{"__proto__":{"nested":true}}}') as Record<string, unknown>;
const marked = <T extends object>(value: T) => ({ ...value, ...special() });

function expectFields(output: unknown) {
  const object = output as Record<string, unknown>;
  expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
  for (const [key, value] of Object.entries(special())) {
    expect(Object.hasOwn(object, key), key).toBe(true);
    expect(Object.getOwnPropertyDescriptor(object, key)?.value, key).toEqual(value);
  }
}

const error = abortedValue().run.errors[0];
const decision = { required: true, reasons: [{ code: 'PROTECTED_PATH', target: 'src/auth', message: '保護パスへの変更' }] };

describe('verify 2.0.0 の未知キーと禁止キー', () => {
  it('[REQ-275][REQ-307][REQ-308] 2.0.0 の各階層の未知キー（__proto__ を含む）を、値とプロトタイプを変えずに保持する', () => {
    const cases: [string, z.ZodType, Record<string, unknown>][] = [
      ['ci', verify.verifyResultV2Schema, ciValue()],
      ['local', verify.verifyResultV2Schema, localValue()],
      ['aborted', verify.verifyResultV2Schema, abortedValue()],
      ['check', verify.verifyCheckV2Schema, ciValue().checks[0]],
      ['run error', verify.verifyRunErrorSchema, error],
      ['decision', verify.verifyDecisionSchema, decision],
      ['ci summary', verify.verifyCiSummarySchema, ciValue().summary],
      ['local summary', verify.verifyLocalSummarySchema, localValue().summary],
      ['legacy verify', verify.legacyVerifyResultSchema, evidenceValue().verify],
      ['legacy evidence', trace.legacyEvidenceSchema, evidenceValue()],
      ['evidence 2', trace.evidenceV2Schema, { ...evidenceValue(), schemaVersion: 2, verify: ciValue() }],
    ];
    for (const [name, schema, value] of cases) {
      const input = marked(value);
      const before = JSON.stringify(input);
      expectFields(schema.parse(input));
      expect(JSON.stringify(input), name).toBe(before);
    }
    expect(({} as Record<string, unknown>).loomakeProbe).toBeUndefined();
  });

  it('[REQ-275][REQ-307] 入れ子の checks・run・errors・decision.reasons・summary の未知キーも残る', () => {
    const input = {
      ...ciValue(),
      run: marked({ status: 'partial', errors: [marked(error)] }),
      checks: [marked(ciValue().checks[0])],
      summary: marked({ fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1 }),
      decision: marked({ required: true, reasons: [marked(decision.reasons[0])] }),
    };
    const parsed = verify.verifyResultV2Schema.parse(input) as typeof input;
    for (const value of [parsed.run, parsed.run.errors[0], parsed.checks[0], parsed.summary, parsed.decision, parsed.decision.reasons[0]]) expectFields(value);
  });

  it('[REQ-275][REQ-308] 未知キーは通し、既知の禁止キーだけを拒否する', () => {
    const ok = (value: unknown) => verify.verifyResultV2Schema.safeParse(value).success;
    expect(ok({ ...localValue(), verdictNote: 'x' })).toBe(true);
    expect(ok({ ...localValue(), verdict: 'PASS' })).toBe(false);
    expect(ok({ ...ciValue(), summary: { ...ciValue().summary, pending: 0 } })).toBe(false);
    expect(ok({ ...abortedValue(), note: { checks: [] } })).toBe(true);
    for (const key of ['scope', 'checks', 'summary', 'decision', 'verdict', 'coverage']) {
      expect(ok({ ...abortedValue(), [key]: null }), key).toBe(false);
    }
  });

  it('[REQ-307] 非同期の解析でも未知キーを保持する', async () => {
    expectFields(await verify.verifyResultV2Schema.parseAsync(marked(ciValue())));
  });
});
