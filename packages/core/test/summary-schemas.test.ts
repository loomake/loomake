import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { loadSummarySchemas, SUMMARY_VERSION } from '../src/index.js';
import { renderSummaryJsonSchemas, renderJsonSchemas, renderVersionedJsonSchemas } from '../src/json-schema.js';

const sample = () => ({ schemaVersion: 2, change: 'sample', sha: 'a'.repeat(40), committedAt: '2026-11-05T00:00:00Z', recordedAt: '2026-11-05T00:00:01Z',
  verify: { schemaVersion: '2.0.0', change: 'sample', run: { status: 'completed', errors: [] }, scope: 'local', checks: [], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 0, pending: 0 }, decision: { required: false, reasons: [] } },
  summaryVersion: 1, role: 'development', ci: null, execution: { id: 'id', origin: 'local', evaluator: { name: '@loomake/trace', version: '0.0.0' }, basisSha256: 'b'.repeat(64), environment: { node: 'v24', platform: 'linux', arch: 'x64' }, commands: { source: 'defaults', sha256: null, nameRefs: null }, producer: null, startedAt: '2026-11-05T00:00:00Z', finishedAt: '2026-11-05T00:00:01Z', verification: 'executed' }, artifacts: [], request: null, observation: null, gaps: [] });

describe('要約拡張の独立した構造', () => {
  it('[REQ-460][REQ-461] ciとlocationの試行番号は構造と生成Schemaの両方で正規文字列のsafe境界を守る', async () => {
    const { evidenceSummarySchema, summaryArtifactSchema } = await loadSummarySchemas();
    const schema = JSON.parse(Object.values(renderSummaryJsonSchemas())[0]);
    const ajv = new Ajv2020({ strict: false });
    const ci = ajv.compile(schema.properties.ci), location = ajv.compile(schema.properties.artifacts.items.properties.location);
    for (const runAttempt of ['1', '9007199254740991', 1, '0', '01', '-1', '1e2', '1.5', ' 1', '1 ', '9007199254740992', '9999999999999999', ['1'], { toString: null }]) {
      const expected = typeof runAttempt === 'string' && ['1', '9007199254740991'].includes(runAttempt);
      const c = { runId: '1', runAttempt, source: 'environment' };
      const l = { type: 'github-actions-artifact', repository: 'o/r', runId: '1', runAttempt, artifactName: 'test', entry: 'report.json', createdAt: '2026-11-05T00:00:00Z' };
      expect(evidenceSummarySchema.shape.ci.safeParse(c).success).toBe(expected); expect(ci(c)).toBe(expected);
      expect(summaryArtifactSchema.shape.location.safeParse(l).success).toBe(expected); expect(location(l)).toBe(expected);
    }
  });
  it('[REQ-460] 遅延ロードと独立JSON Schemaを公開し元12本の内容を保つ', async () => {
    const { evidenceSummarySchema } = await loadSummarySchemas();
    expect(SUMMARY_VERSION).toBe(1);
    expect(evidenceSummarySchema.safeParse(sample()).success).toBe(true);
    expect(evidenceSummarySchema.safeParse({ ...sample(), summaryVersion: 2 }).success).toBe(false);
    const base = join(import.meta.dirname, '..', 'schema');
    for (const [directory, rendered] of [['', renderJsonSchemas()], ['versions', renderVersionedJsonSchemas()], ['summary', renderSummaryJsonSchemas()]] as const) {
      for (const [file, contents] of Object.entries(rendered)) expect(readFileSync(join(base, directory, file), 'utf8').replace(/\r\n/g, '\n')).toBe(contents);
    }
    expect(Object.keys(renderJsonSchemas())).toHaveLength(8);
    expect(Object.keys(renderVersionedJsonSchemas())).toHaveLength(4);
    const pkg = JSON.parse(readFileSync(join(base, '..', 'package.json'), 'utf8'));
    const file = './schema/summary/evidence-summary-1.schema.json';
    expect(pkg.exports[file]).toBe(file); expect(pkg.publishConfig.exports[file]).toBe(file);
  });
  it('[REQ-460] 未知欄と各cloneのown __proto__を保持する', async () => {
    const { evidenceSummarySchema } = await loadSummarySchemas();
    const value = JSON.parse(JSON.stringify(sample()));
    Object.defineProperty(value, '__proto__', { value: { future: true }, enumerable: true });
    Object.defineProperty(value.execution.commands, '__proto__', { value: 42, enumerable: true });
    value.future = { nested: null };
    const parsed = evidenceSummarySchema.parse(value);
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true);
    expect(Object.hasOwn(parsed.execution.commands, '__proto__')).toBe(true);
    expect(parsed.future).toEqual({ nested: null });
  });
});
