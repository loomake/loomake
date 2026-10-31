import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
