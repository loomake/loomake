import { describe, expect, it } from 'vitest';
import { assertNotPartitioned, companionOf, includeCase, partitionFiles, PartitionError, validatePartition } from '../scripts/lib/test-partition.mjs';

const file = 'tests/example.test.ts';
const registry = (cases: Record<string, string[]> = { mixed: ['win32'], everywhere: ['linux', 'darwin', 'win32'] }) => ({ files: { [file]: { cases } } });
const validate = (data: unknown) => validatePartition(data, { exists: () => true });

describe('共通の試験分割一覧', () => {
  it('空一覧では全ファイル選択を変えない', () => {
    expect(validate({ files: {} })).toEqual({ files: {} });
    expect(partitionFiles({ files: {} })).toEqual({ companions: [], fastExclude: [], slowInclude: [] });
  });

  it('登録順を保ちOS別にcaseとfileを射影し、未知実行OSはfastにする', () => {
    const r = validate(registry());
    expect(companionOf(file)).toBe('tests/example.slow.test.ts');
    for (const os of ['linux', 'darwin', 'win32', 'unknown']) {
      for (const id of ['mixed', 'everywhere']) {
        expect(Number(includeCase(r, file, 'fast', id, os)) + Number(includeCase(r, file, 'slow', id, os))).toBe(1);
      }
    }
    expect(partitionFiles(r, 'win32')).toEqual({ companions: [companionOf(file)], fastExclude: [file], slowInclude: [companionOf(file)] });
    expect(partitionFiles(r, 'linux')).toEqual({ companions: [companionOf(file)], fastExclude: [], slowInclude: [companionOf(file)] });
    expect(partitionFiles(r, 'unknown')).toEqual({ companions: [companionOf(file)], fastExclude: [], slowInclude: [] });
    expect(includeCase(r, file, 'fast', 'mixed', 'unknown')).toBe(true);
  });

  it.each([
    null, [], {}, { files: [], extra: 1 }, { files: {}, extra: 1 },
    { files: { '../a.test.ts': { cases: { a: [] } } } },
    { files: { 'tests/../a.test.ts': { cases: { a: [] } } } },
    { files: { 'tests/a.slow.test.ts': { cases: { a: [] } } } },
    { files: { [file]: { cases: {}, extra: 1 } } }, registry({}),
    registry({ a: ['typo'] }), registry({ a: ['win32', 'win32'] }),
  ])('不正な一覧を拒否する: %j', (value) => {
    expect(() => validate(value)).toThrow(PartitionError);
  });

  it('元ファイルもcompanionも実在が必要で、未登録/prototype名をcaseへ変換しない', () => {
    for (const absent of [file, companionOf(file)]) expect(() => validatePartition(registry(), { exists: (path) => path !== absent })).toThrow(absent);
    const r = validate(registry());
    for (const id of ['unknown', 'toString', '__proto__']) expect(() => includeCase(r, file, 'fast', id)).toThrow('未登録');
    expect(() => includeCase(r, 'toString', 'fast', 'mixed')).toThrow('未登録');
    expect(() => includeCase(r, file, 'invalid', 'mixed')).toThrow('分割先');
  });

  it('隔離との重なりは元ファイルとcompanionの両方で拒否する', () => {
    const r = validate(registry());
    expect(() => assertNotPartitioned(['tests/other.test.ts'], r)).not.toThrow();
    for (const path of [file, companionOf(file)]) expect(() => assertNotPartitioned([path], r)).toThrow('隔離できません');
  });
});
