import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { inventoryDeclarations, checkRegistration, checkPartitionWiring } from '../scripts/lib/test-declarations.mjs';
import { expectedRowMarkers, expectedRowNames, mixedSlowIds, rowIds, type RowReport } from './helpers/partition-rows-fixture.js';
import { canonicalCalls, canonicalWiringSource, directCall, nonliteralCall, partitionWiringFixture, type WiringMarker } from './helpers/partition-wiring-fixture.js';

const counted = (values: readonly unknown[]) => values.map(value => JSON.stringify(value)).sort();
const rows = (report: RowReport | undefined) => report?.testResults.flatMap(file => file.assertionResults.map(({ fullName, status }) => ({ fullName, status }))) ?? [];
const names = [...expectedRowNames.filter(name => !name.startsWith('rows mixed ')), 'direct a'];
const markers: readonly WiringMarker[] = [...expectedRowMarkers.filter(marker => marker.group !== 'R2mixed'), {group:'direct',idx:0,value:'a',argc:0}];
const ids = [...rowIds.filter(id => !['r2-empty','r2-value'].includes(id)), 'direct-a'];
const mixed = [...mixedSlowIds.filter(id => id !== 'r2-empty'), 'direct-a'];
const staticCheck = (result: ReturnType<ReturnType<typeof partitionWiringFixture>['run']>) => {
  const cases = Object.fromEntries(result.ids.map(id => [id, mixed.includes(id) ? [process.platform] : []]));
  expect(inventoryDeclarations(result.source,result.file).errors).toEqual([]);
  expect(checkRegistration(result.file,result.source,cases)).toEqual([]);
  expect(checkPartitionWiring(result.file,result.source)).toEqual([]);
};

describe('正規sourceとnativeの配線対照', () => {
  it('旧11callとのbyte/集合対応と非literal EMPTYの拒否を保持する', () => {
    const old = readFileSync(join(import.meta.dirname,'helpers/partition-rows-fixture.ts'),'utf8');
    const oldCalls = JSON.parse(old.split('const calls = ')[1]!.split('] as const;')[0]!+']') as {ids:string[];call:string}[];
    expect(oldCalls).toHaveLength(11);
    expect(counted(canonicalCalls)).toEqual(counted(oldCalls.filter(call => !call.ids.includes('r2-empty'))));
    for (const call of canonicalCalls) expect(old).toContain('"call": '+JSON.stringify(call.call));
    expect(canonicalCalls.filter(call=>call.group==='success').flatMap(call=>call.ids)).toHaveLength(14);
    const {source} = canonicalWiringSource('tests/canonical.test.ts',[nonliteralCall],'marker');
    for (const errors of [inventoryDeclarations(source,'tests/canonical.test.ts').errors,checkRegistration('tests/canonical.test.ts',source,{'r2-empty':[],'r2-value':[],'direct-a':[]})]) expect(errors.map((error:{code:string})=>error.code)).toContain('unsupportedRowForm');
  });
  it('正規headerの14行＋directをnativeと全fast/混在/全slowの各fileで照合する', () => {
    const fixture = partitionWiringFixture();
    try {
      const native=fixture.run({native:true});
      expect(native.status,native.stdout+native.stderr).toBe(0);expect(native.signal).toBeNull();
      expect(rows(native.report)).toEqual(names.map(fullName=>({fullName,status:'passed'})));
      expect(native.markers).toEqual(markers);
      const calls=native.source.split('\n').filter(line=>line.startsWith('it.each('));
      expect(native.source).toContain(directCall);
      for(const slowIds of [[],mixed,ids]) {
        const routed=fixture.run({slowIds});staticCheck(routed);
        expect(routed.status,routed.stdout+routed.stderr).toBe(0);expect(routed.signal).toBeNull();
        expect(counted(rows(routed.report))).toEqual(counted(rows(native.report)));
        expect(counted(routed.markers)).toEqual(counted(markers));
        expect(routed.source.split('\n').filter(line=>line.startsWith('it.each('))).toEqual(calls);
        expect(routed.source).toContain(directCall);
        for (const slow of [false,true]) {
          const actual=routed.report!.testResults.filter(file=>file.name.endsWith(slow?'canonical.slow.test.ts':'canonical.test.ts')).flatMap(file=>file.assertionResults.map(row=>row.fullName));
          const expected=names.filter((_,index)=>slowIds.includes(ids[index]!)===slow);
          expect(counted(actual)).toEqual(counted(expected));
        }
        expect(readFileSync(join(routed.receipt,'source.ts'),'utf8')).toBe(routed.source);
        expect(JSON.parse(readFileSync(join(routed.receipt,'process.json'),'utf8')).status).toBe(0);
      }
    } finally {fixture.cleanup();}
  },120000);
  it('元numeric/options 80msとthrowの失敗をnative/routed双方で保つ', () => {
    const fixture=partitionWiringFixture();
    try {
      for(const group of ['timeout','error'] as const) {
        const native=fixture.run({group,native:true});const routed=fixture.run({group,slowIds:group==='timeout'?['num-late','opt-late']:['err-boom']});staticCheck(routed);
        expect([native.status,routed.status]).toEqual([1,1]);expect([native.signal,routed.signal]).toEqual([null,null]);
        expect(counted(rows(routed.report))).toEqual(counted(rows(native.report)));
        expect(routed.source.split('\n').filter(line=>line.startsWith('it.each('))).toEqual(native.source.split('\n').filter(line=>line.startsWith('it.each(')));
        for(const result of [native,routed]) {
          const failures=result.report!.testResults.flatMap(file=>file.assertionResults).filter(row=>row.status==='failed');
          expect(failures).toHaveLength(group==='timeout'?2:1);
          for(const failure of failures) expect(failure.failureMessages.join('\n')).toContain(group==='timeout'?'80ms':'row boom');
        }
      }
    } finally {fixture.cleanup();}
  },120000);
  it('偽has H1と内側の影B1を拒否しnativeで2倍登録を独立観測する', () => {
    const fixture=partitionWiringFixture();
    try {
      const native=fixture.run({native:true});expect(native.status).toBe(0);
      for(const negative of ['falseHas','shadow'] as const) {
        const routed=fixture.run({slowIds:mixed,negative});
        expect([...new Set(checkPartitionWiring(routed.file,routed.source).map((error:{code:string})=>error.code))]).toEqual([negative==='falseHas'?'wiringHeader':'wiringBinding']);
        expect(routed.status,routed.stdout+routed.stderr).toBe(0);expect(routed.signal).toBeNull();
        expect(counted(rows(routed.report))).toEqual(counted([...rows(native.report),...rows(native.report)]));
        expect(counted(routed.markers)).toEqual(counted([...markers,...markers]));
        for(const file of routed.report!.testResults) expect(counted(file.assertionResults.map(row=>row.fullName))).toEqual(counted(names));
      }
    } finally {fixture.cleanup();}
  },120000);
});

describe('配線の実値参照と生成sourceの境界', () => {
  const file = 'tests/canonical.test.ts';
  const source = canonicalWiringSource(file, canonicalCalls.filter(call => call.group === 'success'), 'marker').source;
  const wiringCodes = (extra: string) => [...new Set(checkPartitionWiring(file, source + extra).map((error: {code: string}) => error.code))];

  it.each([
    ['class-declaration', 'class X extends (registry.files = {}, Object) {}'],
    ['class-expression', 'const X=class extends (registry.files = {}, Object) {};'],
    ['extends-call', 'class X extends (currentPart(), Object) {}'],
    ['extends-alias', 'class X extends factory(has) {}'],
  ])('%s の継承式にある実値参照を拒否する', (_, extra) => {
    expect(wiringCodes(extra!)).toEqual(['wiringBinding']);
  });

  it.each([
    'interface Shape extends registry {}',
    'class X implements registry {}',
    'class X extends Base<typeof registry> {}',
    'interface Shape extends Base<typeof currentPart> {}',
  ])('型として消去される参照を受理する: %s', extra => {
    expect(wiringCodes(extra)).toEqual([]);
  });

  it.each(['registry', 'includeCase', 'loadPartition', 'currentPart', 'eachRows'])('%s の直接exportと別名exportを拒否し型exportを区別する', name => {
    expect(wiringCodes(`export {${name}};`)).toEqual(['wiringBinding']);
    expect(wiringCodes(`export {${name} as leaked};`)).toEqual(['wiringBinding']);
    expect(wiringCodes(`export type {${name}};`)).toEqual([]);
  });

  it.each(["tests/quote'name.test.ts", 'tests/back\\slash.test.ts', 'tests/line\nbreak.test.ts'])('生成headerのfileを単一の文字列値に保つ: %s', path => {
    const generated = canonicalWiringSource(path, [], 'marker').source;
    const ast = ts.createSourceFile(file, generated, ts.ScriptTarget.Latest, true);
    let target: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'includeCase') target = node.arguments[1];
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(target && ts.isStringLiteral(target)).toBe(true);
    expect((target as ts.StringLiteral).text).toBe(path);
    expect(inventoryDeclarations(generated, file).errors.filter((error: {code: string}) => error.code === 'syntax')).toEqual([]);
  });
});


describe('CodeQL の生成コード用リテラル', () => {
  it.each([
    "quote'\"value",
    'back\\slash',
    'line\r\nbreak\tend',
    'zero\0value',
    '</script><script>globalThis.injected=true</script>',
    'line\u2028separator',
    'paragraph\u2029separator',
  ])('file・marker・行IDの値を保ち、追加のコード境界を作らない: %s', value => {
    for (const mode of [undefined, 'native', 'falseHas', 'shadow'] as const) {
      const calls = [{ ...canonicalCalls[0]!, ids: [value] }];
      const generated = canonicalWiringSource(value, calls, value, mode).source;
      const ast = ts.createSourceFile('generated.ts', generated, ts.ScriptTarget.Latest, true);
      const literals: { name: string; text: string; value: string | string[] }[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          const position = name === 'includeCase' || name === 'eachRows' ? 1 : 0;
          if (['includeCase', 'appendFileSync', 'eachRows', 'hasAny'].includes(name)) {
            const argument = node.arguments[position]!;
            const decoded = ts.isStringLiteral(argument) ? argument.text : ts.isArrayLiteralExpression(argument) ? argument.elements.map(element => {
              expect(ts.isStringLiteral(element)).toBe(true);
              return (element as ts.StringLiteral).text;
            }) : undefined;
            expect(decoded).toBeDefined();
            literals.push({ name, text: argument.getText(ast), value: decoded! });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      const read = (name: string) => literals.filter(literal => literal.name === name).map(literal => literal.value);
      expect(read('includeCase')).toEqual(mode === 'native' || mode === 'falseHas' ? [] : [value]);
      expect(read('appendFileSync')).toEqual([value]);
      expect(read('eachRows')).toEqual(mode === 'native' ? [] : [[value]]);
      expect(read('hasAny')).toEqual(mode === 'native' ? [] : [[value]]);
      for (const literal of literals) expect(literal.text).not.toMatch(/[<>\u2028\u2029]/);
      expect(generated).not.toContain('</script>');
      expect(inventoryDeclarations(generated, 'generated.ts').errors.filter((error: {code: string}) => error.code === 'syntax')).toEqual([]);
    }
  });
});


describe('instantiation expression の実値と型の境界', () => {
  const file = 'tests/canonical.test.ts';
  const source = canonicalWiringSource(file, canonicalCalls.filter(call => call.group === 'success'), 'marker').source;
  const codes = (extra: string) => [...new Set(checkPartitionWiring(file, source + extra).map((error: {code: string}) => error.code))];

  it.each([
    'const h=has<string>;',
    'fn(has<never>);',
    'const p=currentPart<never>;',
    'export default registry<never>;',
    'class X extends (has<string>) {}',
    'fn(hasAny<string>);',
    'const factory=eachRows<string>;',
    'const loader=loadPartition<string>;',
    'const include=includeCase<string>;',
    'const list=[has<never>,currentPart<never>];',
  ])('instantiation expression の実値参照を拒否する: %s', extra => {
    expect(codes(extra)).toEqual(['wiringBinding']);
  });

  it.each([
    'type T=typeof has<string>;',
    'type T=typeof currentPart<never>;',
    'const factory=knownFactory<typeof has>;',
    'class X extends (knownFactory<typeof has>) {}',
    'interface X extends knownFactory<typeof registry> {}',
    'class X implements knownFactory<typeof currentPart> {}',
  ])('instantiation expression でも型として消去される参照を受理する: %s', extra => {
    expect(codes(extra)).toEqual([]);
  });
});


describe('legacy export helper と配線exportの分離', () => {
  it.each([
    'const withTest=()=>{}; export {withTest};',
    'const value=1; export {value as withTest};',
  ])('legacy export の未分類候補を旧APIのまま保持する: %s', source => {
    expect(inventoryDeclarations(source, 'tests/legacy.test.ts').errors.map((error: {code: string}) => error.code)).toEqual(['unclassifiedCandidate']);
    expect(checkRegistration('tests/legacy.test.ts', source, {})).toEqual([]);
  });

  it.each([
    'const withTest=()=>{}; fn(withTest);',
    'const withTest=()=>{}; const options={withTest};',
  ])('legacy export 修理後も通常helperの受理を保持する: %s', source => {
    expect(inventoryDeclarations(source, 'tests/legacy.test.ts').errors).toEqual([]);
    expect(checkRegistration('tests/legacy.test.ts', source, {})).toEqual([]);
  });

  it('legacy export の解決と独立して正規registryの流出を拒否する', () => {
    const file = 'tests/canonical.test.ts';
    const { source, ids } = canonicalWiringSource(file, canonicalCalls.filter(call => call.group === 'success'), 'marker');
    const cases = Object.fromEntries(ids.map(id => [id, []]));
    for (const extra of ['export {registry};', 'export {registry as leakedRegistry};']) {
      expect(inventoryDeclarations(source + extra, file).errors).toEqual([]);
      expect(checkRegistration(file, source + extra, cases)).toEqual([]);
      expect(checkPartitionWiring(file, source + extra).map((error: {code: string}) => error.code)).toEqual(['wiringBinding']);
    }
    expect(checkPartitionWiring(file, source + 'export type {registry};')).toEqual([]);
  });
});
