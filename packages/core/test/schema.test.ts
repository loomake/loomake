import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERIFY_RESULT_SCHEMA_VERSION } from '../src/index.js';

type Schema = { required?: string[]; properties?: Record<string, Schema>; items?: Schema; const?: string; anyOf?: Schema[] };

const schemaPath = join(import.meta.dirname, '..', 'schema', 'verify-result.schema.json');
// 公開した版のスキーマ。破壊的変更をしたら、新しい版をここに足す
const historyDir = join(import.meta.dirname, 'fixtures', 'schema-history');
const readSchema = (p: string): Schema => JSON.parse(readFileSync(p, 'utf8'));
const major = (v: string) => Number(v.split('.')[0]);
// 2.0.0 からは scope と実行状態で形を分ける anyOf になる。1.0.0 のような単一の形は 1 つの枝として扱う
const branches = (s: Schema): Schema[] => s.anyOf ?? [s];
const versionOf = (s: Schema) => {
  const versions = [...new Set(branches(s).map((b) => b.properties?.schemaVersion?.const ?? ''))];
  return versions.length === 1 ? versions[0] : '';
};

// 必須プロパティを、入れ子を含めたパス（results[].check など）で返す。anyOf は、どれかの枝で必須のパスを合わせる
function requiredPaths(s: Schema, prefix = ''): string[] {
  if (s.anyOf) return [...new Set(s.anyOf.flatMap((b) => requiredPaths(b, prefix)))];
  const own = (s.required ?? []).map((r) => prefix + r);
  const nested = Object.entries(s.properties ?? {}).flatMap(([k, v]) => [
    ...requiredPaths(v, `${prefix}${k}.`),
    ...(v.items ? requiredPaths(v.items, `${prefix}${k}[].`) : []),
  ]);
  return [...own, ...nested];
}

describe('verify 結果の JSON スキーマ', () => {
  it('[REQ-016] schemaVersion を必須プロパティとして定義し、型の版と一致する', () => {
    const schema = readSchema(schemaPath);
    for (const branch of branches(schema)) expect(branch.required).toContain('schemaVersion');
    expect(versionOf(schema)).toBe(VERIFY_RESULT_SCHEMA_VERSION);
    expect(VERIFY_RESULT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('[REQ-016] @loomake/core からスキーマを読める', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.exports['./schema/verify-result.schema.json']).toBe('./schema/verify-result.schema.json');
    expect(pkg.files).toContain('schema');
  });

  it('[REQ-053] 必須プロパティを削除・改名したら、schemaVersion のメジャー番号が前の版より大きい', () => {
    const current = readSchema(schemaPath);
    const history = readdirSync(historyDir).map((f) => readSchema(join(historyDir, f)));
    expect(history.length).toBeGreaterThan(0);
    for (const old of history) {
      const removed = requiredPaths(old).filter((p) => !requiredPaths(current).includes(p));
      if (removed.length > 0) expect(major(versionOf(current)), `削除・改名した必須プロパティ：${removed.join(', ')}`).toBeGreaterThan(major(versionOf(old)));
      else expect(major(versionOf(current))).toBeGreaterThanOrEqual(major(versionOf(old)));
    }
  });

  it('[REQ-053] 必須プロパティを削除したスキーマは、メジャー番号を上げないと検出される', () => {
    const old = readSchema(join(historyDir, '1.0.0.json'));
    const broken: Schema = { ...old, required: old.required?.filter((r) => r !== 'ok') };
    const removed = requiredPaths(old).filter((p) => !requiredPaths(broken).includes(p));
    expect(removed).toEqual(['ok']);
  });
});
