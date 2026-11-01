import { createRequire } from 'node:module';
import type { parseDocument as ParseDocument } from 'yaml';
import { checkInitialBaselineStructure } from './baseline.js';
import type { ApprovedBaseline } from './baseline-types.js';
import { canonicalJson } from './canonical.js';

export type RecordCounts = {
  rows: number; owners: number; scenarioMap: number; currentNull: number; moved: number; renamed: number;
  superseded: number; open: number; supersessions: number; supersessionRefs: number; supplements: number;
  adoption: number; testRefs: number; uniqueTestRefs: number; cross: number;
};
export type BaselinePin = { sha256: string; counts: RecordCounts };
type Context = Parameters<typeof checkInitialBaselineStructure>[1];
type Result = ReturnType<typeof checkInitialBaselineStructure>;

let yamlParser: typeof ParseDocument | undefined;
const loadParseDocument = (): typeof ParseDocument =>
  (yamlParser ??= (createRequire(import.meta.url)('yaml') as { parseDocument: typeof ParseDocument }).parseDocument);
const rejected = (problems: string[]): Result => ({ baseline: null, sha256: null, adoptionsVerified: false, problems });

function recordCounts(baseline: ApprovedBaseline): RecordCounts {
  const rows = baseline.rows, mappings = rows.flatMap((row) => row.scenarioMap);
  const supersessions = rows.flatMap((row) => row.supersessions ?? []);
  const tests = [...rows.flatMap((row) => row.tests), ...baseline.cross.flatMap((condition) => condition.tests)];
  return {
    rows: rows.length,
    owners: rows.reduce((sum, row) => sum + row.owners.length, 0),
    scenarioMap: mappings.length,
    currentNull: mappings.filter((mapping) => mapping.current === null).length,
    moved: mappings.filter((mapping) => mapping.status === 'moved').length,
    renamed: mappings.filter((mapping) => mapping.status === 'renamed').length,
    superseded: mappings.filter((mapping) => mapping.status === 'superseded').length,
    open: rows.reduce((sum, row) => sum + (row.open?.length ?? 0), 0),
    supersessions: supersessions.length,
    supersessionRefs: supersessions.reduce((sum, item) => sum + item.by.length, 0),
    supplements: rows.reduce((sum, row) => sum + (row.supplements?.length ?? 0), 0),
    adoption: rows.reduce((sum, row) => sum + row.adoption.length, 0),
    testRefs: tests.length,
    uniqueTestRefs: new Set(tests.map((test) => canonicalJson([test.file, test.name]))).size,
    cross: baseline.cross.length,
  };
}

/** Private structure and fixed-value check. Adoption actors and fresh executions remain unverified. */
export function checkBaselineRecord(text: string, context: Context, pin: Readonly<BaselinePin>): Result {
  try {
    const document = loadParseDocument()(text, { prettyErrors: false });
    if (document.errors.length || document.warnings.length) {
      return rejected(['初回基準の記録の YAML の書き方が正しくありません']);
    }
    let value: unknown;
    try {
      value = document.toJS({ maxAliasCount: 100 });
    } catch {
      return rejected(['初回基準の記録を展開できません']);
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'expected_spec')) {
      return rejected(['初回基準の記録の top-level は expected_spec だけにしてください']);
    }
    // Reject non-JSON and cyclic YAML values before any structure or canonical comparison.
    canonicalJson(value);
    const result = checkInitialBaselineStructure((value as { expected_spec: unknown }).expected_spec, context);
    if (!result.baseline) return result;
    const actual = recordCounts(result.baseline), problems: string[] = [];
    for (const key of Object.keys(actual) as (keyof RecordCounts)[]) {
      if (actual[key] !== pin.counts[key]) {
        problems.push(`初回基準の記録の固定件数が一致しません：${key} ${actual[key]}/${pin.counts[key]}`);
      }
    }
    if (result.sha256 !== pin.sha256) problems.push('初回基準の記録の canonical sha256 が固定値と一致しません');
    return problems.length ? rejected(problems) : result;
  } catch {
    return rejected(['初回基準の記録を照合できません。JSONの値と参照を確認してください']);
  }
}
