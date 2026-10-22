import type { ParseResult } from './parse.js';

/** テストファイル → そのファイルの成功したテストの名前にある要件 ID（重複なし・昇順） */
export type TestRequirements = Record<string, string[]>;

// Vitest の json レポーター（Jest と同じ形式）のうち、読む部分だけ（trace.md の仮定 A-06）
type Report = {
  testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

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

/**
 * テストランナーの JSON レポートから、成功した（status が passed の）テストの名前にある `[REQ-xxx]` を、
 * テストファイルごとに取り出す（REQ-015）。名前は describe の名前を含む fullName を使う。
 * skip・todo・失敗したテストは数えない。要件 ID の無いファイルは結果に含めない
 */
export function extractTestRequirements(file: string, reportText: string): ParseResult<TestRequirements> {
  let report: unknown;
  try {
    report = JSON.parse(reportText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { value: {}, errors: [{ file, line: errorLine(reportText, message), message: `JSON として読めません（${message}）` }] };
  }
  const shapeError = checkShape(report);
  if (shapeError) return { value: {}, errors: [{ file, line: 1, message: `テストのレポートの形が違います：${shapeError}` }] };

  const value: TestRequirements = {};
  for (const r of (report as Report).testResults) {
    const ids = new Set<string>();
    for (const a of r.assertionResults) {
      if (a.status !== 'passed') continue;
      for (const m of a.fullName.matchAll(/\[(REQ-\d{3,})\]/g)) ids.add(m[1]);
    }
    if (ids.size > 0) value[r.name] = [...new Set([...(value[r.name] ?? []), ...ids])].sort();
  }
  return { value, errors: [] };
}
