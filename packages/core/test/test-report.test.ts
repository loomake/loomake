import { describe, it, expect } from 'vitest';
import { extractTestRequirements } from '../src/index.js';

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
