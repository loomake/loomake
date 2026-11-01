import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inventoryDeclarations, checkRegistration, checkPartitionWiring } from '../scripts/lib/test-declarations.mjs';
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
  it.each([
    ['tests/schema-compatibility.test.ts', '[REQ-053] 実際のスキーマ検査が削除・改名・minorだけの変更を拒否し、majorの変更を許可する'],
    ['tests/schema-version-contract.test.ts', '[REQ-276] 版付きの 2.0.0 の JSON Schema への削除・改名・版の変更を実際の検査が拒否し、既存の 8 試行も保つ'],
  ] as const)('接頭辞前のschema各1宣言・全2候補・1展開行を保持する: %s', (path, title) => {
    const source = readFileSync(path, 'utf8');
    const result = inventoryDeclarations(source, path);
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(1);
    expect(result.scannerCandidates).toHaveLength(2);
    expect(result.expandedRows).toBe(1);
    expect(result.nonCall).toEqual([{ start: 17, line: 1, kind: 'importSpecifier' }]);
    expect(result.declarations[0]).toMatchObject({ start: 210, line: 7, kind: 'direct', rows: 1 });
    expect(result.declarations[0].text.startsWith(`it('${title}', () => {`)).toBe(true);
  });
  // 3d664093: 37/52/40。PR235の旧37本文保持＋REQ-348の2宣言追加を照合済み（22be0369）。
  it.each([
    ['packages/runner/test/guards.test.ts', 39, 54, 42, 1, 8, 6],
    ['packages/runner/test/run-no-change.test.ts', 12, 13, 25, 1, 0, 0],
  ] as const)('G-B設計の宣言・候補・全展開行とhelper分類を保つ: %s', (path, declarations, candidates, rows, imports, properties, helpers) => {
    const result = inventoryDeclarations(readFileSync(path, 'utf8'), path);
    expect(result.errors).toEqual([]); expect(result.declarations).toHaveLength(declarations);
    expect(result.scannerCandidates).toHaveLength(candidates); expect(result.expandedRows).toBe(rows);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'importSpecifier')).toHaveLength(imports);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'propertyKey')).toHaveLength(properties);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'localHelper')).toHaveLength(helpers);
    if (path.endsWith('/guards.test.ts')) {
      const addedNames = result.declarations.map((item: { text: string }) => item.text.match(/^it\('([^']+)'/)?.[1]).filter((name: string | undefined) => name?.startsWith('[REQ-348]'));
      expect(addedNames).toEqual([
        '[REQ-348][REQ-126][REQ-198][REQ-204] エンジンの前後で、rev-parse と config --list を 1 回ずつ読む',
        '[REQ-348][REQ-205][REQ-126] 完了ゲートの検証の前後で HEAD を 1 回ずつ読み、直しのエンジンの前で読み直す',
      ]);
      expect(result.declarations.length - addedNames.length).toBe(37);
    }
  });
  it.each([
    ['packages/runner/test/engine-long-deadline.test.ts', 4, 5, 4, 0, 0],
    ['packages/runner/test/scenario-timeout-evidence.test.ts', 2, 4, 2, 1, 0],
    ['packages/runner/test/signal-during-sync.test.ts', 8, 13, 11, 2, 2],
    ['packages/runner/test/run-timeout.test.ts', 2, 3, 2, 0, 0],
    ['packages/runner/test/external-budget-deadline.test.ts', 3, 4, 6, 0, 0],
  ] as const)('独立照合したC1・C2の元宣言・全候補・展開行を保持する: %s', (path, declarations, candidates, rows, properties, factories) => {
    const result = inventoryDeclarations(readFileSync(path, 'utf8'), path);
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(declarations);
    expect(result.scannerCandidates).toHaveLength(candidates);
    expect(result.expandedRows).toBe(rows);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'importSpecifier')).toHaveLength(1);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'propertyKey')).toHaveLength(properties);
    expect(result.nonCall.filter((item: { kind: string }) => item.kind === 'conditionalFactory')).toHaveLength(factories);
  });
  it.each(['it', 'test'])('同じfileの非export const factoryを静的に分類する: %s', (name) => {
    for (const method of ['runIf', 'skipIf']) {
      const initializer = `${name}.${method}(conditionMustNotRun())`;
      const direct = "posixIt('direct case', () => { assertBody(); })";
      const each = "posixIt.each([1, 2] as const)('table %j', () => { assertBody(); })";
      const source = `const posixIt = ${initializer}; if (has('a')) ${direct}; if (has('b')) ${each};`;
      const result = inventoryDeclarations(source, file);
      expect(result.errors).toEqual([]);
      expect(result.nonCall).toEqual([
        { start: source.indexOf('posixIt'), line: 1, kind: 'conditionalFactory' },
        { start: source.indexOf(initializer), line: 1, kind: 'conditionalFactory' },
      ]);
      expect(result.declarations.map((item: { text: string; kind: string; rows: number | undefined }) => ({ text: item.text, kind: item.kind, rows: item.rows }))).toEqual([
        { text: direct, kind: 'direct', rows: 1 }, { text: each, kind: 'each', rows: 2 },
      ]);
      expect(result.expandedRows).toBe(3);
      expect(registration(source, { a: ['linux'], b: [] })).toEqual([]);
    }
  });
  it.each([
    ["let posixIt = it.runIf(true);", ['dynamicTitle', 'unclassifiedCandidate', 'alias']],
    ["export const posixIt = it.runIf(true);", ['dynamicTitle', 'unclassifiedCandidate', 'alias']],
    ["const check = it.runIf(true);", ['dynamicTitle', 'alias']],
    ["const posixIt = it.runIf();", ['dynamicTitle', 'unclassifiedCandidate', 'alias']],
    ["const posixIt = it.runIf(...conditions);", ['dynamicTitle', 'unclassifiedCandidate', 'alias']],
    ["const posixIt = it.skipIf(true, false);", ['dynamicTitle', 'unclassifiedCandidate', 'alias']],
    ["const posixIt = it.skip;", ['unclassifiedCandidate', 'unclassifiedCandidate', 'alias']],
    ["const base = it; const posixIt = base.runIf(true);", ['unclassifiedCandidate', 'unclassifiedCandidate', 'alias', 'alias']],
    ["const posixIt = it.runIf(true); export { posixIt };", ['unclassifiedCandidate']],
    ["const posixIt = it.runIf(true); fn(posixIt);", ['unclassifiedCandidate']],
  ])('限定条件に合わないfactoryと非call参照を拒否する: %s', (source, expected) => {
    expect(codes(source)).toEqual(expected);
  });
  it('直接のrunIf/skipIfのcurried宣言はfactory候補として除外しない', () => {
    const source = "if (has('a')) it.runIf(true)('case a', () => {}); if (has('b')) test.skipIf(false)('case b', () => {});";
    const result = inventoryDeclarations(source, file);
    expect(result.errors).toEqual([]);
    expect(result.nonCall).toEqual([]);
    expect(result.declarations).toHaveLength(2);
    expect(result.expandedRows).toBe(2);
    expect(registration(source, { a: [], b: [] })).toEqual([]);
  });
  it.each(['[1, 2] as const', '[1, 2] satisfies number[]', '([1, 2])', '[1, 2]!', '(([1, 2] as const) satisfies readonly number[])!'])('型だけのwrapper内のliteral表を実行せず数える: %s', (table) => {
    const result = inventoryDeclarations(`it.each(${table})('case %j', () => {});`, file);
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(1);
    expect(result.declarations[0].rows).toBe(2);
    expect(result.expandedRows).toBe(2);
  });
  it.each(['rows as const', '(rows satisfies number[])!', '([1, ...rows] as const)', 'makeRows() as number[]'])('wrapperを外しても変数・spread・呼出しの行数を推測しない: %s', (table) => {
    const result = inventoryDeclarations(`it.each(${table})('case %j', () => {});`, file);
    expect(result.errors.map((error: { code: string }) => error.code)).toEqual(['dynamicRows']);
    expect(result.declarations).toHaveLength(1);
    expect(result.declarations[0].rows).toBeUndefined();
    expect(result.expandedRows).toBeUndefined();
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
      expect(checkPartitionWiring(path, source)).toEqual([]);
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


describe('行単位の登録宣言', () => {
  const imported = "import { eachRows } from './helpers/partition-part.js';";
  const rows = (name = 'it', table = "['x', 'y']", ids = "['a', 'b']") => `{ const ${name} = eachRows(has, ${ids}); ${name}.each(${table})('row %j', () => {}); }`;
  const allCodes = (source: string, cases = { a: [], b: [] } as Record<string, string[]>) => ({
    inventory: [...new Set(codes(source))].sort(), registration: [...new Set(registration(source, cases))].sort(),
  });
  it.each(['it', 'test'])('bareBlockの%s束縛と元call/表の位置を保つ', (name) => {
    const source = imported + rows(name);
    const result = inventoryDeclarations(source, file);
    expect(result.errors).toEqual([]);
    expect(result.nonCall).toEqual([{ start: source.indexOf(`${name} =`), line: 1, kind: 'rowBinding' }]);
    expect(result.declarations.map((item: { text: string; rows: number | undefined; rowIds?: string[]; rowTexts?: string[] }) => ({ text: item.text, rows: item.rows, ids: item.rowIds, texts: item.rowTexts }))).toEqual([
      { text: `${name}.each(['x', 'y'])('row %j', () => {})`, rows: 2, ids: ['a', 'b'], texts: ["'x'", "'y'"] },
    ]);
    expect(result.expandedRows).toBe(2);
    expect(registration(source, { a: ['linux'], b: [] })).toEqual([]);
  });
  it.each(["(['x', 'y'] as const)", "['x', 'y'] satisfies string[]", "[[1, -2], [true, null]]", "[{ value: 'x' }, { value: 'y' }]"])(
    '型wrapperとliteralな全表を評価せず照合する: %s', (table) => {
      const source = imported + rows('it', table);
      expect(codes(source)).toEqual([]); expect(registration(source, { a: ['linux'], b: [] })).toEqual([]);
      expect(inventoryDeclarations(source, file).expandedRows).toBe(2);
    },
  );
  it('describe内で従来の直接宣言・表全体ID・factoryと共存する', () => {
    const source = imported + `const posixIt = it.runIf(conditionMustNotRun()); if (hasAny(['a','b','c','d','e'])) describe('group', () => { ${rows()} if (has('c')) it('direct', () => {}); if (has('d')) it.each([1,2])('table %j', () => {}); if (has('e')) posixIt('factory', () => {}); });`;
    expect(codes(source)).toEqual([]); expect(registration(source, { a: ['linux'], b: [], c: [], d: [], e: [] })).toEqual([]);
    expect(inventoryDeclarations(source, file).expandedRows).toBe(6);
  });
  it.each([
    ['length', rows('it', "['x']"), ['rowIdsMismatch'], ['rowIdsMismatch']],
    ['dynamic ids', rows('it', "['x','y']", 'ids'), ['dynamicGuard'], ['dynamicGuard','missingId']],
    ['spread ids', rows('it', "['x','y']", "['a',...ids]"), ['dynamicGuard'], ['dynamicGuard','missingId']],
    ['variable table', rows('it', 'table'), ['dynamicRows','rowIdsMismatch','unsupportedRowForm'], ['rowIdsMismatch','unsupportedRowForm']],
    ['spread table', rows('it', "['x',...table]"), ['dynamicRows','rowIdsMismatch','unsupportedRowForm'], ['rowIdsMismatch','unsupportedRowForm']],
    ['call row', rows('it', "['x',tmpdir()]"), ['unsupportedRowForm'], ['unsupportedRowForm']],
    ['duplicate ids', rows('it', "['x','y']", "['a','a']"), [], ['duplicateId','missingId']],
    ['unknown ids', rows('it', "['x','y']", "['a','unknown']"), [], ['missingId','unknownId']],
    ['invalid ids', rows('it', "['x','y']", "['a','Bad_ID']"), [], ['invalidId','missingId','unknownId']],
  ])('行境界の診断集合を保つ: %s', (_, body, inventory, registered) => {
    expect(allCodes(imported + body)).toEqual({ inventory: [...inventory].sort(), registration: [...registered].sort() });
  });
  it.each([
    ['let', rows().replace('const it', 'let it')],
    ['export', rows().replace('const it', 'export const it')],
    ['extra statement', rows().replace("; it.each", "; const extra = 1; it.each")],
    ['extra reference', rows('it', "['x','y']").replace('() => {}', '() => { fn(it); }')],
    ['conditional block', `if (enabled) ${rows()}`],
    ['ordinary function', `function register() { ${rows()} }`],
    ['loop', `for (;;) ${rows()}`],
    ['wrong has', rows().replace('eachRows(has,', 'eachRows(other,')],
    ['factory', rows('posixIt')],
    ['runIf', rows().replace('it.each(', 'it.runIf(true).each(')],
    ['tagged', rows().replace("it.each(['x', 'y'])", "it.each`value\n${1}\n${2}`")],
    ['for', rows().replace('it.each(', 'it.for(')],
    ['local function', rows().replace('eachRows(has,', 'otherRows(has,')],
    ['missing import', rows()],
  ])('対応形外は通常helperとして通さない: %s', (label, body) => {
    const source = (label === 'missing import' ? '' : imported) + body;
    const inventory = label === 'factory' ? ['unsupportedRowForm'] : ['shadowedTest', 'unclassifiedCandidate', ...(label === 'local function' ? [] : ['unsupportedRowForm'])];
    const registered = ['missingId', 'unprefixed', ...(label === 'local function' ? [] : ['unsupportedRowForm'])];
    expect(allCodes(source)).toEqual({ inventory, registration: registered });
  });
  it.each(["const it = foo();", "const test = () => {};", "const test = it;"])('it/testの通常変数を拒否する: %s', (source) => {
    expect([...new Set(codes(source))].sort()).toEqual([...(source === 'const test = it;' ? ['alias'] : []), 'shadowedTest', 'unclassifiedCandidate']);
  });
  it.each([
    "import type { eachRows } from './helpers/partition-part.js';",
    "import { type eachRows } from './helpers/partition-part.js';",
    "import { eachRows } from './helpers/other.js';",
  ])('実行時のhelper import binding以外は行登録にしない: %s', (header) => {
    expect(codes(header + rows())).toContain('unsupportedRowForm');
    expect(registration(header + rows(), { a: [], b: [] })).toContain('unsupportedRowForm');
  });
  it.each(["[{ value: callMustNotRun() }, 'y']", "[[...values], 'y']", "[{ ...values }, 'y']", "[{ [key]: 1 }, 'y']", "[{ value }, 'y']"])(
    '表の中の動的な式を実行/推測しない: %s', (table) => {
      expect(codes(imported + rows('it', table))).toContain('unsupportedRowForm');
      expect(registration(imported + rows('it', table), { a: [], b: [] })).toContain('unsupportedRowForm');
    },
  );
  it.each([
    ["import { eachRows as select } from './helpers/partition-part.js';", 'select(has,'],
    [imported, 'eachRows.call(null, has,'],
    ["import * as parts from './helpers/partition-part.js';", 'parts.eachRows(has,'],
  ])('helperの別名・namespace・call経由を対応形に含めない: %s', (header, initializer) => {
    const source = header + rows().replace('eachRows(has,', initializer);
    expect(allCodes(source)).toEqual({ inventory: ['shadowedTest', 'unclassifiedCandidate', 'unsupportedRowForm'], registration: ['missingId', 'unprefixed', 'unsupportedRowForm'] });
  });
  it('parameterized describe内を行登録として受理しない', () => {
    const source = imported + `describe.each([1,2])('group %j', () => { ${rows()} });`;
    expect(codes(source)).toContain('unsupportedRowForm');
    expect(registration(source, { a: [], b: [] })).toContain('unsupportedRowForm');
  });
  it('行IDもfile全体の重複・欠測とdescribe guardへ展開する', () => {
    const wrapped = imported + `if (hasAny(['a','b'])) describe('group', () => { ${rows()} });`;
    expect(registration(wrapped, { a: ['linux'], b: [] })).toEqual([]);
    expect(registration(wrapped.replace("hasAny(['a','b'])", "hasAny(['a'])"), { a: ['linux'], b: [] })).toEqual(['guardMismatch']);
    expect(registration(imported + rows() + declared(), { a: [], b: [] })).toEqual(['duplicateId']);
    expect(registration(imported + rows(), { a: [], b: [], c: [] })).toEqual(['missingId']);
  });
});


// ROW-BOUNDARY: Q-91〜Q-93。元335行の正負期待は上にそのまま残す。
import { lstatSync } from 'node:fs';

describe('行登録の閉じた import と祖先', () => {
  const row = "{ const it = eachRows(has, ['a','b']); it.each(['x','y'])('row %s', () => {}); }";
  const header = "import { eachRows } from './helpers/partition-part.js';";
  const cases = { a: [], b: [] };
  const inventoryRejected = ['shadowedTest', 'unclassifiedCandidate', 'unsupportedRowForm'];
  const registrationRejected = ['missingId', 'unprefixed', 'unsupportedRowForm'];
  const both = (source: string, path = file, ids: Record<string, string[]> = cases) => ({
    inventory: [...new Set(inventoryDeclarations(source, path).errors.map((error: { code: string }) => error.code))].sort(),
    registration: [...new Set(checkRegistration(path, source, ids).map((error: { code: string }) => error.code))].sort(),
  });
  const grouped = (body = row) => `if(hasAny(['a','b'])) describe('g', () => { ${body} });`;

  it.each([
    ['tests/sub/x.test.ts', '../helpers/partition-part.js'],
    ['packages/runner/test/x.test.ts', '../../../tests/helpers/partition-part.js'],
  ])('P1/P2: sourceの階層からcanonical helperを一意に照合する: %s', (path, specifier) => {
    const source = `import { eachRows } from '${specifier}';` + row;
    expect(both(source, path)).toEqual({ inventory: [], registration: [] });
    const inventory = inventoryDeclarations(source, path);
    expect(inventory.nonCall.filter((item: { kind: string }) => item.kind === 'rowBinding')).toHaveLength(1);
    expect(inventory.expandedRows).toBe(2);
  });
  it('P3/P4: plainな入れ子describeとvitest named importを受理する', () => {
    for (const source of [
      header + grouped(`describe('inner', function () { ${row} });`),
      "import { describe } from 'vitest';" + header + grouped(),
    ]) expect(both(source)).toEqual({ inventory: [], registration: [] });
  });
  it.each([
    './wrong/partition-part.js', 'untrusted/partition-part.js',
    './helpers/partition-part.ts', './helpers/partition-part',
    './helpers/../helpers/partition-part.js', './helpers/partition-part.js?x',
    './helpers/partition-part.js#x', '/tests/helpers/partition-part.js',
  ])('N1/N2: canonicalでないhelperをordinary helperへ落とさない: %s', (specifier) => {
    expect(both(`import { eachRows } from '${specifier}';` + row)).toEqual({ inventory: inventoryRejected, registration: registrationRejected });
  });
  it.each(['/tests/fixture.test.ts', '../tests/fixture.test.ts', 'tests/../tests/fixture.test.ts', 'C:/tests/fixture.test.ts'])('絶対pathと..を含むsource fileを受理しない: %s', (path) => {
    expect(both(header + row, path)).toEqual({ inventory: inventoryRejected, registration: registrationRejected });
  });
  it.each([
    ['for', `for (const n of [1,2]) { ${grouped()} }`],
    ['while', `while (flag) { ${grouped()} }`],
    ['do', `do { ${grouped()} } while (flag);`],
    ['other if', `if (flag) { ${grouped()} }`],
    ['false if', `if (false) { ${grouped()} }`],
    ['function', `function register() { ${grouped()} }`],
    ['class', `class Container { register() { ${grouped()} } }`],
    ['try', `try { ${grouped()} } catch {}`],
    ['switch', `switch (flag) { case true: ${grouped()} break; }`],
    ['label', `label: { ${grouped()} }`],
  ])('N3: describeの外側まで閉じた祖先を要求する: %s', (_, body) => {
    expect(both(header + body)).toEqual({ inventory: inventoryRejected, registration: ['guardMismatch', ...registrationRejected] });
  });
  it('N3: else付きifはguardにせず行登録を拒否する', () => {
    for (const body of [
      `if(hasAny(['a','b'])) describe('g', () => { ${row} }); else other();`,
      `if(hasAny(['a','b'])) { describe('g', () => { ${row} }); } else other();`,
    ]) {
      const source = header + body;
      expect(both(source)).toEqual({ inventory: inventoryRejected, registration: ['missingId', 'unguardedDescribe', 'unprefixed', 'unsupportedRowForm'] });
      const inventory = inventoryDeclarations(source, file);
      expect(inventory.errors.filter((error: { code: string }) => error.code === 'unsupportedRowForm').map((error: { message: string }) => error.message)).toEqual(['行単位の登録の構造を検査できません']);
      expect(inventory.nonCall.filter((item: { kind: string }) => item.kind === 'rowBinding')).toHaveLength(0);
      expect(both(source.replace('else other();', ''))).toEqual({ inventory: [], registration: [] });
    }
  });
  it.each([
    ['local', `const describe=()=>{}; ${grouped()}`],
    ['foreign', `import { describe } from './x.js'; ${grouped()}`],
    ['skip', grouped().replace("describe('g'", "describe.skip('g'")],
    ['only', grouped().replace("describe('g'", "describe.only('g'")],
    ['concurrent', grouped().replace("describe('g'", "describe.concurrent('g'")],
  ])('N4: 偽束縛と装飾describeを拒否する: %s', (_, body) => {
    expect(both(header + body)).toEqual({ inventory: inventoryRejected, registration: ['guardMismatch', ...registrationRejected] });
  });
  it('N4: it callbackに入れたdescribeも行登録の祖先にしない', () => {
    const source = header + `if(has('outer')) it('container', () => { ${grouped()} });`;
    expect(both(source, file, { ...cases, outer: [] })).toEqual({ inventory: inventoryRejected, registration: ['guardMismatch', ...registrationRejected] });
  });
  it('N5: 空IDsを実helperと同じ非空境界で拒否する', () => {
    const source = header + "{ const it=eachRows(has,[]); it.each([])('empty %s',()=>{}); } if(has('a')) it('ordinary',()=>{});";
    expect(both(source, file, { a: [] })).toEqual({ inventory: ['unsupportedRowForm'], registration: ['unsupportedRowForm'] });
    expect(inventoryDeclarations(source, file).errors.map((error: { message: string }) => error.message)).toEqual(['行単位の登録には1件以上の行が必要です']);
  });
  it('非空IDsと空表の既存rowIdsMismatchを変えない', () => {
    const source = header + row.replace("['x','y']", '[]');
    expect(both(source)).toEqual({ inventory: ['rowIdsMismatch'], registration: ['rowIdsMismatch'] });
  });
  it('実registryが空でもcanonical helper自体は通常fileでsymlinkではない', () => {
    const helper = lstatSync('tests/helpers/partition-part.ts');
    expect(helper.isFile()).toBe(true);
    expect(helper.isSymbolicLink()).toBe(false);
  });
});



describe('正規 partition wiring の独立検査', () => {
  const file = 'tests/x.test.ts';
  const header = (file = 'tests/x.test.ts', root = '..', helper = './helpers/partition-part.js', partition = '../scripts/lib/test-partition.mjs') => `import {it,describe} from 'vitest';
import {join} from 'node:path';
import {includeCase,loadPartition} from '${partition}';
import {currentPart,eachRows} from '${helper}';
const registry=loadPartition(join(import.meta.dirname,'${root}'));
const has=(id: string)=>includeCase(registry,'${file}',currentPart(),id);
const hasAny=(ids: readonly string[])=>ids.some(has);
`;
  const row = "{const it=eachRows(has,['a','b']);it.each(['x','y'])('row %s',()=>{});}";
  const tail = `if(hasAny(['a','b'])) describe('rows',()=>{${row}});`;
  const source = header()+tail;
  const codes = (errors: {code: string}[]) => [...new Set(errors.map(e=>e.code))].sort();
  const observe = (id: string, input: string, path = file) => ({id, inventory: inventoryDeclarations(input, path).errors, registration: checkRegistration(path, input, {a:[],b:['linux']}), wiring: checkPartitionWiring(path,input)});
  const check = (id: string, input: string, expected: string[], path = file) => {
    const {inventory,registration,wiring}=observe(id,input,path);
    expect(codes(wiring)).toEqual([...expected].sort());
    if (id === 'I3' || id.startsWith('H1')) {
      expect(inventory).toEqual([]); expect(registration).toEqual([]);
    }
  };
  const positives: [string,string,string][] = [
    ['A1',source,file],
    ['A2',header().replace(/const hasAny=.*;\n/,'')+row,file],
    ['A3',header('packages/runner/test/x.test.ts','../../..','../../../tests/helpers/partition-part.js','../../../scripts/lib/test-partition.mjs')+tail,'packages/runner/test/x.test.ts'],
    ['A4',header('tests/sub/x.test.ts','../..','../helpers/partition-part.js','../../scripts/lib/test-partition.mjs')+tail,'tests/sub/x.test.ts'],
    ['A5',source.replace('(id: string)','id'),file],
    ['A6',header().replace('currentPart,eachRows','currentPart')+"if(has('a')) it('direct',()=>{});",file],
    ['A7',source.replace('{join}', '{dirname,join}')+"join('a','b');",file],
    ['A8',source+"vi.mock('x'); const map=new Map();map.has('a');",file],
  ];
  it.each(positives)('%s のheaderを受理する', (id,input,path) => check(id,input,[],path));
  const variants: [string,string,string[]][] = [];
  for (const [name,line] of [['partition',"import {includeCase,loadPartition} from '../scripts/lib/test-partition.mjs';\n"],['helper',"import {currentPart,eachRows} from './helpers/partition-part.js';\n"],['join',"import {join} from 'node:path';\n"]]) variants.push(['I1-'+name,source.replace(line!,''),['wiringImport']]);
  for (const [from,to] of [['../scripts/lib/test-partition.mjs','test-partition.mjs'],['./helpers/partition-part.js','./helpers/partition-part.ts'],['./helpers/partition-part.js','./helpers/partition-part.js?x'],['./helpers/partition-part.js','../tests/helpers/partition-part.js'],['node:path','path']]) variants.push(['I2-'+to,source.replace(from!,to!),['wiringImport']]);
  variants.push(
    ['I3',source.replace('includeCase,loadPartition','includeCase as real,loadPartition').replace('const registry','const includeCase=()=>true;\nconst registry'),['wiringImport','wiringHeader']],
    ['I4-declaration',source.replace('import {currentPart','import type {currentPart'),['wiringImport']],
    ['I4-specifier',source.replace('{currentPart,','{type currentPart,'),['wiringImport']],
    ['I5-namespace',source.replace("import {currentPart,eachRows}","import * as helper"),['wiringImport']],
    ['I5-default',source.replace("import {join}","import join"),['wiringImport']],
    ['I5-duplicate',source.replace("import {join} from 'node:path';","import {join} from 'node:path';import {dirname} from 'node:path';"),['wiringImport']],
    ['I6',source.replace('currentPart,eachRows','currentPart,eachRows,setPart'),['wiringImport']],
    ['H1-zero',source.replace('(id: string)=>includeCase(registry,\'tests/x.test.ts\',currentPart(),id)','()=>true'),['wiringHeader']],
    ['H1-id',source.replace("includeCase(registry,'tests/x.test.ts',currentPart(),id)",'true'),['wiringHeader']],
    ['H2-FILE',source.replace("'tests/x.test.ts',currentPart()","FILE,currentPart()"),['wiringHeader']],
    ['H2-file',source.replace("'tests/x.test.ts'","'tests/y.test.ts'"),['wiringHeader']],
    ['H3',source.replace('const registry','const part=currentPart();\nconst registry').replace(",currentPart(),id)",",part,id)"),['wiringHeader']],
    ['H4',source.replace('currentPart(),id)','currentPart(),id,\'linux\')'),['wiringHeader']],
    ['H5-root',source.replace("join(import.meta.dirname,'..')","import.meta.dirname+'/..'"),['wiringHeader']],
    ['H5-depth',source.replace("dirname,'..'","dirname,'../..'"),['wiringHeader']],
    ['H5-cwd',source.replace("join(import.meta.dirname,'..')","process.cwd()"),['wiringHeader']],
    ['H6-let',source.replace('const has=','let has='),['wiringHeader']],
    ['H6-export',source.replace('const has=','export const has='),['wiringHeader']],
    ['H6-multiple',source.replace('const has=','const other=1,has='),['wiringHeader']],
    ['H6-wrapper',source.replace("const has=(id: string)=>includeCase(registry,'tests/x.test.ts',currentPart(),id);","const has=((id: string)=>includeCase(registry,'tests/x.test.ts',currentPart(),id));"),['wiringHeader']],
    ['H7-gap',source.replace('const registry','0;const registry'),['wiringHeader']],
    ['H7-order',source.replace(/(const registry=.*;\n)(const has=.*;\n)/,'$2$1'),['wiringHeader']],
    ['H7-import',source+"import {expect} from 'vitest';",['wiringHeader']],
    ['H8-block',source.replace("=>includeCase(registry,'tests/x.test.ts',currentPart(),id)","=>{return includeCase(registry,'tests/x.test.ts',currentPart(),id)}"),['wiringHeader']],
    ['H8-async',source.replace('(id: string)=>','async (id: string)=>'),['wiringHeader']],
    ['H8-default',source.replace('(id: string)','(id=\'a\')'),['wiringHeader']],
    ['H8-rest',source.replace('(id: string)','(...id)'),['wiringHeader']],
    ['H8-destructure',source.replace('(id: string)','({id})'),['wiringHeader']],
    ['H9-arrow',source.replace('ids.some(has)','ids.some(id=>has(id))'),['wiringHeader']],
    ['H9-every',source.replace('ids.some(has)','ids.every(has)'),['wiringHeader']],
    ['H9-args',source.replace('ids.some(has)','ids.some(has,0)'),['wiringHeader']],
    ['B1',header()+`describe('shadow',()=>{const has=()=>true;if(has('a')) it('a',()=>{});});`,['wiringBinding']],
    ['B2',source+"fn((has)=>has('a'));",['wiringBinding']],
    ['B3-argument',source+'fn(has);',['wiringBinding']],
    ['B3-shorthand',source+'({has});',['wiringBinding']],
    ['B3-property',source+'has.call(null,\'a\');',['wiringBinding']],
    ['B3-alias',source+'const h=has;',['wiringBinding']],
    ['B3-unimported-row',source.replace('currentPart,eachRows','currentPart'),['wiringBinding']],
    ['B4-assign',source+'has=x;',['wiringBinding']],
    ['B4-mutate',source+'registry.files={};',['wiringBinding']],
    ['B5',source.replace(/const hasAny=.*;\n/,''),['wiringBinding']],
    ['B6',source+'currentPart();',['wiringBinding']],
    ['S1',source+'const = ;',['syntax']],
  );
  it.each(variants)('%s を設計の診断集合で拒否する', (id,input,expected) => check(id,input,expected));
  it.each(['/tests/x.test.ts','tests/../x.test.ts'])('I7 %s を拒否する',path=>check('I7',source,['wiringImport'],path));
  const nonvalues = [
    ['label-break', 'NAME: {break NAME;}', false],
    ['label-continue', 'NAME: while(false){continue NAME;}', false],
    ['import-origin', "import {NAME as importedValue} from './other.js';", true],
    ['binding-key', 'const {NAME: extracted}=object;', false],
    ['export-alias', 'const value=1;export {value as NAME};', false],
    ['re-export-origin', "export {NAME as external} from './other.js';", false],
    ['re-export-alias', "export {other as NAME} from './other.js';", false],
    ['type-export', 'export type {NAME};', false],
    ['interface-method', 'interface Shape {NAME():boolean;}', false],
    ['interface-property', 'interface Shape {NAME:boolean;}', false],
    ['type-member', 'type Shape={NAME():boolean};', false],
    ['getter-name', 'const object={get NAME(){return true;}};', false],
    ['setter-name', 'const object={set NAME(value){void value;}};', false],
    ['enum-member', 'enum Flags {NAME=1}', false],
  ] as const;
  const nonvalueCases = nonvalues.flatMap(([id,snippet,prefix]) => ['has','hasAny'].map(name => [id+'-'+name, prefix ? snippet.replaceAll('NAME',name)+source : source+snippet.replaceAll('NAME',name)] as const));
  it.each(nonvalueCases)('M1 %s の非value名を受理する', (id,input) => check('M1-'+id,input,[]));
  const realReferences = [
    ['export-local-alias', 'export {NAME as leaked};'],
    ['export-local-direct', 'export {NAME};'],
    ['getter-body', 'const object={get NAME(){return NAME;}};'],
    ['setter-body', 'const object={set NAME(value){const alias=NAME;}};'],
    ['enum-initializer', 'enum Flags {value=Number(NAME)}'],
    ['computed-key', 'const object={[NAME]:true};'],
    ['interface-computed-key', 'interface Shape {[NAME]:boolean;}'],
  ];
  const realReferenceCases = realReferences.flatMap(([id,snippet]) => ['has','hasAny'].map(name => [id+'-'+name, source+snippet!.replaceAll('NAME',name)] as const));
  it.each(realReferenceCases)('M1 %s の実値参照を拒否する', (id,input) => check('M1-value-'+id,input,['wiringBinding']));
  it('matrixで旧2APIの結果も観測する', () => {
    const observations = [...positives.map(([id,input,path])=>observe(id,input,path)),...variants.map(([id,input])=>observe(id,input)),...['/tests/x.test.ts','tests/../x.test.ts'].map(path=>observe('I7',source,path)),...nonvalueCases.map(([id,input])=>observe('M1-'+id,input)),...realReferenceCases.map(([id,input])=>observe('M1-value-'+id,input))];
    expect(observations.length).toBeGreaterThan(40);
  });
});

describe('partition wiring class expression names', () => {
  const path = 'tests/x.test.ts';
  const header = `import {it,describe} from 'vitest';
import {join} from 'node:path';
import {includeCase,loadPartition} from '../scripts/lib/test-partition.mjs';
import {currentPart,eachRows} from './helpers/partition-part.js';
const registry=loadPartition(join(import.meta.dirname,'..'));
const has=(id: string)=>includeCase(registry,'tests/x.test.ts',currentPart(),id);
const hasAny=(ids: readonly string[])=>ids.some(has);
`;
  it.each(['has', 'hasAny'])('accepts %s as a class expression declaration name', (name) => {
    expect(checkPartitionWiring(path, header + `const C=class ${name} {};`)).toEqual([]);
  });
  const references = ['static value = NAME;', '[NAME]() {}', 'method() { return NAME; }'];
  const cases = ['has', 'hasAny'].flatMap(name => references.map(body => [name, body] as const));
  it.each(cases)('rejects real %s references in a named class body: %s', (name, body) => {
    const source = header + `const C=class ${name} {\n${body.replaceAll('NAME', name)}\n};`;
    const errors = checkPartitionWiring(path, source);
    expect(errors.map((error: { code: string }) => error.code)).toEqual(['wiringBinding']);
    expect(errors[0]?.line).toBe(header.split('\n').length + 1);
  });
  it.each(['has', 'hasAny'])('rejects calls resolved to the inner %s class name', (name) => {
    const argument = name === 'has' ? "'a'" : "['a']";
    const source = header + `const C=class ${name} {\nstatic value = ${name}(${argument});\n};`;
    const errors = checkPartitionWiring(path, source);
    expect(errors.map((error: { code: string }) => error.code)).toEqual(['wiringBinding']);
    expect(errors[0]?.line).toBe(header.split('\n').length + 1);
  });
});
