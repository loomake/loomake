import type { ParseResult } from './parse.js';

/** テストファイル → そのファイルの成功したテストの名前にある要件 ID（重複なし・昇順） */
export type TestRequirements = Record<string, string[]>;

/** レポートにあるテストの status。passed・failed 以外は実施に数えない */
export type TestCaseStatus = 'passed' | 'failed' | 'skipped' | 'todo' | 'pending' | 'other';

/** レポートにある 1 件のテスト。requirements は fullName にある要件 ID（重複なし・昇順） */
export type TestCase = { file: string; fullName: string; status: TestCaseStatus; requirements: string[] };

/** テストのレポートの中身。startTime はレポートの最上位にある開始時刻（エポックからのミリ秒）。なければ null */
export type TestReport = { startTime: number | null; tests: TestCase[] };

// Vitest の json レポーター（Jest と同じ形式）のうち、読む部分だけ
type Report = {
  testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const STATUSES: readonly TestCaseStatus[] = ['passed', 'failed', 'skipped', 'todo', 'pending'];
const toStatus = (status: string): TestCaseStatus => STATUSES.find((item) => item === status) ?? 'other';
const requirementIds = (fullName: string) => [...new Set([...fullName.matchAll(/\[(REQ-\d{3,})\]/g)].map((m) => m[1]))].sort();

function checkShape(report: unknown): string | null {
  if (!isObject(report) || !Array.isArray(report.testResults)) return 'testResults の配列がありません';
  for (const [i, r] of report.testResults.entries()) {
    if (!isObject(r) || typeof r.name !== 'string' || !Array.isArray(r.assertionResults)) {
      return `testResults[${i}] に name と assertionResults の配列がありません`;
    }
    for (const [j, a] of r.assertionResults.entries()) {
      if (!isObject(a) || typeof a.fullName !== 'string' || typeof a.status !== 'string') {
        return `testResults[${i}].assertionResults[${j}] に fullName と status がありません`;
      }
    }
  }
  return null;
}

// JSON.parse のエラーメッセージにある位置から、行番号を求める
function errorLine(text: string, message: string): number {
  const line = message.match(/line (\d+)/);
  if (line) return Number(line[1]);
  const pos = message.match(/position (\d+)/);
  return pos ? text.slice(0, Number(pos[1])).split('\n').length : 1;
}

// JSON として読み、形を確かめる。extractTestRequirements と parseTestReport で共通にする
function readReport(file: string, reportText: string): { report: Report & { startTime?: unknown } } | { errors: ParseResult<unknown>['errors'] } {
  let report: unknown;
  try {
    report = JSON.parse(reportText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { errors: [{ file, line: errorLine(reportText, message), message: `JSON として読めません（${message}）` }] };
  }
  const shapeError = checkShape(report);
  if (shapeError) return { errors: [{ file, line: 1, message: `テストのレポートの形が違います：${shapeError}` }] };
  return { report: report as Report & { startTime?: unknown } };
}

/**
 * テストランナーの JSON レポートから、成功した（status が passed の）テストの名前にある `[REQ-xxx]` を、
 * テストファイルごとに取り出す（REQ-015）。名前は describe の名前を含む fullName を使う。
 * skip・todo・失敗したテストは数えない。要件 ID の無いファイルは結果に含めない
 */
export function extractTestRequirements(file: string, reportText: string): ParseResult<TestRequirements> {
  const read = readReport(file, reportText);
  if ('errors' in read) return { value: {}, errors: read.errors };

  const value: TestRequirements = {};
  for (const r of read.report.testResults) {
    const ids = new Set<string>();
    for (const a of r.assertionResults) {
      if (a.status !== 'passed') continue;
      for (const m of a.fullName.matchAll(/\[(REQ-\d{3,})\]/g)) ids.add(m[1]);
    }
    if (ids.size > 0) value[r.name] = [...new Set([...(value[r.name] ?? []), ...ids])].sort();
  }
  return { value, errors: [] };
}

/**
 * テストランナー（Vitest・Jest と同じ形式）の JSON レポートから、すべてのテストの file・fullName・status・要件 ID と、
 * 最上位の startTime を読む（REQ-319）。status が passed・failed・skipped・todo・pending 以外なら other にする。
 * 読めないときや形が違うときは、空の結果とエラーを返す。extractTestRequirements の結果は変えない
 */
export function parseTestReport(file: string, reportText: string): ParseResult<TestReport> {
  const read = readReport(file, reportText);
  if ('errors' in read) return { value: { startTime: null, tests: [] }, errors: read.errors };
  const { startTime } = read.report;
  const tests = read.report.testResults.flatMap((r) =>
    r.assertionResults.map((a) => ({ file: r.name, fullName: a.fullName, status: toStatus(a.status), requirements: requirementIds(a.fullName) })),
  );
  return { value: { startTime: typeof startTime === 'number' && Number.isFinite(startTime) ? startTime : null, tests }, errors: [] };
}
