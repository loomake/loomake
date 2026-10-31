import { describe, expect, it } from 'vitest';
import { PartitionError } from '../scripts/lib/test-partition.mjs';
import { currentPart, eachRows, selectRows, setPart } from './helpers/partition-part.js';
import { expectedRowMarkers, expectedRowNames, mixedSlowIds, partitionRowsFixture, rowIds, type RowReport } from './helpers/partition-rows-fixture.js';

const rows = (report: RowReport | undefined) => report?.testResults.flatMap((file) => file.assertionResults.map(({ fullName, status }) => ({ fullName, status }))) ?? [];
const counted = (values: unknown[]) => values.map((value) => JSON.stringify(value)).sort();

describe('row partition helper', () => {
  it('partの共有入口はfastを既定にしmodule内で共有する', async () => {
    expect(currentPart()).toBe('fast');
    try { setPart('slow'); expect((await import('./helpers/partition-part.js')).currentPart()).toBe('slow'); }
    finally { setPart('fast'); }
  });
  it('元表・全表every・値参照と元index/array/thisArgを保つ', () => {
    const empty: unknown[] = []; const original = [empty, 'value']; const selected = selectRows(original, [true, false]);
    expect(selected).not.toBe(original); expect(selected).toHaveLength(2); expect(selected.every(Array.isArray)).toBe(false);
    expect(Object.hasOwn(original, 'forEach')).toBe(false); expect(original).toEqual([empty, 'value']);
    const receiver = {}; const observed: unknown[] = [];
    selected.forEach(function(this: object, value, index, array) { observed.push([this, value, index, array]); }, receiver);
    expect(observed).toEqual([[receiver, empty, 0, original]]); expect(selected[0]).toBe(empty);
    const none: unknown[] = []; selectRows(original, [false, false]).forEach((value) => none.push(value)); expect(none).toEqual([]);
    const indexes: number[] = []; selectRows(['a','b','c'], [false,true,true]).forEach((_, index) => indexes.push(index)); expect(indexes).toEqual([1,2]);
  });
  it('表長・重複ID・空IDと未知IDを収集前に拒否する', () => {
    expect(() => selectRows(['a'], [])).toThrow(PartitionError);
    expect(() => selectRows('a' as unknown as string[], [true])).toThrow(PartitionError);
    expect(() => eachRows(() => true, [])).toThrow(PartitionError);
    expect(() => eachRows(() => true, ['a','a'])).toThrow(PartitionError);
    expect(() => eachRows(() => { throw new PartitionError('unknown'); }, ['a'])).toThrow('unknown');
  });
  it('元callを固定したnative基準と全fast/混在/全slowの全行を比較する', () => {
    const fixture = partitionRowsFixture();
    try {
      const native = fixture.run({ native: true });
      expect(native.status, native.stdout + native.stderr).toBe(0); expect(native.signal).toBeNull();
      expect(rows(native.report)).toEqual(expectedRowNames.map((fullName) => ({ fullName, status: 'passed' })));
      expect(native.markers.map(({ group, idx, value, argc }) => ({ group, idx, value, argc }))).toEqual(expectedRowMarkers);
      const nativeCalls = native.source.split('\n').filter((line) => line.startsWith('it.each('));
      for (const slowIds of [[], mixedSlowIds, rowIds]) {
        const both = fixture.run({ slowIds });
        expect(both.status, both.stdout + both.stderr).toBe(0); expect(both.signal).toBeNull();
        expect(counted(rows(both.report))).toEqual(counted(rows(native.report)));
        expect(counted(both.markers.map(({ group, idx, value, argc }) => ({ group, idx, value, argc })))).toEqual(counted([...expectedRowMarkers]));
        expect(both.source.split('\n').filter((line) => line.startsWith('it.each('))).toEqual(nativeCalls);
      }
      const fast = fixture.run({ slowIds: mixedSlowIds, part: 'fast' });
      const slow = fixture.run({ slowIds: mixedSlowIds, part: 'slow' });
      expect([fast.status, slow.status]).toEqual([0,0]); expect(rows(fast.report)).toHaveLength(8); expect(rows(slow.report)).toHaveLength(8);
      expect(counted([...rows(fast.report), ...rows(slow.report)])).toEqual(counted(rows(native.report)));
      expect(fast.markers.find((marker) => marker.group === 'R3')?.value).toBe('x'); expect(slow.markers.find((marker) => marker.group === 'R3')?.value).toBe('y');
      const unknown = fixture.run({ slowIds: rowIds, part: 'fast', platform: 'unknown' });
      expect(unknown.status).toBe(0); expect(rows(unknown.report)).toEqual(rows(native.report));
    } finally { fixture.cleanup(); }
  }, 120000);
  it('数値/options timeoutとthrowの失敗を元のまま報告する', () => {
    const fixture = partitionRowsFixture();
    try {
      for (const group of ['timeout','error'] as const) {
        const native = fixture.run({ group, native: true });
        const routed = fixture.run({ group, slowIds: group === 'timeout' ? ['num-late','opt-late'] : ['err-boom'] });
        expect([native.status, routed.status]).toEqual([1,1]);
        expect(counted(rows(routed.report))).toEqual(counted(rows(native.report)));
        const failures = routed.report!.testResults.flatMap((file) => file.assertionResults).filter((test) => test.status === 'failed');
        expect(failures).toHaveLength(group === 'timeout' ? 2 : 1);
        for (const failed of failures) expect(failed.failureMessages.join('\n')).toContain(group === 'timeout' ? '80ms' : 'row boom');
      }
    } finally { fixture.cleanup(); }
  }, 120000);
  it('不正な長さ/二度使用/tagged/重複は実PartitionErrorで収集に失敗する', () => {
    const fixture = partitionRowsFixture();
    try {
      for (const invalid of ['length','double','tagged','duplicate'] as const) {
        const result = fixture.run({ part: 'fast', invalid });
        expect(result.status).toBe(1); expect(result.signal).toBeNull(); expect(rows(result.report)).toEqual([]); expect(result.markers).toEqual([]);
        expect(result.collectionError?.partitionError).toBe(true);
        expect(result.collectionError?.message).toContain(invalid === 'length' ? '表の行数と一致しません' : invalid === 'duplicate' ? '行IDは重複しない1件以上' : '配列の表で1回だけ');
      }
    } finally { fixture.cleanup(); }
  }, 120000);
});
