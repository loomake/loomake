import { describe, it, expect } from 'vitest';
import { extractTestRequirements, parseTestReport } from '../src/index.js';

const report = (tests: { fullName: string; status: string }[], name = '/repo/tests/a.test.ts') =>
  JSON.stringify({ testResults: [{ name, assertionResults: tests }] });

describe('extractTestRequirements', () => {
  it('[REQ-015] 成功したテストの名前にある要件 ID を、テストファイルごとに返す', () => {
    const { value, errors } = extractTestRequirements('report.json', report([{ fullName: '[REQ-012][REQ-013] 未ログインのとき 401', status: 'passed' }]));
    expect(errors).toEqual([]);
    expect(value).toEqual({ '/repo/tests/a.test.ts': ['REQ-012', 'REQ-013'] });
  });

  it('[REQ-015] skip・todo・pending のテストは数えない', () => {
    const { value } = extractTestRequirements(
      'report.json',
      report([
        { fullName: '[REQ-020] skip', status: 'skipped' },
        { fullName: '[REQ-021] todo', status: 'todo' },
        { fullName: '[REQ-022] pending', status: 'pending' },
      ]),
    );
    expect(value).toEqual({});
  });

  it('[REQ-015] 失敗したテストは数えない', () => {
    expect(extractTestRequirements('report.json', report([{ fullName: '[REQ-023] 失敗', status: 'failed' }])).value).toEqual({});
  });

  it('[REQ-015] describe の名前にある要件 ID も数える', () => {
    const { value } = extractTestRequirements('report.json', report([{ fullName: '[REQ-024] ログイン 成功する', status: 'passed' }]));
    expect(value).toEqual({ '/repo/tests/a.test.ts': ['REQ-024'] });
  });

  it('[REQ-015][REQ-018] JSON として読めないときは、空の結果とファイル名つきのエラーを返す', () => {
    const { value, errors } = extractTestRequirements('report.json', '{\n  "testResults": [\n');
    expect(value).toEqual({});
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe('report.json');
    expect(errors[0].line).toBeGreaterThanOrEqual(1);
  });

  it('[REQ-015] レポートの形が違うときは、空の結果とエラーを返す', () => {
    const { value, errors } = extractTestRequirements('report.json', '{"testResults": [{"name": 1}]}');
    expect(value).toEqual({});
    expect(errors[0]).toMatchObject({ file: 'report.json', line: 1 });
  });
});

describe('parseTestReport', () => {
  it('[REQ-319] すべてのテストの file・fullName・status・要件 ID と startTime を返す', () => {
    const text = JSON.stringify({
      startTime: 1_700_000_000_000,
      testResults: [
        {
          name: '/repo/a.test.ts',
          assertionResults: [
            { fullName: '[REQ-012][REQ-012] 成功', status: 'passed' },
            { fullName: '[REQ-013] 失敗', status: 'failed' },
            { fullName: '[REQ-014] skip', status: 'skipped' },
            { fullName: '名前なし todo', status: 'todo' },
            { fullName: '[REQ-015] pending', status: 'pending' },
            { fullName: '[REQ-016] 知らない状態', status: 'disabled' },
          ],
        },
      ],
    });
    const { value, errors } = parseTestReport('report.json', text);
    expect(errors).toEqual([]);
    expect(value.startTime).toBe(1_700_000_000_000);
    expect(value.tests).toEqual([
      { file: '/repo/a.test.ts', fullName: '[REQ-012][REQ-012] 成功', status: 'passed', requirements: ['REQ-012'] },
      { file: '/repo/a.test.ts', fullName: '[REQ-013] 失敗', status: 'failed', requirements: ['REQ-013'] },
      { file: '/repo/a.test.ts', fullName: '[REQ-014] skip', status: 'skipped', requirements: ['REQ-014'] },
      { file: '/repo/a.test.ts', fullName: '名前なし todo', status: 'todo', requirements: [] },
      { file: '/repo/a.test.ts', fullName: '[REQ-015] pending', status: 'pending', requirements: ['REQ-015'] },
      { file: '/repo/a.test.ts', fullName: '[REQ-016] 知らない状態', status: 'other', requirements: ['REQ-016'] },
    ]);
  });

  it('[REQ-319] startTime がない・数でないときは null にする', () => {
    expect(parseTestReport('r.json', report([{ fullName: '[REQ-012] a', status: 'passed' }])).value.startTime).toBeNull();
    expect(parseTestReport('r.json', JSON.stringify({ startTime: '1', testResults: [] })).value.startTime).toBeNull();
  });

  it('[REQ-319] ファイル単位の status・message とテストの数を返す', () => {
    const text = JSON.stringify({
      testResults: [
        { name: '/repo/a.test.ts', status: 'passed', assertionResults: [{ fullName: '[REQ-012] a', status: 'passed' }] },
        { name: '/repo/broken.test.ts', status: 'failed', message: 'SyntaxError', assertionResults: [] },
        { name: '/repo/c.test.ts', status: 1, message: null, assertionResults: [] },
      ],
    });
    const { value, errors } = parseTestReport('r.json', text);
    expect(errors).toEqual([]);
    expect(value.files).toEqual([
      { file: '/repo/a.test.ts', status: 'passed', message: null, tests: 1 },
      { file: '/repo/broken.test.ts', status: 'failed', message: 'SyntaxError', tests: 0 },
      { file: '/repo/c.test.ts', status: null, message: null, tests: 0 },
    ]);
  });

  it('[REQ-319] 読めない・形が違うときは空の結果とエラーを返し、extractTestRequirements の結果は変えない', () => {
    expect(parseTestReport('r.json', '{').value).toEqual({ startTime: null, tests: [], files: [] });
    expect(parseTestReport('r.json', '{').errors[0].file).toBe('r.json');
    expect(parseTestReport('r.json', '{"testResults": [{"name": 1}]}').errors).toHaveLength(1);
    const text = report([
      { fullName: '[REQ-012] 成功', status: 'passed' },
      { fullName: '[REQ-013] 失敗', status: 'failed' },
    ]);
    expect(extractTestRequirements('r.json', text).value).toEqual({ '/repo/tests/a.test.ts': ['REQ-012'] });
  });
});
