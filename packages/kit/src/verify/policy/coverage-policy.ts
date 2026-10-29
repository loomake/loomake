export type TestCoverageDecision = { coverage: Record<string, string[]>; missing: string[] };

/** 必要な要件と成功テストの対応を判定する。ファイル名の正規化とレポート解析は呼び出し側が担当する。 */
export function evaluateTestCoverage(needed: readonly string[], tests: Readonly<Record<string, readonly string[]>>): TestCoverageDecision {
  const ids = [...new Set(needed)].sort();
  const files = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const [file, covered] of Object.entries(tests)) {
    for (const id of covered) files.get(id)?.add(file);
  }
  const coverage = Object.fromEntries(ids.map((id) => [id, [...(files.get(id) ?? [])].sort()]));
  return { coverage, missing: ids.filter((id) => coverage[id].length === 0) };
}
