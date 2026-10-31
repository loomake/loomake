import { describe, it, expect } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderJsonSchemas, renderVersionedJsonSchemas } from '../src/json-schema.js';
import { evidenceValue } from './fixtures/trace-contract-values.js';
import { abortedValue, ciValue, localValue } from './fixtures/verify-v2-values.js';

const pkgDir = join(import.meta.dirname, '..');
const versionsDir = join(pkgDir, 'schema', 'versions');
const read = (file: string) => JSON.parse(readFileSync(join(versionsDir, file), 'utf8'));

describe('版付きの JSON Schema の書き出し', () => {
  it('[REQ-276][REQ-304] Zod から書き出した内容と schema/versions/ のファイルが一致し、exports から公開する', () => {
    const rendered = renderVersionedJsonSchemas();
    expect(Object.keys(rendered).sort()).toEqual(readdirSync(versionsDir).sort());
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    for (const [file, text] of Object.entries(rendered)) {
      expect(readFileSync(join(versionsDir, file), 'utf8').replace(/\r\n/g, '\n'), `schema/versions/${file} が Zod スキーマと違います。pnpm --filter @loomake/core schema:write で書き出してください`).toBe(text);
      expect(JSON.parse(text).$id).toBe(`https://loomake.dev/schema/versions/${file}`);
      for (const exports of [pkg.exports, pkg.publishConfig.exports]) expect(exports[`./schema/versions/${file}`]).toBe(`./schema/versions/${file}`);
    }
  });

  it('[REQ-304][REQ-305][REQ-318] 版付きでない 8 ファイルの verify は 2.0.0、evidence はまだ Evidence 1 を表し、版付きのファイルと同じ構造になる', () => {
    const current = renderJsonSchemas();
    expect(Object.keys(current)).toHaveLength(8);
    const strip = (text: string) => ({ ...JSON.parse(text), $id: undefined, title: undefined, description: undefined });
    const versioned = renderVersionedJsonSchemas();
    expect(strip(versioned['verify-result-2.0.0.schema.json'])).toEqual(strip(current['verify-result.schema.json']));
    const verifyOf = (text: string) => ({ ...JSON.parse(text).properties.verify, title: undefined, description: undefined });
    // 証拠の現行の名前の切替は 2b-2 で行う。それまで evidence.schema.json は Evidence 1（verify 1.0.0）を表す
    expect(verifyOf(current['evidence.schema.json'])).toEqual(verifyOf(versioned['evidence-1.schema.json']));
    const versions = JSON.parse(current['verify-result.schema.json']).anyOf.map((branch: { properties: { schemaVersion: { const: string } } }) => branch.properties.schemaVersion.const);
    expect(new Set(versions)).toEqual(new Set(['2.0.0']));
  });

  it('[REQ-276][REQ-304][REQ-308] 新旧の JSON Schema が同じ有効・無効の入力を Zod と同じに判定し、同じ registry に登録できる', () => {
    const registry = new Ajv2020({ strict: false });
    for (const text of [...Object.values(renderJsonSchemas()), ...Object.values(renderVersionedJsonSchemas())]) registry.addSchema(JSON.parse(text));
    const v2 = registry.getSchema(read('verify-result-2.0.0.schema.json').$id)!;
    const v1 = registry.getSchema(read('verify-result-1.0.0.schema.json').$id)!;
    const e2 = registry.getSchema(read('evidence-2.schema.json').$id)!;
    const e1 = registry.getSchema(read('evidence-1.schema.json').$id)!;
    for (const value of [ciValue(), localValue(), abortedValue(), { ...ciValue(), extra: { future: 1 } }]) {
      expect(v2(value), JSON.stringify(v2.errors)).toBe(true);
      expect(v1(value)).toBe(false);
      expect(e2({ ...evidenceValue(), schemaVersion: 2, verify: value }), JSON.stringify(e2.errors)).toBe(true);
    }
    for (const value of [{ ...localValue(), verdict: 'PASS' }, { ...abortedValue(), checks: [] }, { ...ciValue(), run: { status: 'partial', errors: [] } }]) {
      expect(v2(value), JSON.stringify(value)).toBe(false);
    }
    expect(v1(evidenceValue().verify)).toBe(true);
    expect(e1(evidenceValue())).toBe(true);
    expect(e1({ ...evidenceValue(), verify: ciValue() })).toBe(false);
    expect(e2(evidenceValue())).toBe(false);
  });
});
