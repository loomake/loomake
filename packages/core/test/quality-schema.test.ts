import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { loadQualitySchema, QUALITY_SCHEMA_VERSION, type Quality } from '../src/index.js';

const { qualitySchema } = await loadQualitySchema();

/** 要件定義 7.1 の quality.yaml の例を、YAML として解析した値 */
const example = () => ({
  version: 2,
  model: 'iso-iec-25010-2011',
  defaults: { window: '14d', min_samples: 100 },
  report: { status: 'weekly', publish: 'discussion' },
  objectives: {
    'UQ-001': {
      characteristic: 'efficiency',
      context: 'CONTEXT-001',
      task: '月次締めを完了する',
      evidence: [{ metric: 'task_duration_p90_sec', source: 'telemetry.task.monthly_close', target: '<= 1800', min_samples: 20 }],
      indicators: [{ metric: 'e2e_duration_sec', source: 'e2e.monthly_close' }],
      guardrails: ['UQ-002'],
      blocking: true,
      linked_requirements: ['PQ-012', 'PQ-020', 'REQ-003'],
    },
  },
  product: {
    'PQ-012': {
      characteristic: 'usability',
      subcharacteristic: 'operability',
      objectives: ['UQ-001'],
      evidence: [{ metric: 'e2e_steps', source: 'e2e.monthly_close', target: '<= 12' }],
      indicators: [{ metric: 'task_abandon_rate', source: 'telemetry.task.monthly_close' }],
    },
    'PQ-031': {
      characteristic: 'maintainability',
      subcharacteristic: 'testability',
      evidence: [
        { metric: 'coverage_line', source: 'ci.coverage', target: '>= 80' },
        { metric: 'tests_without_assertion', source: 'ci.test_report', target: '== 0' },
      ],
      blocking: false,
    },
    'PQ-040': {
      characteristic: 'compatibility',
      subcharacteristic: 'coexistence',
      applicability: 'not_applicable',
      reason: '単一テナントの専用環境で他システムと同居しない',
      confirmed_by: 'r',
    },
  },
  automation: {
    level: 'A1',
    allowed_paths: ['src/**', '!src/auth/**', '!src/payment/**'],
    protected_paths: ['src/auth/**', 'src/payment/**', 'migrations/**', 'tests/**'],
    max_diff_lines: 250,
    require_rollback: true,
  },
  evidence: {
    artifact_retention: '90d',
    long_term_store: 'github-release',
    long_term_retention: '5y',
    access: 'project-members',
    delete_policy: 'owner-approval',
  },
});

const parses = (value: unknown) => qualitySchema.safeParse(value).success;

describe('quality.yaml の Zod スキーマ', () => {
  it('[REQ-283] 要件定義 7.1 の例を受け付け、未知のフィールドを残す', () => {
    expect(QUALITY_SCHEMA_VERSION).toBe(2);
    const value = { ...example(), extra: { note: 'x' } };
    const parsed = qualitySchema.parse(value);
    expect(parsed.extra).toEqual({ note: 'x' });
    expect(parsed.product['PQ-040'].evidence).toEqual([]);
    const nested = qualitySchema.parse({
      version: 2, model: 'm',
      objectives: { 'UQ-001': { characteristic: 'custom', extra: { score: 1 }, evidence: [{ metric: 'custom', source: 'custom', extra: true }] } },
      product: { 'PQ-001': { characteristic: 'custom', extra: ['x'] } },
      defaults: { extra: 42 }, report: { extra: true }, automation: { extra: 'x' }, evidence: { extra: null },
    });
    expect(nested.objectives['UQ-001'].extra).toEqual({ score: 1 });
    expect(nested.objectives['UQ-001'].evidence[0].extra).toBe(true);
    expect(nested.product['PQ-001'].extra).toEqual(['x']);
    expect(nested.defaults?.extra).toBe(42);
    expect(nested.report?.extra).toBe(true);
    expect(nested.automation?.extra).toBe('x');
    expect(nested.evidence.extra).toBeNull();
  });

  it('[REQ-283] 版のない quality.yaml と、版が 2 でない quality.yaml を拒否する', () => {
    const { version: _version, ...withoutVersion } = example();
    expect(parses(withoutVersion)).toBe(false);
    expect(parses({ ...example(), version: 1 })).toBe(false);
    expect(parses({ ...example(), version: '2' })).toBe(false);
  });

  it('[REQ-283] model と characteristic を必須にし、空の文字列を拒否する', () => {
    const { model: _model, ...withoutModel } = example();
    expect(parses(withoutModel)).toBe(false);
    expect(parses({ ...example(), model: '' })).toBe(false);
    const value = example();
    value.product['PQ-031'].characteristic = '';
    expect(parses(value)).toBe(false);
    expect(parses({ version: 2, model: 'm', product: { 'PQ-001': {} } })).toBe(false);
  });

  it('[REQ-283] 書式の違う target と期間を拒否する', () => {
    const badTarget = example();
    badTarget.product['PQ-012'].evidence[0].target = 'about 1800';
    expect(parses(badTarget)).toBe(false);
    for (const window of ['2m', '0d', '14', '1.5d']) expect(parses({ ...example(), defaults: { window } }), window).toBe(false);
    for (const t of ['<= 1800', '>=80', '== 0', '< -1.5', '> 3']) {
      const value = example();
      value.product['PQ-012'].evidence[0].target = t;
      expect(parses(value), t).toBe(true);
    }
  });

  it('[REQ-283] evidence と indicators は省くと空の配列になり、applicability は 2 つの値だけを受け付ける', () => {
    const parsed = qualitySchema.parse({ version: 2, model: 'm', product: { 'PQ-001': { characteristic: 'security' } } });
    expect(parsed.product['PQ-001']).toMatchObject({ evidence: [], indicators: [] });
    expect(parsed.objectives).toEqual({});
    expect(parses({ version: 2, model: 'm', product: { 'PQ-001': { characteristic: 'security', applicability: 'maybe' } } })).toBe(false);
  });

  it('[REQ-284] 型はスキーマから導出する', () => {
    expectTypeOf<Quality>().toEqualTypeOf<z.output<typeof qualitySchema>>();
    for (const file of ['quality.ts', 'quality-schema.ts']) {
      expect(readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8')).not.toMatch(/export type \w+ = \{/);
    }
  });

  it('[REQ-285] evidence: を省くと、最小スキーマの既定値を補う', () => {
    const { evidence: _evidence, ...withoutPolicy } = example();
    expect(qualitySchema.parse(withoutPolicy).evidence).toEqual({
      artifact_retention: '90d',
      long_term_store: 'github-release',
      long_term_retention: '5y',
      access: 'project-members',
      delete_policy: 'owner-approval',
    });
    expect(qualitySchema.parse({ ...example(), evidence: { access: 'owner' } }).evidence).toMatchObject({ access: 'owner', artifact_retention: '90d' });
  });

  it('[REQ-285] evidence: の enum と期間が不正なときは拒否する', () => {
    expect(parses({ ...example(), evidence: { long_term_store: 's3' } })).toBe(false);
    expect(parses({ ...example(), evidence: { access: 'everyone' } })).toBe(false);
    expect(parses({ ...example(), evidence: { delete_policy: 'anytime' } })).toBe(false);
    expect(parses({ ...example(), evidence: { artifact_retention: '90 days' } })).toBe(false);
  });

  it('[REQ-286] not_applicable の項目に理由か確認者がなければ拒否する', () => {
    for (const key of ['reason', 'confirmed_by'] as const) {
      const value = example();
      delete (value.product['PQ-040'] as Record<string, unknown>)[key];
      const result = qualitySchema.safeParse(value);
      expect(result.success, key).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(`product.PQ-040.${key}`);
    }
    const objective = { version: 2, model: 'm', objectives: { 'UQ-001': { characteristic: 'efficiency', applicability: 'not_applicable' } } };
    expect(parses(objective)).toBe(false);
    expect(parses({ ...objective, objectives: { 'UQ-001': { ...objective.objectives['UQ-001'], reason: '対象外', confirmed_by: 'owner' } } })).toBe(true);
  });
});
