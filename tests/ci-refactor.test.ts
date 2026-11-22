import { describe, expect, it } from 'vitest';
import { isAddablePath, isDeletablePath, isEditablePath, isRefactorRoute, refactorDecision } from '../scripts/ci-refactor.mjs';

type Entry = { status: string; modes: [string, string]; paths: string[] };
const entry = (status: string, ...paths: string[]): Entry => ({ status, modes: ['100644', '100644'], paths });
const review = 'review: 実施済み round=1 by=opus session=00000000-0000-4000-8000-000000000000 model=m head=0000000000000000000000000000000000000000 critical=0 minor=0 info=0';
const evidence = (line = review) => `## 証跡\n\n\`\`\`text\nimplement: 実施済み by=claude\n${line}\n\`\`\`\n`;
const body = `loomake-change: none\nloomake-route: refactor\n\n${evidence()}`;
const src = entry('M', 'packages/kit/src/a.ts');
const tree = ['packages/kit/src/a.ts', 'docs/a.md'];
type TreeResult = { paths?: string[]; detail?: string; invalid?: boolean };
const withTree = (entries: Entry[]): TreeResult => ({ paths: [...tree, ...entries.flatMap((e) => e.paths)] });
const decide = (entries: Entry[], text = body, headTreeResult: () => TreeResult = () => withTree(entries)) =>
  refactorDecision({ body: text, entries, headTreeResult });
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
    entry('M', 'scripts/lib/test-partition.mjs'),
    entry('M', 'package.json'),
    entry('M', 'loomake.config.json'),
    entry('M', 'scripts/ci-quarantine.mjs'),
    entry('M', 'eslint.config.js'),
    entry('M', 'tsconfig.base.json'),
    entry('M', 'packages/kit/tsconfig.json'),
    entry('M', 'packages/kit/package.json'),
    entry('M', '.github/workflows/ci.yml'),
    entry('M', 'AGENTS.md'),
    entry('M', 'packages/kit/templates/AGENTS.md'),
    entry('D', 'docs/a.md'),
    entry('D', 'scripts/x.mjs'),
    entry('R100', 'packages/kit/src/a.ts', 'scripts/a.mjs'),
    entry('R100', 'scripts/a.mjs', 'packages/kit/src/a.ts'),
    entry('R100', 'docs/a.md', 'packages/kit/test/a.md'),
    entry('R100', 'docs/a.md', 'packages/kit/src/a.md'),
    entry('R100', 'docs/a.md', 'docs/b/a.md'),
    entry('M', 'docs/guide/3.reference/cli.md'),
    entry('M', 'packages/kit/src/tsconfig.json'),
    entry('D', 'packages/kit/src/package.json'),
    entry('R100', 'packages/kit/src/a.ts', 'packages/kit/src/package.json'),
    entry('R100', 'packages/kit/src/a.ts', 'docs/guide/3.reference/a.md'),
  ])('[REQ-477] 範囲の外の既存のファイルの変更・削除・改名を拒む（%j）', (change) => {
    const text = reasons([src, change]);
    expect(text).toContain('変えてはいけない既存のファイル');
    expect(text).toContain(change.paths[0]);
  });
  it.each([
    entry('A', 'tests/a-pin.test.ts'),
    entry('A', 'packages/kit/test/fixtures/new.json'),
    entry('A', '.changeset/x.md'),
    entry('A', 'docs/worklog/2026-11-20/x.md'),
    entry('M', 'docs/worklog/2026-11-20.md'),
    entry('T', 'packages/kit/src/link.ts'),
    entry('D', 'packages/kit/src/b.ts'),
    entry('R100', 'packages/kit/src/c.ts', 'packages/kit/src/c/index.ts'),
    entry('R100', 'packages/kit/src/c.ts', 'packages/core/src/c.ts'),
    entry('R100', 'packages/kit/src/a.ts', 'packages/kit/test/a.ts'),
    entry('A', 'tests/helpers/new-helper.ts'),
    entry('A', 'docs/guide/new.md'),
  ])('[REQ-477] 追加と、範囲の中の変更・削除・改名は受け付ける（%j）', (change) => {
    expect(decide([src, change]).problems).toEqual([]);
  });
  it.each([
    ['packages/kit/src/a.ts', true],
    ['packages/kit/src/deep/b.ts', true],
    ['docs/dev/ci.md', true],
    ['packages/kit/test/a.test.ts', false],
    ['packages/kit/templates/a.md', false],
    ['packages/src/a.ts', false],
    ['tests/a.test.ts', false],
    ['scripts/lib/test-partition.mjs', false],
    ['package.json', false],
    ['AGENTS.md', false],
    ['openspec/specs/x/spec.md', false],
  ])('[REQ-477] 変更してよい既存のファイルの範囲（%s）', (path, expected) => {
    expect(isEditablePath(path)).toBe(expected);
  });
  it.each([
    ['packages/kit/src/a.ts', true],
    ['docs/a.md', false],
    ['packages/kit/test/a.test.ts', false],
  ])('[REQ-477] 削除してよい既存のファイルの範囲（%s）', (path, expected) => {
    expect(isDeletablePath(path)).toBe(expected);
  });
  it.each([
    'scripts/b.mjs',
    '.github/workflows/x.yml',
    'packages/kit/templates/x.md',
    'packages/kit/README.md',
    'x.md',
    'packages/kit/src/eslint.config.js',
    'packages/kit/src/ESLint.config.mjs',
    'tests/vitest.config.ts',
    'packages/kit/src/vite.config.mts',
    'tests/vitest.workspace.ts',
    'packages/kit/test/tsconfig.json',
    'packages/kit/test/tsconfig.build.json',
    'docs/package.json',
    'packages/kit/src/.npmrc',
    'tests/.pnpmfile.cjs',
    'docs/.gitattributes',
    'tests/node_modules/x.js',
    'packages/kit/src/node_modules/y/index.js',
    'docs/guide/3.reference/x.md',
  ])('[REQ-477] 足してはいけない場所への追加を拒む（%s）', (path) => {
    const text = reasons([src, entry('A', path)]);
    expect(text).toContain('足してはいけない');
    expect(text).toContain(path);
  });
  it.each([
    ['packages/kit/src/a.ts', true],
    ['packages/kit/test/a.test.ts', true],
    ['tests/a.test.ts', true],
    ['docs/a.md', true],
    ['.changeset/x.md', true],
    ['scripts/a.mjs', false],
    ['packages/kit/templates/a.md', false],
    ['openspec/changes/x/tasks.md', false],
    ['docs/guide/3.reference/a.md', false],
    ['packages/kit/src/eslint.config.js', false],
  ])('[REQ-477] 足してよいファイルの範囲（%s）', (path, expected) => {
    expect(isAddablePath(path)).toBe(expected);
  });
  it.each([
    ['packages/kit/src/A.ts', ['packages/kit/src/a.ts', 'packages/kit/src/A.ts']],
    ['packages/kit/SRC/b.ts', ['packages/kit/src/a.ts', 'packages/kit/SRC/b.ts', 'packages/kit/src/b.ts']],
  ])('[REQ-477] HEADの別のパスと大文字小文字だけが違うパスの追加を拒む（%s）', (path, headTree) => {
    const text = decide([src, entry('A', path)], body, () => ({ paths: headTree })).problems.join(' ');
    expect(text).toContain('大文字小文字だけが違う');
    expect(text).toContain(path);
  });
  it('[REQ-477] 改名の後のパスも大文字小文字の重なりを調べる', () => {
    const headTree = ['packages/kit/src/a.ts', 'packages/kit/src/B.ts', 'packages/kit/src/b.ts'];
    const text = decide([src, entry('R100', 'packages/kit/src/c.ts', 'packages/kit/src/B.ts')], body, () => ({ paths: headTree })).problems.join(' ');
    expect(text).toContain('packages/kit/src/B.ts');
  });
  it('[REQ-477] HEADのツリーを読めなければ、追加のある差分を拒む', () => {
    const text = decide([src, entry('A', 'tests/a-pin.test.ts')], body, () => ({ detail: 'fatal: bad object HEAD' })).problems.join(' ');
    expect(text).toContain('HEAD のツリーを読めない');
    expect(text).toContain('fatal: bad object HEAD');
  });
  it('[REQ-477] HEADのツリーの一覧がNULで終わっていなければ、そう示して拒む', () => {
    const text = decide([src, entry('A', 'tests/a-pin.test.ts')], body, () => ({ invalid: true })).problems.join(' ');
    expect(text).toContain('NUL で終わっていません');
  });
  it('[REQ-477] HEADのツリーを読めなくても、追加と改名のない差分は判定できる', () => {
    expect(decide([src], body, () => ({ detail: 'fatal: bad object HEAD' })).problems).toEqual([]);
  });
});

const link = (status: string, from: string, ...paths: string[]): Entry => ({ status, modes: [from, '120000'], paths });

describe('リファクタの経路のシンボリックリンク・未知の状態・照合の正本', () => {
  it.each([
    link('A', '000000', 'tests/node_modules'),
    link('A', '000000', 'tests/helpers/link.ts'),
    link('T', '100644', 'packages/kit/src/a.ts'),
    link('M', '120000', 'packages/kit/src/link.ts'),
    link('R100', '120000', 'packages/kit/src/link.ts', 'packages/kit/src/moved.ts'),
    link('C100', '120000', 'packages/kit/src/link.ts', 'tests/link.ts'),
  ])('[REQ-477] シンボリックリンクの追加・変更・改名・複写を拒む（%j）', (change) => {
    const text = reasons([src, change]);
    expect(text).toContain('シンボリックリンク');
    expect(text).toContain(change.paths.at(-1));
  });
  it('[REQ-477] シンボリックリンクを消すことは拒まない', () => {
    const removed: Entry = { status: 'D', modes: ['120000', '000000'], paths: ['packages/kit/src/link.ts'] };
    expect(decide([src, removed]).problems).toEqual([]);
  });
  it.each(['tests/node_modules', 'packages/kit/src/NODE_MODULES', 'docs/Node_Modules'])('[REQ-477] node_modulesという名前のファイルの追加を拒む（%s）', (path) => {
    expect(isAddablePath(path)).toBe(false);
    expect(reasons([src, entry('A', path)])).toContain('足してはいけない');
  });
  it.each(['docs/guide/3.Reference/cli.md', 'docs/Guide/3.reference/cli.md'])('[REQ-477] 照合の正本は大文字小文字を問わず拒む（%s）', (path) => {
    expect(isEditablePath(path)).toBe(false);
    expect(isAddablePath(path)).toBe(false);
  });
  it.each(['X', 'U', '', 'Z100'])('[REQ-477] 未知の状態（%j）のエントリを拒む', (status) => {
    const text = reasons([src, entry(status, 'packages/kit/src/b.ts')]);
    expect(text).toContain('変えてはいけない既存のファイル');
    expect(text).toContain('packages/kit/src/b.ts');
  });
  it('[REQ-477] 範囲の外への改名には、改名の先は追加と同じ範囲だと示す', () => {
    expect(reasons([src, entry('R100', 'packages/kit/src/a.ts', 'scripts/a.mjs')])).toContain('改名の先は追加と同じ範囲');
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
