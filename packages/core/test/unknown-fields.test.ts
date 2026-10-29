import { describe, expect, it } from 'vitest';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadParserSchemas, loadQualityReportSchema, loadQualitySchema, loadVerifyResultSchemas } from '../src/index.js';
import { ASSUMPTION_COLUMNS, LEDGER_COLUMNS, QUESTION_COLUMNS } from '../src/trace.js';
import { preserveUnknownFields } from '../src/preserve-unknown-fields.js';

const parser = await loadParserSchemas();
const quality = await loadQualitySchema();
const verify = await loadVerifyResultSchemas();
const report = await loadQualityReportSchema();

function specialFields() {
  return JSON.parse('{"__proto__":{"loomakeProbe":true},"constructor":{"prototype":{"loomakeProbe":true}},"prototype":{"value":1},"extra":{"__proto__":{"nested":true},"values":[null,false,1]}}') as Record<string, unknown>;
}

function marked(value: Record<string, unknown> = {}) {
  return { ...value, ...specialFields() };
}

function row(columns: readonly string[]) {
  return { ...Object.fromEntries(columns.map((column) => [column, 'value'])), line: 1 };
}

function freeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const entry of Object.values(value)) freeze(entry);
}

function expectFields(output: unknown, input: Record<string, unknown>) {
  expect(typeof output).toBe('object');
  const object = output as Record<string, unknown>;
  expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
  for (const key of ['__proto__', 'constructor', 'prototype', 'extra']) {
    expect(Object.hasOwn(object, key), key).toBe(true);
    expect(Object.getOwnPropertyDescriptor(object, key)?.value, key).toEqual(input[key]);
    expect(Object.getOwnPropertyDescriptor(object, key)?.enumerable, key).toBe(true);
  }
}

const verifyValue = { schemaVersion: '1.0.0', mode: 'done', change: null, ok: true, results: [] };
const cases: { name: string; schema: z.ZodType; value: Record<string, unknown> }[] = [
  { name: 'quality-report', schema: report.qualityReportSchema, value: { version: 1 } },
  { name: 'verify', schema: verify.verifyResultSchema, value: verifyValue },
  { name: 'verify check', schema: verify.verifyCheckResultSchema, value: { check: 'x', status: 'pass', detail: '' } },
  { name: 'trace', schema: parser.traceSchema, value: { ledger: [], questions: [], assumptions: [] } },
  { name: 'ledger row', schema: parser.ledgerRowSchema, value: row(LEDGER_COLUMNS) },
  { name: 'question row', schema: parser.questionRowSchema, value: row(QUESTION_COLUMNS) },
  { name: 'assumption row', schema: parser.assumptionRowSchema, value: row(ASSUMPTION_COLUMNS) },
  { name: 'spec row', schema: parser.specRequirementSchema, value: { op: null, name: 'x', sources: [], scenarios: 0, line: 1 } },
  { name: 'task row', schema: parser.taskSchema, value: { checked: false, text: 'x', line: 1 } },
  { name: 'quality.yaml', schema: quality.qualitySchema, value: { version: 2, model: 'x' } },
  { name: 'measure', schema: quality.qualityMeasureSchema, value: { metric: 'x', source: 'x' } },
  { name: 'objective', schema: quality.qualityObjectiveSchema, value: { characteristic: 'x' } },
  { name: 'product', schema: quality.qualityProductSchema, value: { characteristic: 'x' } },
  { name: 'policy', schema: quality.qualityEvidencePolicySchema, value: {} },
];

describe('未知キーの own property を安全に保持する', () => {
  it.each(cases)('[REQ-305] $name の parse と safeParse は特殊キーと未知値を保持する', ({ schema, value }) => {
    const input = marked(value);
    const original = structuredClone(input);
    freeze(input);
    const expected = { ...schema.parse(value) as Record<string, unknown>, ...specialFields() };
    const parsed = schema.parse(input);
    assert.deepStrictEqual(parsed, expected);
    expectFields(parsed, input);
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expectFields(result.data, input);
    assert.deepStrictEqual(input, original);
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, 'loomakeProbe')).toBe(false);
  });

  it.each([{}, [], null, 'text', 1, false, undefined].map((value) => ({ value })))('[REQ-305] __proto__ の値 $value をプロトタイプの変更として扱わない', ({ value }) => {
    const input = { version: 1, ['__proto__']: value };
    freeze(input);
    const output = report.qualityReportSchema.parse(input);
    expect(Object.hasOwn(output, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(output, '__proto__')?.value).toBe(value);
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, 'loomakeProbe')).toBe(false);
  });

  it('[REQ-305] verify と Markdown の検証する配列要素にも同じ保持規則を適用する', () => {
    const check = marked({ check: 'x', status: 'pass', detail: '' });
    expectFields(verify.verifyResultSchema.parse({ ...verifyValue, results: [check] }).results[0], check);
    const ledger = marked(row(LEDGER_COLUMNS));
    const question = marked(row(QUESTION_COLUMNS));
    const assumption = marked(row(ASSUMPTION_COLUMNS));
    const trace = parser.traceSchema.parse({ ledger: [ledger], questions: [question], assumptions: [assumption] });
    for (const [output, input] of [[trace.ledger[0], ledger], [trace.questions[0], question], [trace.assumptions[0], assumption]] as const) {
      expectFields(output, input);
    }
    const spec = marked({ op: null, name: 'x', sources: [], scenarios: 0, line: 1 });
    expectFields(parser.specSchema.parse([spec])[0], spec);
    const task = marked({ checked: false, text: 'x', line: 1 });
    expectFields(parser.tasksSchema.parse([task])[0], task);
  });

  it('[REQ-305] quality.yaml の検証する入れ子と既定値を保持し、未知値を変更しない', () => {
    const measure = marked({ metric: 'x', source: 'x' });
    const objective = marked({ characteristic: 'x', evidence: [measure], indicators: [measure] });
    const product = marked({ characteristic: 'x', applicability: 'not_applicable', reason: 'x', confirmed_by: 'x' });
    const input = marked({
      version: 2, model: 'x', defaults: marked(), report: marked(), automation: marked(), evidence: marked(),
      objectives: { 'UQ-001': objective }, product: { 'PQ-001': product },
    });
    const original = structuredClone(input);
    freeze(input);
    const output = quality.qualitySchema.parse(input);
    for (const [parsed, value] of [
      [output, input], [output.defaults, input.defaults], [output.report, input.report],
      [output.automation, input.automation], [output.evidence, input.evidence],
      [output.objectives['UQ-001'], objective], [output.product['PQ-001'], product],
      [output.objectives['UQ-001'].evidence[0], measure], [output.objectives['UQ-001'].indicators[0], measure],
    ] as const) expectFields(parsed, value as Record<string, unknown>);
    expect(output.product['PQ-001'].evidence).toEqual([]);
    expect(output.evidence.artifact_retention).toBe('90d');
    expect(output.extra).toBe(input.extra);
    assert.deepStrictEqual(input, original);
  });

  it('[REQ-305] 元の検証の診断と既知フィールドの拒否を維持する', () => {
    const structural = z.looseObject({ items: z.array(z.looseObject({ required: z.string() })), version: z.literal(1) });
    const schema = preserveUnknownFields(structural);
    for (const input of [{}, { version: '1', items: [] }, { version: 1, items: [{}] }, marked({ version: 2, items: [] })]) {
      expect(schema.safeParse(input).error?.issues).toEqual(structural.safeParse(input).error?.issues);
      expect(schema.safeParse(input, { reportInput: true }).error?.issues).toEqual(structural.safeParse(input, { reportInput: true }).error?.issues);
      expect(schema.safeParse(input).success).toBe(false);
    }
    expect(quality.qualitySchema.safeParse(marked({ version: 2, model: 'x', evidence: { access: 'invalid' } })).success).toBe(false);
    expect(report.qualityReportSchema.safeParse(marked({ version: '1' })).success).toBe(false);
    expect(verify.verifyResultSchema.safeParse(marked({ ...verifyValue, results: [{ check: 'x', detail: '' }] })).success).toBe(false);
  });

  it('[REQ-305] 非同期の解析を並行しても別の入力の値を混ぜない', async () => {
    await Promise.all(cases.map(async ({ schema, value }) => {
      const input = { ...marked(value), ['__proto__']: { schema: schema.description ?? Object.keys(value).join(',') } };
      freeze(input);
      expectFields(await schema.parseAsync(input), input);
      const result = await schema.safeParseAsync(input);
      expect(result.success).toBe(true);
      if (result.success) expectFields(result.data, input);
    }));
  });
});
