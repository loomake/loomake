import { describe, expect, it } from 'vitest';
import { evaluateTestCoverage } from '../src/index.js';

describe('成功テストと必要な要件の対応', () => {
  it('[REQ-149] 重複を除いて昇順にし、不足した要件にも空の配列を返す', () => {
    const needed = ['REQ-013', 'REQ-012', 'REQ-013', 'REQ-014'];
    const tests = { 'z.test.ts': ['REQ-012', 'REQ-012'], 'a.test.ts': ['REQ-012', 'REQ-999'] };
    const before = structuredClone({ needed, tests });
    expect(evaluateTestCoverage(needed, tests)).toEqual({ coverage: { 'REQ-012': ['a.test.ts', 'z.test.ts'], 'REQ-013': [], 'REQ-014': [] }, missing: ['REQ-013', 'REQ-014'] });
    expect({ needed, tests }).toEqual(before);
  });

  it('[REQ-149] 全要件が満たされれば不足を返さない', () => {
    expect(evaluateTestCoverage(['REQ-012'], { 'a.test.ts': ['REQ-012'] })).toEqual({ coverage: { 'REQ-012': ['a.test.ts'] }, missing: [] });
  });

  it('[REQ-149] 必要な要件がなければ空の対応を返す', () => {
    expect(evaluateTestCoverage([], { 'a.test.ts': ['REQ-012'] })).toEqual({ coverage: {}, missing: [] });
  });
});
