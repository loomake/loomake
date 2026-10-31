import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = { required?: string[]; properties?: Record<string, Schema>; items?: Schema; anyOf?: Schema[]; const?: string };

// 公開した版付きのファイル。版付きのファイルは中身を変えず、破壊的変更は新しい版のファイルとして足す（REQ-053・REQ-276）
const versionsDir = join(import.meta.dirname, '..', 'schema', 'versions');
// 版付きのファイルを公開したときの写し。比べる相手で、ここのファイルは変えない
const pinnedDir = join(import.meta.dirname, 'fixtures', 'schema-versions');
const historyDir = join(import.meta.dirname, 'fixtures', 'schema-history');
const readSchema = (p: string): Schema => JSON.parse(readFileSync(p, 'utf8'));

// 必須プロパティを、anyOf の枝と入れ子を含めたパス（[0].run.[1].errors[].kind など）で返す
function requiredPaths(s: Schema, prefix = ''): string[] {
  const own = (s.required ?? []).map((r) => prefix + r);
  const branches = (s.anyOf ?? []).flatMap((b, i) => requiredPaths(b, `${prefix}[${i}].`));
  const nested = Object.entries(s.properties ?? {}).flatMap(([k, v]) => [
    ...requiredPaths(v, `${prefix}${k}.`),
    ...(v.items ? requiredPaths(v.items, `${prefix}${k}[].`) : []),
  ]);
  return [...own, ...branches, ...nested];
}
// schemaVersion の const を、anyOf の枝を含めて集める
function versionsOf(s: Schema): string[] {
  const own = s.properties?.schemaVersion?.const;
  return [...(own ? [own] : []), ...(s.anyOf ?? []).flatMap(versionsOf)];
}

const pinned = [
  ['verify-result-1.0.0.schema.json', join(historyDir, '1.0.0.json'), '1.0.0'],
  ['verify-result-2.0.0.schema.json', join(pinnedDir, 'verify-result-2.0.0.json'), '2.0.0'],
] as const;

describe('版付きの verify 結果の JSON Schema', () => {
  it('[REQ-276][REQ-304] 版付きのファイルは公開した写しの必須プロパティと版をすべて保つ', () => {
    expect(readdirSync(versionsDir).sort()).toEqual(['evidence-1.schema.json', 'evidence-2.schema.json', 'verify-result-1.0.0.schema.json', 'verify-result-2.0.0.schema.json']);
    for (const [file, copy, version] of pinned) {
      const current = readSchema(join(versionsDir, file));
      const removed = requiredPaths(readSchema(copy)).filter((p) => !requiredPaths(current).includes(p));
      expect(removed, `${file} から削除・改名した必須プロパティ。版付きのファイルは変えず、新しい版を足してください`).toEqual([]);
      expect([...new Set(versionsOf(current))], file).toEqual([version]);
    }
  });

  it('[REQ-276] 2.0.0 の写しは、ci・local・aborted の必須項目を持つ', () => {
    const paths = requiredPaths(readSchema(join(pinnedDir, 'verify-result-2.0.0.json')));
    for (const branch of [0, 1]) {
      for (const key of ['schemaVersion', 'change', 'run', 'checks', 'decision', 'scope', 'summary']) expect(paths).toContain(`[${branch}].${key}`);
      for (const key of ['id', 'result', 'reason', 'evidence']) expect(paths).toContain(`[${branch}].checks[].${key}`);
    }
    expect(paths).toContain('[0].verdict');
    expect(paths).toContain('[1].summary.pending');
    for (const key of ['schemaVersion', 'change', 'run', 'run.status', 'run.errors', 'run.errors[].kind', 'run.errors[].next']) expect(paths).toContain(`[2].${key}`);
  });
});
