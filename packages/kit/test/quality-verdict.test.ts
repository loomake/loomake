import { describe, expect, expectTypeOf, it } from 'vitest';
import type { QualityResult } from '@loomake/core';
import { aggregateCiVerdict } from '../src/index.js';

describe('評価済み結果の CI verdict', () => {
  it.each<{ input: QualityResult[]; expected: QualityResult }>([
    { input: [], expected: 'INSUFFICIENT_EVIDENCE' },
    { input: ['NOT_APPLICABLE'], expected: 'INSUFFICIENT_EVIDENCE' },
    { input: ['NOT_APPLICABLE', 'NOT_APPLICABLE'], expected: 'INSUFFICIENT_EVIDENCE' },
    { input: ['PASS'], expected: 'PASS' },
    { input: ['PASS', 'PASS', 'NOT_APPLICABLE'], expected: 'PASS' },
    { input: ['INSUFFICIENT_EVIDENCE'], expected: 'INSUFFICIENT_EVIDENCE' },
    { input: ['PASS', 'NOT_APPLICABLE', 'INSUFFICIENT_EVIDENCE'], expected: 'INSUFFICIENT_EVIDENCE' },
    { input: ['FAIL'], expected: 'FAIL' },
    { input: ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE'], expected: 'FAIL' },
  ])('[REQ-306] $input の集約は $expected', ({ input, expected }) => {
    expect(aggregateCiVerdict(input)).toBe(expected);
  });

  it('[REQ-306] 4値の全16部分集合で順序・重複を変えても規則どおり返す', () => {
    const values: QualityResult[] = ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE'];
    // 要件7.3の優先順位を、入力集合ごとの期待値として固定する。
    const expected: QualityResult[] = ['INSUFFICIENT_EVIDENCE', 'PASS', 'FAIL', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'FAIL', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'PASS', 'FAIL', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'FAIL', 'FAIL'];
    for (let mask = 0; mask < 16; mask++) {
      const input = values.filter((_, bit) => (mask & (1 << bit)) !== 0);
      for (const order of [input, [...input].reverse(), [...input, ...input]]) {
        const frozen: readonly QualityResult[] = Object.freeze(order);
        expect(aggregateCiVerdict(frozen), JSON.stringify(frozen)).toBe(expected[mask]);
        expect(frozen).toEqual(order);
        expect(aggregateCiVerdict(frozen)).toBe(expected[mask]);
      }
    }
  });

  it('[REQ-306] 読み取り専用の共有型を受け取り値だけを返す', () => {
    expectTypeOf(aggregateCiVerdict).parameter(0).toEqualTypeOf<readonly QualityResult[]>();
    expectTypeOf(aggregateCiVerdict).returns.toEqualTypeOf<QualityResult>();
    const input = Object.freeze(['PASS', 'NOT_APPLICABLE'] as const);
    expect(aggregateCiVerdict(input)).toBe('PASS');
    expect(input).toEqual(['PASS', 'NOT_APPLICABLE']);
  });
});
