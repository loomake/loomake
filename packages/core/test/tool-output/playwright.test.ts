import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlaywrightReport } from '../../src/tool-output/playwright.js';

const stats = { expected: 1, unexpected: 0, flaky: 0, skipped: 0 };
const baseTest = { status: 'expected', expectedStatus: 'passed', projectName: 'project', results: [{ retry: 0 }] };
const spec = (tests: unknown[] = [baseTest]) => ({ title: 'case [REQ-448]', file: 'case.ts', tests });
const suite = (specs: unknown[] = [spec()]) => ({ title: 'file', file: 'case.ts', specs });
const report = (suites: unknown[] = [suite()]) => ({ suites, errors: [], stats });
const parse = (input: unknown) => parsePlaywrightReport('playwright', JSON.stringify(input));
describe('Playwright JSON', () => {
  it('[REQ-448] 固定版の合成 fixture で fullName・要件 ID・project を変換する', () => {
    const text = readFileSync(new URL('./fixtures/playwright.json', import.meta.url), 'utf8');
    expect(parsePlaywrightReport('playwright', text)).toEqual({ value: { tool: 'playwright', kind: 'tests', stats, errors: [], tests: [{
      file: 'example.test.ts', fullName: 'group [REQ-010] > case [REQ-448][REQ-010]', status: 'passed',
      requirements: ['REQ-010', 'REQ-448'], project: 'chromium', outcome: 'expected', retries: 0,
    }] }, errors: [] });
  });
  it.each([
    ['unexpected', 'future', 'failed'], ['skipped', 'future', 'skipped'], ['flaky', 'future', 'other'],
    ['expected', 'passed', 'passed'], ['expected', 'skipped', 'skipped'], ['expected', 'failed', 'other'],
    ['expected', 'timedOut', 'other'], ['expected', 'interrupted', 'other'], ['expected', 'future', 'other'],
  ])('[REQ-448] test.status を先に見て %s / %s を %s に写す', (status, expectedStatus, expected) => {
    expect(parse(report([suite([spec([{ ...baseTest, status, expectedStatus }])])])).value).toMatchObject({ tests: [{ status: expected }] });
  });
  it('[REQ-448] 空 suites/results/spec.tests、message なし/null、stats の不整合を保持する', () => {
    expect(parse({ ...report([]), errors: [{}, { message: null }] }).value).toEqual({
      tool: 'playwright', kind: 'tests', tests: [], errors: [{ message: null }, { message: null }], stats,
    });
    expect(parse(report([suite([spec([]), spec([{ ...baseTest, results: [] }])])])).value).toMatchObject({ tests: [{ retries: 0 }] });
    expect(parse(report([suite([spec([{ ...baseTest, results: [{ retry: 3 }, { retry: 1 }, { retry: 2 }] }])])])).value)
      .toMatchObject({ tests: [{ retries: 3 }] });
  });
  it.each([
    ...[-1, 0.5, 2 ** 53, '0', null].map(retry => ({ ...baseTest, results: [{ retry }] })),
    { ...baseTest, status: 'future' }, { ...baseTest, expectedStatus: 1 }, { ...baseTest, projectName: null },
    { ...baseTest, results: null }, { ...baseTest, results: [null] }, { ...baseTest, results: [{}] },
  ])('[REQ-448] 不正な retry・status・必須欄を拒否する: %j', test => {
    const result = parse(report([suite([spec([test])])])); expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
  });
  it.each([
    null, { ...report(), suites: null }, report([null]), report([{ ...suite(), title: null }]),
    report([{ ...suite(), file: 1 }]), report([{ ...suite(), specs: null }]), report([{ ...suite(), suites: false }]),
    report([suite([null])]), report([suite([{ ...spec(), title: null }])]), report([suite([{ ...spec(), file: null }])]),
    report([suite([{ ...spec(), tests: null }])]), { ...report([]), errors: null }, { ...report([]), errors: [null] },
    { ...report([]), errors: [{ message: 1 }] }, { ...report([]), stats: [] }, { ...report([]), stats: { ...stats, expected: -1 } },
    { ...report([]), stats: { ...stats, unexpected: 0.5 } }, { ...report([]), stats: { ...stats, flaky: 2 ** 53 } },
    { ...report([]), stats: { ...stats, skipped: null } },
  ])('[REQ-448] suite・spec・root error・stats の不正な形を拒否する: %j', input => {
    const result = parse(input); expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
  });
  it('[REQ-448] 深い suites を明示したスタックで文書順に走査する', () => {
    const depth = 12_000;
    const open = '{"title":"group","file":"case.ts","specs":[],"suites":[';
    const text = '{"suites":[' + open.repeat(depth) + JSON.stringify(suite()) + ']}'.repeat(depth)
      + '],"errors":[],"stats":' + JSON.stringify(stats) + '}';
    const result = parsePlaywrightReport('playwright', text);
    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({ tests: [{ status: 'passed' }] });
    if (result.value?.tool === 'playwright') expect(result.value.tests[0].fullName.split(' > ')).toHaveLength(depth + 1);
    const ordered = report([{ ...suite([spec()]), suites: [suite([spec([])]), suite([spec()])] }, suite()]);
    if (parse(ordered).value?.tool === 'playwright') expect(parse(ordered).errors).toEqual([]);
  });
  it('[REQ-448] 未知欄を捨て、深いエラー位置と入力を混ぜない', () => {
    const secret = 'sk-' + 'a'.repeat(25);
    const input = report([{ ...suite(), suites: [{ ...suite([spec([{ ...baseTest, status: { [secret]: secret } }])]), title: 'child' }] }]);
    expect(parse(input).errors).toEqual([{
      file: 'playwright', line: 1, message: '出力の形が違います：suites[0].suites[0].specs[0].tests[0].status',
    }]);
    const clean = parse(report()).value;
    expect(parse({ ...report(), unknown: secret, config: { secret }, suites: [{ ...suite(), unknown: secret, suites: null }] }).value).toEqual(clean);
  });
});
