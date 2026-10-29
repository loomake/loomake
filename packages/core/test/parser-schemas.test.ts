import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { createTraceTemplate, loadParserSchemas, TRACE_SCHEMA_VERSION, SPEC_SCHEMA_VERSION, TASKS_SCHEMA_VERSION, parseSpec, parseTasks, parseTrace, type AssumptionRow, type LedgerRow, type QuestionRow, type SpecOperation, type SpecRequirement, type Task, type Trace } from '../src/index.js';
const { assumptionRowSchema, ledgerRowSchema, questionRowSchema, specOperationSchema, specRequirementSchema, specSchema, taskSchema, tasksSchema, traceSchema } = await loadParserSchemas();

const fixture = join(import.meta.dirname, 'fixtures/openspec-project/openspec/changes/add-x');
const traceText = readFileSync(join(fixture, 'trace.md'), 'utf8')
  .replace('\n## 仮定', '\n| Q-01 | REQ-001 | 質問 | A / B | A | no | A |\n\n## 仮定')
  + '\n| A-01 | REQ-001 | 仮定 | 理由 | 承認 |\n';

const specText = `### Requirement: outside
Source: REQ-001
## ADDED Requirements
### Requirement: added
Source: REQ-001, REQ-002
#### Scenario: first
## RENAMED Requirements
- FROM: ### Requirement: old
- TO: ### Requirement: new
`;

describe('Markdown 解析結果の Zod スキーマ', () => {
  it('[REQ-299] 公開初版の定数と遅延ロードを提供し、返却データへ版を加えない', async () => {
    expect([TRACE_SCHEMA_VERSION, SPEC_SCHEMA_VERSION, TASKS_SCHEMA_VERSION]).toEqual(['1.0.0', '1.0.0', '1.0.0']);
    const loading = loadParserSchemas();
    expect(loading).toBeInstanceOf(Promise);
    const schemas = await loading;
    expect(schemas.traceSchema).toBe(traceSchema);
    expect(schemas.specSchema).toBe(specSchema);
    expect(schemas.tasksSchema).toBe(tasksSchema);
    const template = createTraceTemplate({ changeId: 'plain' });
    expect(template).not.toContain('version');
    expect(parseTrace('trace.md', template)).toEqual({ value: { ledger: [], questions: [], assumptions: [] }, errors: [] });
    expect(parseTasks('tasks.md', '- [x] done')).toEqual({ value: [{ checked: true, text: 'done', line: 1 }], errors: [] });
    expect(parseSpec('spec.md', '### Requirement: empty')).toEqual({ value: [{ op: null, name: 'empty', sources: [], scenarios: 0, line: 1 }], errors: [] });
  });

  it('[REQ-298] 公開型は各スキーマから導出する', () => {
    expectTypeOf<Trace>().toEqualTypeOf<z.infer<typeof traceSchema>>();
    expectTypeOf<LedgerRow>().toEqualTypeOf<z.infer<typeof ledgerRowSchema>>();
    expectTypeOf<QuestionRow>().toEqualTypeOf<z.infer<typeof questionRowSchema>>();
    expectTypeOf<AssumptionRow>().toEqualTypeOf<z.infer<typeof assumptionRowSchema>>();
    expectTypeOf<SpecOperation>().toEqualTypeOf<z.infer<typeof specOperationSchema>>();
    expectTypeOf<SpecRequirement>().toEqualTypeOf<z.infer<typeof specRequirementSchema>>();
    expectTypeOf<Task>().toEqualTypeOf<z.infer<typeof taskSchema>>();
    expectTypeOf<LedgerRow['状態']>().toEqualTypeOf<string>();
    expectTypeOf<SpecRequirement['from']>().toEqualTypeOf<string | undefined>();
    for (const name of ['trace', 'spec', 'tasks']) {
      expect(readFileSync(join(import.meta.dirname, '..', 'src', `${name}.ts`), 'utf8')).not.toMatch(/export type (?:Trace|LedgerRow|QuestionRow|AssumptionRow|SpecOperation|SpecRequirement|Task)\s*=\s*(?:\{|Row<|['"])/);
    }
  });

  it('[REQ-298] 既存パーサの値を受け付け、形と必須値を検証する', () => {
    const trace = parseTrace('trace.md', traceText);
    const spec = parseSpec('spec.md', specText);
    const tasks = parseTasks('tasks.md', '* [ ] first\n+ [X] second');
    expect(traceSchema.parse(trace.value)).toEqual(trace.value);
    expect(specSchema.parse(spec.value)).toEqual(spec.value);
    expect(tasksSchema.parse(tasks.value)).toEqual(tasks.value);
    expect(traceSchema.safeParse({ questions: [], assumptions: [] }).success).toBe(false);
    expect(specSchema.safeParse([{ ...spec.value[0], sources: 'REQ-001' }]).success).toBe(false);
    expect(tasksSchema.safeParse([{ checked: 'yes', text: 'x', line: 1 }]).success).toBe(false);
    expect(taskSchema.safeParse({ checked: false, text: 'x' }).success).toBe(false);
  });

  it('[REQ-298] 不正な台帳状態も値に残し、同じファイルと行番号のエラーを返す', () => {
    const text = traceText.replace('反映済', '対応中');
    const result = parseTrace('broken-trace.md', text);
    const row = result.value.ledger.find((entry) => entry['状態'] === '対応中');
    expect(row).toBeDefined();
    expect(result.errors).toContainEqual({ file: 'broken-trace.md', line: row!.line, message: `${row!.ID} の状態「対応中」は使えません（反映済・確認待ち・範囲外・既存仕様で充足 のどれかにしてください）` });
    expect(traceSchema.parse(result.value)).toEqual(result.value);
  });

  it('[REQ-298] 古い合意列・RENAMED・op:null・空の配列を変えない', () => {
    const trace = parseTrace('trace.md', traceText).value;
    for (const row of trace.questions) expect(row).toMatchObject({ 回答者: '', 回答日: '' });
    for (const row of trace.assumptions) expect(row).toMatchObject({ 承認者: '', 承認日: '' });
    expect(trace.questions.length).toBeGreaterThan(0);
    expect(trace.assumptions.length).toBeGreaterThan(0);
    const spec = parseSpec('spec.md', specText).value;
    expect(spec[0]).toMatchObject({ op: null, name: 'outside', sources: ['REQ-001'] });
    expect(spec[2]).toMatchObject({ op: 'RENAMED', name: 'new', from: 'old', sources: [], scenarios: 0 });
    expect(specRequirementSchema.parse(spec[0])).not.toHaveProperty('from');
    expect(specSchema.parse(spec)).toEqual(spec);
    expect(tasksSchema.parse(parseTasks('tasks.md', '').value)).toEqual([]);
    expect(traceSchema.parse(parseTrace('trace.md', createTraceTemplate({ changeId: 'empty' })).value)).toEqual({ ledger: [], questions: [], assumptions: [] });
  });

  it('[REQ-298] 未知フィールドを最上位と各行で保持する', () => {
    const trace = parseTrace('trace.md', traceText).value;
    const input = { ...trace, extra: { future: [1, 2] }, ledger: trace.ledger.map((row) => ({ ...row, future: 'ledger' })), questions: trace.questions.map((row) => ({ ...row, future: 'question' })), assumptions: trace.assumptions.map((row) => ({ ...row, future: 'assumption' })) };
    expect(traceSchema.parse(input)).toEqual(input);
    const spec = parseSpec('spec.md', specText).value.map((row) => ({ ...row, future: { nested: true } }));
    expect(specSchema.parse(spec)).toEqual(spec);
    const tasks = [{ checked: false, text: '', line: 1, future: [3] }];
    expect(tasksSchema.parse(tasks)).toEqual(tasks);
  });
});
