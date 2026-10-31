import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inventoryDeclarations, checkRegistration } from '../scripts/lib/test-declarations.mjs';
import { companionOf, loadPartition } from '../scripts/lib/test-partition.mjs';

const file = 'tests/fixture.test.ts';
const codes = (source: string) => inventoryDeclarations(source, file).errors.map((error: { code: string }) => error.code);
const registration = (source: string, cases: Record<string, string[]> = { a: [] }) => checkRegistration(file, source, cases).map((error: { code: string }) => error.code);
const declared = (id = 'a', title = 'case a') => `if (has('${id}')) it('${title}', () => {});`;

describe('独立した試験宣言 inventory', () => {
  it.each([
    ['packages/runner/test/run.test.ts', 58, 60, 68, ['importSpecifier', 'propertyKey']],
    ['packages/runner/test/run-timeout.test.ts', 2, 3, 2, ['importSpecifier']],
  ] as const)('受入済み main の移動後 baseline を保持する: %s', (path, declarations, candidates, rows, nonCall) => {
    const inventory = inventoryDeclarations(readFileSync(path, 'utf8'), path);
    expect(inventory.errors).toEqual([]);
    expect(inventory.declarations).toHaveLength(declarations);
    expect(inventory.scannerCandidates).toHaveLength(candidates);
    expect(inventory.expandedRows).toBe(rows);
    expect(inventory.nonCall.map((item: { kind: string }) => item.kind)).toEqual(nonCall);
    if (path.endsWith('/run.test.ts')) expect(inventory.declarations.reduce((counts: Record<string, number>, item: { kind: string }) => ({ ...counts, [item.kind]: (counts[item.kind] ?? 0) + 1 }), {})).toEqual({ direct: 55, runIf: 1, each: 2 });
  });
  // G-B baseline: 3d664093。将来 main を統合するときは本文保持の証拠と再照合する。
  it.each([
    ['packages/runner/test/guards.test.ts', 37, 52, 40, 1, 8, 6],
    ['packages/runner/test/run-no-change.test.ts', 12, 13, 25, 1, 0, 0],
  ] as const)('G-B設計の宣言・候補・全展開行とhelper分類を保つ: %s', (path, declarations, candidates, rows, imports, properties, helpers) => {
    const result = inventoryDeclarations(readFileSync(path, 'utf8'), path);
    expect(result.errors).toEqual([]); expect(result.declarations).toHaveLength(declarations);
    expect(result.scannerCandidates).toHaveLength(candidates); expect(result.expandedRows).toBe(rows);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'importSpecifier')).toHaveLength(imports);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'propertyKey')).toHaveLength(properties);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'localHelper')).toHaveLength(helpers);
  });
  it('通常const helperの定義と同じbindingの非call参照を区別する', () => {
    const result = inventoryDeclarations("const withTest = (repo) => repo.write('file', 'it( only text'); fn(withTest); const options = { withTest };", file);
    expect(result.errors).toEqual([]); expect(result.declarations).toEqual([]);
    expect(result.nonCall.map((item: { kind: string }) => item.kind)).toEqual(['localHelper', 'localHelper', 'localHelper']);
    expect(result.expandedRows).toBe(0);
  });
  it.each([
    ["const withTest = () => {}; function scope(withTest) { fn(withTest); }", ['unclassifiedCandidate', 'unclassifiedCandidate']],
    ["let withTest = () => {}; fn(withTest);", ['unclassifiedCandidate', 'unclassifiedCandidate']],
    ["const withTest = it; fn(withTest);", ['unclassifiedCandidate', 'unclassifiedCandidate', 'unclassifiedCandidate', 'alias']],
    ["const alias = it; const withTest = alias; fn(withTest);", ['unclassifiedCandidate', 'unclassifiedCandidate', 'unclassifiedCandidate', 'alias', 'alias']],
  ])('bindingが違う参照・非const・test aliasを通常helperとして認めない: %s', (source, expected) => {
    expect(codes(source)).toEqual(expected);
  });
  it.each(['(v)', 'v as typeof v'])('wrapped namespace由来のtest aliasを通常helperに分類しない: %s', (namespace) => {
    const result = inventoryDeclarations(`import * as v from 'vitest'; const namespace = ${namespace}; const withTest = namespace.it; fn(withTest);`, file);
    expect(result.nonCall).toEqual([]);
    expect(result.errors.map((error: { code: string }) => error.code)).toEqual(['unclassifiedCandidate', 'unclassifiedCandidate', 'alias', 'alias']);
  });
  it('実 registry の各宣言と全 companion の登録を確認する', () => {
    const registry = loadPartition(process.cwd());
    for (const [path, { cases }] of Object.entries(registry.files)) {
      const source = readFileSync(path, 'utf8');
      expect(inventoryDeclarations(source, path).errors).toEqual([]);
      expect(checkRegistration(path, source, cases)).toEqual([]);
    }
    const companions: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name).split('\\').join('/');
        if (entry.isDirectory()) visit(path);
        else if (path.endsWith('.slow.test.ts')) companions.push(path);
      }
    };
    visit('tests'); visit('packages');
    expect(companions.sort()).toEqual(Object.keys(registry.files).map(companionOf).sort());
  });
  it('型引数・each・runIf・タグ付き表・CRLFと既知の非callを独立して数える', () => {
    const source = [
      "import { it, test } from 'vitest'; const options = { test: true };",
      "it.each<{ value: number }>([{ value: 1 }, { value: 2 }])('value %j', () => {});",
      "test.runIf(true)('conditional case', () => {});",
      "posixIt.each`value | result\n${1} | ${2}\n${3} | ${4}`('table $value', () => {});",
    ].join('\r\n');
    const result = inventoryDeclarations(source, file);
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(3);
    expect(result.nonCall).toHaveLength(3);
    expect(result.expandedRows).toBe(5);
  });
  it.each([
    ['syntax', "it('broken', () => {", ['syntax', 'scannerMismatch', 'dynamicTitle']],
    ['scannerMismatch', "it /* comment */ ('literal case', () => {});", ['scannerMismatch', 'dynamicTitle']],
    ['scannerFalsePositive', 'const object = { test() {} };', ['scannerFalsePositive']],
    ['unclassifiedCandidate', 'export { it };', ['unclassifiedCandidate']],
    ['unclassifiedCandidate', 'fn(it);', ['unclassifiedCandidate']],
    ['unclassifiedCandidate', 'const value = { it };', ['unclassifiedCandidate']],
    ['alias', "import { it as check } from 'vitest'; check('literal case', () => {});", ['unclassifiedCandidate', 'alias']],
    ['alias', 'const check = it;', ['unclassifiedCandidate', 'alias']],
    ['alias', "import { describe as group } from 'vitest'; group('group', () => {});", ['alias']],
    ['alias', "import * as vitest from 'vitest'; vitest.it('own case', () => {});", ['alias']],
    ['alias', "import * as v from 'vitest'; const check = v.test; check('own case', () => {});", ['alias', 'alias']],
    ['dynamicTitle', 'it(title, () => {});', ['dynamicTitle']],
    ['dynamicTitle', "it.each([1])('%s', () => {});", ['dynamicTitle']],
  ])('除外せず %s と関連診断を報告する: %s', (_, source, expected) => {
    expect(codes(source)).toEqual(expected);
  });
  it.each(["describe.each(groups)('group %s', () => { it('case a', () => {}); });", "describe.each([1,2])('group %s', () => { it('case a', () => {}); });"])('parameterized describe内の展開数は未確定と明示する: %s', (source) => {
    const result = inventoryDeclarations(source, file);
    expect(result.errors.map((error: { code: string }) => error.code)).toEqual(['dynamicRows']);
    expect(result.declarations).toHaveLength(1); expect(result.expandedRows).toBeUndefined();
  });
  it.each(["it.each(rows)('literal case %j', () => {});", "it.each([...rows])('literal case %j', () => {});"])('未知の展開数をdynamicTitleに混ぜず明示する: %s', (source) => {
    const result = inventoryDeclarations(source, file);
    expect(result.errors.map((error: { code: string }) => error.code)).toEqual(['dynamicRows']);
    expect(result.declarations).toHaveLength(1);
    expect(result.declarations[0].rows).toBeUndefined();
    expect(result.expandedRows).toBeUndefined();
  });
});

describe('登録宣言の構造', () => {
  const cases = { a: ['linux'], b: [] };
  const source = `const has = (id) => includeCase(registry, '${file}', part, id);
if (hasAny(['a'])) describe('slow group', () => { ${declared()} });
if (hasAny(['b'])) describe('fast group', () => { if (has('b')) it.each([1,2])('table %j', () => {}); });`;
  it('元file・literal ID・空describeのguardが一致すれば通る', () => {
    expect(registration(source, cases)).toEqual([]);
    expect(inventoryDeclarations(source, file).errors).toEqual([]);
    expect(registration(`describe('all fast', () => { ${declared()} });`)).toEqual([]);
  });
  it.each([
    ['unprefixed', "it('case a', () => {});", { a: [] }, ['unprefixed', 'missingId']],
    ['unprefixed', `${declared()} else it('other', () => {});`, { a: [] }, ['unprefixed', 'unprefixed', 'missingId']],
    ['invalidId', declared('req-012'), { 'req-012': [] }],
    ['invalidId', declared('Bad_ID'), { Bad_ID: [] }],
    ['duplicateId', declared() + declared(), { a: [] }],
    ['unknownId', declared('b'), { a: [] }, ['unknownId', 'missingId', 'dynamicGuard']],
    ['missingId', declared(), { a: [], b: [] }],
    ['dynamicGuard', "if (has(id)) it('case a', () => {});", { a: [] }, ['unprefixed', 'missingId', 'dynamicGuard']],
    ['dynamicGuard', "if (hasAny(ids)) describe('group', () => {});", { a: [] }, ['missingId', 'dynamicGuard', 'guardMismatch']],
    ['dynamicGuard', "if (hasAny(['unknown'])) describe('group', () => {});", { a: [] }, ['missingId', 'dynamicGuard', 'guardMismatch']],
    ['includeCaseTarget', "includeCase(registry, 'tests/wrong.test.ts', part, id);" + declared(), { a: [] }],
    ['includeCaseTarget', 'includeCase(registry, target, part, id);' + declared(), { a: [] }],
    ['unguardedDescribe', `describe('group', () => { ${declared()} }); ${declared('b')}`, cases],
    ['guardMismatch', `if (hasAny(['a', 'b'])) describe('group', () => { ${declared()} }); ${declared('b')}`, cases],
    ['guardMismatch', `if (hasAny(['a', 'a'])) describe('group', () => { ${declared()} }); ${declared('b')}`, cases],
  ])('%s を検出する: %s', (code, input, registered, expected: string[] = [code]) => {
    expect(registration(input, registered)).toEqual(expected);
  });
  it('nested describeにも子孫IDと各OS/partの空集合検査を適用する', () => {
    const nested = `if (hasAny(['a','b'])) describe('parent', () => { if (hasAny(['a'])) describe('child', () => { ${declared()} }); ${declared('b')} });`;
    expect(registration(nested, cases)).toEqual([]);
    expect(registration(nested.replace("if (hasAny(['a'])) ", ''), cases)).toEqual(['unguardedDescribe']);
  });
});
