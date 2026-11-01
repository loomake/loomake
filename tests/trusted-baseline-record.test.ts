import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseSpec } from '../packages/core/src/index.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { checkBaselineRecord, type BaselinePin, type RecordCounts } from '../packages/kit/src/verify/trusted/baseline-record.js';
import { canonicalJson } from '../packages/kit/src/verify/trusted/canonical.js';
import { checkInitialBaselineStructure } from '../packages/kit/src/verify/trusted/baseline.js';
import type { AdoptionRef, ApprovedBaseline, BaselineRow } from '../packages/kit/src/verify/trusted/baseline-types.js';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { reconstructOriginalContracts } from '../packages/kit/src/verify/trusted/original-contracts.js';
import { reconstructOriginalScope } from '../packages/kit/src/verify/trusted/original-cross-conditions.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { buildMainSpecManifest, buildSpecManifest } from '../packages/kit/src/verify/trusted/spec-manifest.js';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const original = verifyOriginalSnapshot(readGitDocuments(process.cwd(), head, ORIGINAL_C001_SNAPSHOT_DIR), sha256Hex).documents!;
const index = reconstructOriginalContracts(original, sha256Hex).index!;
const scope = reconstructOriginalScope(original, sha256Hex).scope!;
const by: AdoptionRef[] = [{ trace: { change: 'fixture-owner', id: 'Q-FIXTURE-ONLY' } }];
const reference = (key: string) => ({ file: 'tests/fixture.test.ts', name: `[${key.split('/').at(-1)}] ${key}` });

// Synthetic anchor with original clauses, not the currently adopted owner data or an eligible execution.
function fixture() {
  const texts = new Map<string, string>();
  const rows: BaselineRow[] = index.contracts.map((contract) => {
    const { ref, path, line, name, scenarios } = contract.original;
    const document = original.find((doc) => doc.file === path)!;
    const parsed = parseSpec(path, document.text).value;
    const next = parsed.find((requirement) => requirement.line > line)?.line;
    const body = document.text.replace(/\r\n?/g, '\n').split('\n').slice(line - 1, next ? next - 1 : undefined).join('\n')
      .replace(/\s+## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/, '').trimEnd();
    const changes = contract.key === 'reference-docs/modified/REQ-324' ? ['verify-v2-evidence', 'verify-v2-scope'] : ['fixture-owner'];
    const owners = changes.map((change) => {
      const main = contract.key === 'verify/modified/REQ-042';
      const file = main ? 'openspec/specs/verify/spec.md'
        : `openspec/changes/${change}/specs/${contract.key.split('/').slice(0, -2).join('/')}/spec.md`;
      const text = (texts.get(file) ?? '') + '\n' + (main ? '' : `## ${parsed.find((r) => r.line === line)!.op} Requirements\n`) + body + '\n';
      texts.set(file, text);
      return { kind: main ? 'main-unchanged' as const : 'delta' as const, ...(main ? {} : { change }), file, name, block: '', scenarios: [...scenarios] };
    });
    return { key: contract.key, original: { ref, path, line, name, scenarios: [...scenarios] }, owners,
      scenarioMap: scenarios.map((scenario) => ({ original: scenario, current: { file: owners[0].file, name, scenario }, status: 'kept' as const })),
      adoption: structuredClone(by), tests: [reference(contract.key)],
      ...(['verify/modified/REQ-038', 'verify/modified/REQ-042'].includes(contract.key)
        ? { open: [{ clause: 'Synthetic public boundary remains open', owner: 'parent-1.3' as const }] } : {}) };
  });
  const anchor = [...texts].map(([file, text]) => ({ file, text }));
  for (const row of rows) for (const owner of row.owners) {
    const text = texts.get(owner.file)!;
    const result = owner.kind === 'main-unchanged' ? buildMainSpecManifest([{ file: owner.file, text }], sha256Hex)
      : buildSpecManifest(owner.change!, [{ file: owner.file, text }], sha256Hex);
    expect(result.problems).toEqual([]);
    owner.block = `sha256:${result.manifest!.blocks.find((block) => block.name === owner.name)!.sha256}`;
  }
  const baseline: ApprovedBaseline = { version: 1, originalIndexSha256: index.sha256,
    counts: { contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 }, rows,
    cross: scope.cross.map((condition) => ({ ...structuredClone(condition), tests: [reference(condition.rows[0])] })) };
  return { baseline, context: { original, anchor, sha256Hex } };
}

const { stringify } = createRequire(new URL('../packages/kit/package.json', import.meta.url))('yaml') as { stringify(value: unknown, options: { aliasDuplicateObjects: boolean }): string };
const counts: RecordCounts = { rows: 47, owners: 48, scenarioMap: 158, currentNull: 0, moved: 0,
  renamed: 0, superseded: 0, open: 2, supersessions: 0, supersessionRefs: 0, supplements: 0,
  adoption: 47, testRefs: 63, uniqueTestRefs: 47, cross: 16 };
const pinFor = (baseline: ApprovedBaseline): BaselinePin => ({ sha256: `sha256:${sha256Hex(canonicalJson(baseline))}`, counts: { ...counts } });
const record = (baseline: ApprovedBaseline) => JSON.stringify({ expected_spec: baseline });
const rejected = (result: ReturnType<typeof checkBaselineRecord>, match?: RegExp) => {
  expect(result.baseline).toBeNull();
  expect(result.sha256).toBeNull();
  expect(result.adoptionsVerified).toBe(false);
  expect(result.problems.length).toBeGreaterThan(0);
  expect(result.problems.join(' ')).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  if (match) expect(result.problems.join(' ')).toMatch(match);
};

describe('閉じた基準記録の読取り（合成fixture・実候補の採否ではない）', () => {
  it('[REQ-387] T-C2A-01 全原集合と固定値を照合し、入力を保ち全階層を凍結する', () => {
    const f = fixture(), pin = pinFor(f.baseline), before = structuredClone(f.baseline);
    const text = stringify({ expected_spec: f.baseline }, { aliasDuplicateObjects: false });
    const result = checkBaselineRecord(text, f.context, pin);
    expect(result.problems).toEqual([]);
    expect(result.baseline).toEqual(before);
    expect(result.sha256).toBe(pin.sha256);
    expect(result.adoptionsVerified).toBe(false);
    expect(result.baseline!.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
    const deepFrozen = (value: unknown): boolean => value === null || typeof value !== 'object'
      || (Object.isFrozen(value) && Object.values(value).every(deepFrozen));
    expect(deepFrozen(result.baseline)).toBe(true);
    expect(f.baseline).toEqual(before);
    expect(Object.isFrozen(f.baseline)).toBe(false);
    expect(Object.isFrozen(pin)).toBe(false);
    expect(Object.isFrozen(Object.prototype)).toBe(false);
    expect(Object.isFrozen(Array.prototype)).toBe(false);
    f.baseline.rows[0].adoption.push({ trace: { change: 'changed-owner', id: 'Q-CHANGED' } });
    expect(result.baseline).toEqual(before);
    expect(text).toBe(stringify({ expected_spec: before }, { aliasDuplicateObjects: false }));
  });

  it('[REQ-387] T-C2A-01 置換・改名・移動・補完を含む非ゼロ件数も照合する', () => {
    const f = fixture(), [a, b, c] = f.baseline.rows;
    a.scenarioMap[0].status = 'moved';
    b.scenarioMap[0].status = 'renamed';
    c.scenarioMap[0] = { ...c.scenarioMap[0], current: null, status: 'superseded', by: structuredClone(by) };
    a.open = [{ clause: 'Synthetic unresolved clause', owner: 'parent-1.3' }];
    a.supersessions = [{ clause: 'Synthetic replaced clause', by: [
      { trace: { change: 'fixture-owner', id: 'Q-CLAUSE-1' } },
      { trace: { change: 'fixture-owner', id: 'Q-CLAUSE-2' } },
    ] }];
    a.supplements = [{ key: b.key, scenario: b.original.scenarios[0] }];
    a.adoption.push({ trace: { change: 'fixture-owner', id: 'Q-ADDITIONAL' } });
    a.tests.push({ file: 'tests/extra.test.ts', name: '[REQ-194] extra' });
    const pin: BaselinePin = { sha256: pinFor(f.baseline).sha256, counts: {
      rows: 47, owners: 48, scenarioMap: 158, currentNull: 1, moved: 1, renamed: 1, superseded: 1,
      open: 3, supersessions: 1, supersessionRefs: 2, supplements: 1, adoption: 48,
      testRefs: 64, uniqueTestRefs: 48, cross: 16,
    } };
    expect(checkInitialBaselineStructure(f.baseline, f.context).problems).toEqual([]);
    const result = checkBaselineRecord(record(f.baseline), f.context, pin);
    expect(result.problems).toEqual([]);
    expect(result.sha256).toBe(pin.sha256);
    expect(result.adoptionsVerified).toBe(false);
  });

  it.each(Object.keys(counts) as (keyof RecordCounts)[])('[REQ-387] T-C2A-02 固定件数の%sも省略せず照合する', (key) => {
    const f = fixture(), pin = pinFor(f.baseline);
    pin.counts[key]++;
    rejected(checkBaselineRecord(record(f.baseline), f.context, pin), new RegExp(`固定件数.*${key}`));
  });

  it('[REQ-387] T-C2A-02 構造が通る件数の減少を基準側固定値で拒否する', () => {
    const f = fixture();
    f.baseline.rows[0].tests.push({ file: 'tests/extra.test.ts', name: '[REQ-194] extra' });
    const pin = { ...pinFor(f.baseline), counts: { ...counts, testRefs: 64, uniqueTestRefs: 48 } };
    expect(checkBaselineRecord(record(f.baseline), f.context, pin).problems).toEqual([]);
    f.baseline.rows[0].tests.pop();
    expect(checkInitialBaselineStructure(f.baseline, f.context).problems).toEqual([]);
    const result = checkBaselineRecord(record(f.baseline), f.context, pin);
    rejected(result, /固定件数.*testRefs/);
    expect(result.problems.join(' ')).toMatch(/uniqueTestRefs/);
    expect(result.problems.join(' ')).toMatch(/canonical sha256/);
  });

  it('[REQ-387] T-C2A-02 件数が同じで構造が通る値の変異もdigestで拒否する', () => {
    const f = fixture(), pin = pinFor(f.baseline);
    f.baseline.rows[0].adoption[0] = { trace: { change: 'fixture-owner', id: 'Q-DIFFERENT' } };
    expect(checkInitialBaselineStructure(f.baseline, f.context).problems).toEqual([]);
    const result = checkBaselineRecord(record(f.baseline), f.context, pin);
    rejected(result, /canonical sha256/);
    expect(result.problems).toHaveLength(1);
  });

  it.each(['sha256', 'counts'])('[REQ-387] T-C2A-02 記録側の%s自己申告を拒否する', (key) => {
    const f = fixture(), pin = pinFor(f.baseline);
    rejected(checkBaselineRecord(JSON.stringify({ expected_spec: f.baseline, [key]: pin[key as keyof BaselinePin] }), f.context, pin), /top-level/);
  });

  it.each([
    ['構文', 'expected_spec: ['],
    ['重複キー', 'expected_spec: {}\nexpected_spec: {}'],
    ['複数文書', 'expected_spec: {}\n---\nexpected_spec: {}'],
    ['未解決タグ', 'expected_spec: !unknown {}'],
    ['merge欄', 'expected_spec: {}\n<<: {}'],
    ['未知欄', 'expected_spec: {}\nversion: 1'],
    ['欠落', '{}'], ['配列root', '[]'], ['scalar root', 'abc'], ['null root', 'null'],
    ['NaN', 'expected_spec: {version: .nan}'], ['Infinity', 'expected_spec: {version: .inf}'],
    ['循環alias', 'expected_spec: &a {self: *a}'],
    ['collection増幅', 'expected_spec:\n  a: &a [x, x, x, x, x, x, x, x, x, x]\n  b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\n  c: [*b, *b]'],
    ['scalar101参照', 'expected_spec:\n  a: &a value\n  b: [' + Array(101).fill('*a').join(', ') + ']'],
    ['prototype欄', 'expected_spec: {}\n__proto__: {}'],
  ])('[REQ-387] T-C2A-03 %sを日本語で拒否し例外を投げない', (_name, text) => {
    const f = fixture(), pin = pinFor(f.baseline);
    rejected(checkBaselineRecord(text, f.context, pin));
  });

  it('[REQ-387] T-C2A-03 正しい基準をYAML1.1のmergeで組み立てても受理しない', () => {
    const f = fixture(), pin = pinFor(f.baseline);
    const text = `%YAML 1.1\n---\nexpected_spec:\n  <<: ${JSON.stringify(f.baseline)}`;
    rejected(checkBaselineRecord(text, f.context, pin));
  });

  it.each(['重複キー', '複数文書', '未解決タグ'] as const)(
    '[REQ-387] T-C2A-03 正しい基準の%sを構文検査の理由で拒否する', (kind) => {
      const f = fixture(), pin = pinFor(f.baseline), valid = record(f.baseline);
      expect(checkBaselineRecord(valid, f.context, pin).problems).toEqual([]);
      const text = kind === '重複キー' ? `expected_spec: ${JSON.stringify(f.baseline)}\nexpected_spec: ${JSON.stringify(f.baseline)}`
        : kind === '複数文書' ? `${valid}\n---\n${valid}`
          : `expected_spec: !unknown ${JSON.stringify(f.baseline)}`;
      rejected(checkBaselineRecord(text, f.context, pin), /YAML の書き方が正しくありません/);
    },
  );

  it('[REQ-387] T-C2A-03 collectionの指数的展開も既定予算で拒否する', () => {
    const f = fixture(), pin = pinFor(f.baseline);
    const text = 'expected_spec:\n  a: &a [x, x, x, x, x, x, x, x, x, x]\n'
      + '  b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\n'
      + '  c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\n'
      + '  d: [*c, *c]';
    rejected(checkBaselineRecord(text, f.context, pin), /展開できません/);
  });

  it('[REQ-387] T-C2A-03 既定100のscalar展開境界を緩めず適用する', () => {
    const f = fixture(), pin = pinFor(f.baseline);
    const text = (n: number) => `expected_spec:\n  a: &a value\n  b: [${Array(n).fill('*a').join(', ')}]`;
    // yaml counts the anchor itself once: 99 references fit, 100 exceed the default budget.
    const atLimit = checkBaselineRecord(text(99), f.context, pin);
    rejected(atLimit);
    expect(atLimit.problems.join(' ')).not.toMatch(/展開できません/);
    rejected(checkBaselineRecord(text(100), f.context, pin), /展開できません/);
  });

  it('[REQ-387] T-C2A-04 原集合や所有の構造不一致をそのまま保持する', () => {
    const f = fixture(), pin = pinFor(f.baseline);
    f.context.anchor[0].text += '\n#### Scenario: changed\n- **WHEN** changed\n- **THEN** changed\n';
    const direct = checkInitialBaselineStructure(f.baseline, f.context);
    expect(direct.problems.length).toBeGreaterThan(0);
    const result = checkBaselineRecord(record(f.baseline), f.context, pin);
    rejected(result);
    expect(result.problems).toEqual(direct.problems);
  });
});
