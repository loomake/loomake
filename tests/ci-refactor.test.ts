import { describe, expect, it } from 'vitest';
import { isRefactorRoute, isTestScopePath, refactorDecision } from '../scripts/ci-refactor.mjs';

type Entry = { status: string; modes: [string, string]; paths: string[] };
const entry = (status: string, ...paths: string[]): Entry => ({ status, modes: ['100644', '100644'], paths });
const review = 'review: 実施済み round=1 by=opus session=00000000-0000-4000-8000-000000000000 model=m head=0000000000000000000000000000000000000000 critical=0 minor=0 info=0';
const evidence = (line = review) => `## 証跡\n\n\`\`\`text\nimplement: 実施済み by=claude\n${line}\n\`\`\`\n`;
const body = `loomake-change: none\nloomake-route: refactor\n\n${evidence()}`;
const src = entry('M', 'packages/kit/src/a.ts');
const decide = (entries: Entry[], text = body) => refactorDecision({ body: text, entries });
const reasons = (entries: Entry[], text = body) => decide(entries, text).problems.join(' ');

describe('リファクタの経路の宣言', () => {
  it.each([
    [['refactor'], true],
    [['REFACTOR'], true],
    [['spec-fix', 'refactor'], true],
    [['spec-fix'], false],
    [[], false],
  ])('[REQ-477] 経路 %j がリファクタの判定に進むか', (routes, expected) => {
    expect(isRefactorRoute(routes)).toBe(expected);
  });
  it('[REQ-477] 3条件がそろえば受け付ける', () => {
    expect(decide([src])).toEqual({ route: true, problems: [] });
  });
  it.each(['spec-fix', 'normal', ''])('[REQ-477] refactorと別の経路（%s）を同時に名乗ると拒む', (other) => {
    expect(reasons([src], `${body}\nloomake-route: ${other}`)).toContain('loomake-route:');
  });
});

describe('リファクタの経路の差分の条件', () => {
  it.each([
    entry('M', 'openspec/specs/x/spec.md'),
    entry('A', 'openspec/changes/c1/tasks.md'),
    entry('R100', 'docs/a.md', 'openspec/specs/x/spec.md'),
    entry('R100', 'openspec/specs/x/spec.md', 'docs/a.md'),
  ])('[REQ-477] openspecの変更を拒む（%j）', (change) => {
    expect(reasons([src, change])).toContain('openspec/');
  });
  it.each([
    entry('M', 'tests/a.test.ts'),
    entry('D', 'packages/core/test/spec.test.ts'),
    entry('R100', 'tests/a.test.ts', 'tests/b.test.ts'),
    entry('R090', 'packages/kit/test/a.test.ts', 'packages/kit/src/a.ts'),
    entry('T', 'tests/helpers/partition-fixture.ts'),
    entry('M', 'packages/kit/test/fixtures/x.json'),
    entry('M', 'tests/quarantine.json'),
    entry('M', 'vitest.config.ts'),
  ])('[REQ-477] 既存のテストファイルの変更・削除・改名を拒む（%j）', (change) => {
    const text = reasons([src, change]);
    expect(text).toContain('既存のテストファイル');
    expect(text).toContain(change.paths[0]);
  });
  it.each([
    entry('A', 'tests/a-pin.test.ts'),
    entry('A', 'packages/kit/test/fixtures/new.json'),
    entry('R100', 'packages/kit/src/old.ts', 'packages/kit/test/moved.ts'),
  ])('[REQ-477] テストファイルの追加は受け付ける（%j）', (change) => {
    expect(decide([src, change]).problems).toEqual([]);
  });
  it.each([
    ['tests/a.test.ts', true],
    ['tests/fixtures/x/y.md', true],
    ['packages/runner/test/helpers.ts', true],
    ['vitest.config.ts', true],
    ['packages/kit/src/a.ts', false],
    ['packages/kit/templates/test/a.ts', false],
    ['scripts/a.test.ts', false],
    ['docs/tests/a.md', false],
  ])('[REQ-477] テストファイルの範囲（%s）', (path, expected) => {
    expect(isTestScopePath(path)).toBe(expected);
  });
});

describe('リファクタの経路の独立レビューの証跡', () => {
  it.each([
    ['証跡の節がない', 'loomake-change: none\nloomake-route: refactor\n'],
    ['未実施だけ', `loomake-change: none\nloomake-route: refactor\n\n${evidence('review: 未実施')}`],
    ['節の外の行', `loomake-change: none\nloomake-route: refactor\n${review}\n`],
    ['コメントの中の行', `loomake-change: none\nloomake-route: refactor\n\n## 証跡\n<!-- ${review} -->\n`],
  ])('[REQ-477] %sなら拒む', (_name, text) => {
    expect(reasons([src], text)).toContain('review: 実施済み');
  });
  it('[REQ-477] 不足する条件をすべて示す', () => {
    const result = decide([src, entry('M', 'openspec/specs/x/spec.md'), entry('M', 'tests/a.test.ts')], 'loomake-change: none\nloomake-route: refactor\nloomake-route: spec-fix\n');
    expect(result.problems).toHaveLength(4);
  });
});
