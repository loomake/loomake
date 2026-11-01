import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { checkBaselineRecord } from '../packages/kit/src/verify/trusted/baseline-record.js';
import { C001_INITIAL_BASELINE_PIN as pin, C001_VERIFICATION_FILE } from '../packages/kit/src/verify/trusted/c001-baseline.js';
import { checkInitialBaselineStructure } from '../packages/kit/src/verify/trusted/baseline.js';
import type { ApprovedBaseline } from '../packages/kit/src/verify/trusted/baseline-types.js';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';

const { parseDocument } = createRequire(new URL('../packages/kit/package.json', import.meta.url))('yaml') as {
  parseDocument(text: string): { toJS(options: { maxAliasCount: number }): { expected_spec: ApprovedBaseline } };
};
let text: string, baseline: ApprovedBaseline, context: Parameters<typeof checkInitialBaselineStructure>[1];
const row = (b: ApprovedBaseline, key: string) => b.rows.find(r => r.key.endsWith('/' + key))!;
const encode = (b: ApprovedBaseline) => JSON.stringify({ expected_spec: b });
const check = (b = baseline) => checkBaselineRecord(encode(b), context, pin);
function reject(result: ReturnType<typeof check>, reason?: RegExp) {
  expect(result.baseline).toBeNull(); expect(result.sha256).toBeNull();
  expect(result.adoptionsVerified).toBe(false);
  expect(result.problems.join(' ')).toMatch(reason ?? /[ぁ-んァ-ヶ一-龯]/);
}
beforeAll(() => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const original = verifyOriginalSnapshot(readGitDocuments(process.cwd(), head, ORIGINAL_C001_SNAPSHOT_DIR), sha256Hex);
  expect(original.problems).toEqual([]);
  text = readGitDocuments(process.cwd(), head, C001_VERIFICATION_FILE)[0].text;
  baseline = parseDocument(text).toJS({ maxAliasCount: 100 }).expected_spec;
  const files = [...new Set(baseline.rows.flatMap(r => r.owners.map(o => o.file)))];
  const anchor = files.map(file => ({ file, text: new TextDecoder('utf-8', { fatal: true }).decode(
    execFileSync('git', ['--no-replace-objects', 'show', `${head}:${file}`])) }));
  context = { original: original.documents!, anchor, sha256Hex };
});
const targets: [string, (b: ApprovedBaseline) => unknown[]][] = [
  ['行', b => b.rows], ['所有', b => b.rows[0].owners], ['Scenario', b => b.rows[0].scenarioMap],
  ['未対応', b => row(b, 'REQ-205').open!], ['置換', b => row(b, 'REQ-135').supersessions!],
  ['補完', b => row(b, 'REQ-042').supplements!], ['採否', b => row(b, 'REQ-135').adoption],
  ['行の試験', b => row(b, 'REQ-135').tests], ['句の採否', b => row(b, 'REQ-135').supersessions![0].by],
  ['横断の試験', b => b.cross[10].tests], ['横断条件', b => b.cross],
];
describe('C001の具体初回記録（主体・適格実行の合格ではない）', () => {
  it('[REQ-378] T-C2-01 実記録を固定値で照合し、入力を保ち凍結する', () => {
    const before = JSON.stringify(baseline), result = checkBaselineRecord(text, context, pin);
    expect(result.problems).toEqual([]);
    expect(result.sha256).toBe('sha256:b0db0a585ca07991dec271e216f6cbb3a394022a6d0a5202720de6a5f615cac2');
    expect(result.adoptionsVerified).toBe(false);
    expect(result.baseline!.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
    expect(pin.counts).toEqual({ rows: 47, owners: 49, scenarioMap: 158, currentNull: 7, moved: 8, renamed: 2,
      superseded: 0, open: 21, supersessions: 5, supersessionRefs: 5, supplements: 15, adoption: 97,
      testRefs: 565, uniqueTestRefs: 409, cross: 16 });
    const frozen = (v: unknown): boolean => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozen));
    expect(frozen(result.baseline)).toBe(true); expect(frozen(pin)).toBe(true);
    expect(JSON.stringify(baseline)).toBe(before); expect(Object.isFrozen(baseline)).toBe(false);
    expect(Object.isFrozen(Object.prototype)).toBe(false); expect(Object.isFrozen(Array.prototype)).toBe(false);
  });
  it.each(targets.flatMap(([name, select]) => ['削除', '追加', '複製'].map(op => ({ name, select, op }))))(
    '[REQ-378] T-C2-02 $name の1件$opを拒否する', ({ select, op }) => {
      const b = structuredClone(baseline), list = select(b);
      if (op === '削除') list.pop();
      else if (op === '追加' || list.length === 1) list.push(structuredClone(list[0]));
      else list[1] = structuredClone(list[0]);
      reject(check(b));
    });
  it.each(['未対応', '採否', '横断の試験'])('[REQ-378] T-C2-03 構造だけなら通る%sの欠落も固定値で拒否する', name => {
    const b = structuredClone(baseline); targets.find(t => t[0] === name)![1](b).pop();
    expect(checkInitialBaselineStructure(b, context).problems).toEqual([]);
    reject(check(b), /固定件数/);
  });
  it.each(['sha256', 'counts'])('[REQ-378] T-C2-03 記録側の%s自己申告を拒否する', key => {
    reject(checkBaselineRecord(JSON.stringify({ expected_spec: baseline, [key]: pin[key as keyof typeof pin] }), context, pin), /top-level/);
  });
  it.each([
    ['構文', () => 'expected_spec: [', /YAML の書き方/],
    ['重複', (b: string) => `expected_spec: ${b}\nexpected_spec: ${b}`, /YAML の書き方/],
    ['複数文書', (b: string) => `{"expected_spec":${b}}\n---\n{"expected_spec":${b}}`, /YAML の書き方/],
    ['タグ', (b: string) => `expected_spec: !unknown ${b}`, /YAML の書き方/],
    ...['extra: 1', '<<: {}', '__proto__: {}'].map(field =>
      [field, (b: string) => `expected_spec: ${b}\n${field}`, /top-level/] as const),
    ...['{}', '[]', 'abc', 'null'].map(input => [input, () => input, /top-level/] as const),
    ...['.nan', '.inf'].map(value => [value, () => `expected_spec: {version: ${value}}`, /JSON/] as const),
    ['循環', () => 'expected_spec: &a {self: *a}', /JSON|展開/],
    ['alias', () => 'expected_spec: {a: &a x, b: [' + Array(101).fill('*a').join(',') + ']}', /展開できません/],
  ] as const)('[REQ-378][REQ-387] T-C2-04 %sの拒否経路を確かめる', (_name, input, reason) => {
    reject(checkBaselineRecord(input(JSON.stringify(baseline)), context, pin), reason);
  });
  it('[REQ-378][REQ-371] T-C2-05 後続判断と未対応・両所有・331・Draftを保持する', () => {
    const b = check().baseline!;
    for (const id of ['REQ-038', 'REQ-042']) expect(row(b, id).open![0].clause).toBe('existing-' + id.slice(4));
    expect(row(b, 'REQ-042').owners[0].kind).toBe('main-unchanged');
    expect(row(b, 'REQ-042').supersessions![0].by[0]).toMatchObject({ prBody: { pr: 217 } });
    expect(row(b, 'REQ-324').owners.map(o => o.change)).toEqual(['verify-v2-evidence', 'verify-v2-scope']);
    expect(row(b, 'REQ-324').open![0].clause).toContain('DUP-324');
    expect(row(b, 'REQ-100').owners[1]).toMatchObject({ file: 'openspec/specs/run/spec.md', name: '変更を残さない完了ゲートの直し' });
    expect(row(b, 'REQ-114').open![0].clause).toContain('requires Draft');
    expect(row(b, 'REQ-205').open!.map(o => o.clause)).toEqual(['O1', 'O2', 'O3']);
    expect(b.rows.flatMap(r => r.scenarioMap.filter(m => m.status !== 'kept' || m.current === null).map(m => [r.key, m.original, m.status]))).toEqual(Object.entries(NON_KEPT).flatMap(([key, list]) => list.map(([name, status]) => [key, name, status])));
  });
  it('[REQ-378] T-C2-06 9採否の移管と他88参照を保持し、主体は未検証とする', () => {
    const b = check().baseline!, all = b.rows.flatMap(r => r.adoption);
    const own = b.rows.flatMap(r => r.adoption.filter(a => 'trace' in a && a.trace.change === 'trusted-c001-initial-baseline')
      .map(a => [r.key, 'trace' in a ? a.trace.id : '']));
    expect(own).toEqual(OWN);
    expect(all.length - own.length).toBe(88);
    expect(all.some(a => 'trace' in a && a.trace.change === 'verify-trusted-checker')).toBe(false);
    expect(check().adoptionsVerified).toBe(false);
  });
});
const NON_KEPT = {"core-parsers/modified/REQ-274":[["入力モードと出力を混ぜない","kept"]],"run-decision-policy/modified/REQ-205":[["既存優先順位と観測を保持する","kept"],["予算終了後に作業状態を観測できない","kept"],["監視異常とabortedの競合","kept"],["不正な結果とciは停止する","moved"]],"run/modified/REQ-093":[["仕様ゲートの実行エラー","renamed"]],"run/modified/REQ-164":[["正常v2でも再利用条件に合わない","moved"]],"trace-record/added/REQ-315":[["不正scopeで記録しない","moved"]],"trace-report/modified/REQ-073":[["新旧形式を混ぜた証拠を拒否する","renamed"]],"verification-policy/added/REQ-314":[["構造NAと品質NAを混ぜない","moved"]],"verify/added/REQ-311":[["型付きの制限観測","kept"],["正規partialのlocal完了","kept"],["制限で止まった検査のv2記録","kept"]],"verify/added/REQ-312":[["bareと不正scope","moved"],["bareのskipとコマンド未設定","moved"]],"verify/modified/REQ-037":[["構造NAの限定例外","moved"]],"verify/modified/REQ-191":[["bareで品質コマンドを省く","moved"]]};
const OWN = [["cli/modified/REQ-194","Q-S1-16"],["core-parsers/added/REQ-308","Q-S1-18"],["core-parsers/modified/REQ-275","Q-S1-17"],["external-process-budget/modified/REQ-183","Q-S1-19"],["run-decision-policy/added/REQ-317","Q-S1-21"],["run-decision-policy/modified/REQ-205","Q-S1-20"],["run-pr/modified/REQ-114","Q-S1-22"],["run-pr/modified/REQ-115","Q-S1-23"],["trace-report/added/REQ-316","Q-S1-24"]];
