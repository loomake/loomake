import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as kit from '../packages/kit/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';
import { auditRepository, auditScenarios, blockDigest, companionLinks, extractTestBlocks, inventoryRepository, inventoryScenarios, migrateRepository, migrateReviews, renderAudit, sha256 } from '../scripts/scenario-audit.mjs';

const spec = (scenario = '条件', rule = '規則を守る SHALL。') => `### Requirement: 振る舞い\n${rule}\nSource: REQ-012\n#### Scenario: ${scenario}\n- **WHEN** 条件\n- **THEN** 結果\n`;
const rows = () => inventoryScenarios('openspec/specs/x/spec.md', spec());
const testFile = 'tests/fixture.test.ts';
const target = "  it('[REQ-012] 条件を検査する', () => {\n    expect(value).toBe(true);\n  });";
const other = "  it('[REQ-012] 別の条件', () => {\n    expect(other).toBe(1);\n  });";
const file = (body = target, rest = other) => `describe('群', () => {\n${body}\n${rest}\n});\n`;
const run = (fullName = '群 [REQ-012] 条件を検査する', status = 'passed') => [{ file: testFile, fullName, status }];
const digestOf = (source: string, tests = run()) => blockDigest(source, tests) as string;
const blockReview = (source = file(), tests = run(), contains = '条件を検査する') => ({ id: rows()[0].id, status: 'reviewed', scenarioSha256: rows()[0].sha256, reason: '条件を与えて結果をassertする', sources: ['REQ-012'], tests: [{ file: testFile, contains, sha256: digestOf(source, tests), hashScope: 'block' }] });
const audit = (review: unknown, source: string, tests = run()) => auditScenarios(rows(), [review], tests, { [testFile]: source });

describe('試験の本文ブロックのハッシュ', () => {
  it('[REQ-347] 同じファイルの別の試験が変わっても、選んだ試験の対応は有効のまま', () => {
    const changed = file(target, other.replace('toBe(1)', 'toBe(2)') + "\n  it('[REQ-099] 追加した試験', () => {});");
    const result = audit(blockReview(), changed);
    expect(result.rows[0].status).toBe('reviewed');
    expect(result.ok).toBe(true);
  });
  it('[REQ-347] 選んだ試験の本文が変われば無効にする', () => {
    const result = audit(blockReview(), file(target.replace('toBe(true)', 'toBe(false)')));
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文が変更されています');
  });
  it('[REQ-347] it.each の表が変われば無効にし、%s の置換を試験名に当てる', () => {
    const each = (rows: string) => `  it.each([${rows}])('[REQ-012] %s で条件を検査する', (value) => {\n    expect(value).toBeTruthy();\n  });`;
    const tests = run('群 [REQ-012] a で条件を検査する');
    const review = blockReview(file(each("'a'")), tests, 'a で条件を検査する');
    expect(audit(review, file(each("'a'")), tests).rows[0].status).toBe('reviewed');
    expect(audit(review, file(each("'a', 'b'")), tests).rows[0].status).toBe('invalid');
  });
  it('[REQ-347] テンプレート文字列の式と $name を任意の文字列として当てる', () => {
    const source = "for (const name of ['甲']) {\n  it(`[REQ-012] ${name} の条件を検査する`, () => {});\n}\nit.each([{ who: '乙' }])('[REQ-012] $who を検査する', () => {});\n";
    expect(blockDigest(source, [{ file: testFile, fullName: '[REQ-012] 甲 の条件を検査する', status: 'passed' }])).toBeTypeOf('string');
    expect(blockDigest(source, [{ file: testFile, fullName: '[REQ-012] 乙 を検査する', status: 'passed' }])).toBeTypeOf('string');
  });
  it('[REQ-347] 同じ名前のブロックが複数あれば、どれが変わっても無効にする', () => {
    const twice = file(target, target.replace('expect(value)', 'expect(second)'));
    const review = blockReview(twice);
    expect(audit(review, twice).rows[0].status).toBe('reviewed');
    expect(audit(review, file(target, target.replace('expect(value)', 'expect(third)'))).rows[0].status).toBe('invalid');
  });
  it('[REQ-347] 文字列・コメント・正規表現の括弧と、型引数・別名の試験関数を読み違えない', () => {
    const tricky = "  it('[REQ-012] 条件を検査する', () => {\n    const pattern = /\\(/; // )\n    expect(')').toMatch(pattern); /* ( */\n    expect(`${'('}`).toBe('(');\n  });";
    const [block] = extractTestBlocks(file(tricky, ''));
    expect(block.text.endsWith('})')).toBe(true);
    expect(block.text).toContain("toBe('(')");
    const typed = "posixIt.each<{ a: number }>([{ a: 1 }])('[REQ-012] 型引数 $a', ({ a }) => { expect(a).toBe(1); });";
    expect(blockDigest(typed, [{ file: testFile, fullName: '[REQ-012] 型引数 1', status: 'passed' }])).toBeTypeOf('string');
  });
  it.each([
    ['括弧が閉じていない', "describe('群', () => {\n  it('[REQ-012] 条件を検査する', () => {\n    expect(value).toBe(true);\n"],
    ['試験名がリテラルでない', "describe('群', () => {\n  it(title, () => {});\n});\n"],
    ['名前に合うブロックがない', file(other, '')],
  ])('[REQ-347] 本文ブロックを特定できないとき（%s）は無効にする', (_, source) => {
    const review = blockReview();
    const result = audit(review, source);
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文ブロックを特定できません');
  });
  it('[REQ-347] ヘルパー経由の本物の試験と it(`${n}`) が同じファイルにあるとき、本物の本文の変更で無効になる', () => {
    const helper = (assertion: string) => `const check = (name: string) => it(name, () => { expect(${assertion}).toBe(true); });\ncheck('[REQ-012] 条件を検査する');\nfor (const n of ['a']) it(\`\${n}\`, () => {});\n`;
    const tests = [{ file: testFile, fullName: '[REQ-012] 条件を検査する', status: 'passed' }];
    expect(blockDigest(helper('value'), tests)).toBeUndefined();
    const recorded = { ...blockReview(), tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256('記録時の本文'), hashScope: 'block' }] };
    const result = auditScenarios(rows(), [recorded], tests, { [testFile]: helper('changed') });
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文ブロックを特定できません');
  });
  it("[REQ-347] '%s' だけのブロックの変更が別の試験を無効にしない", () => {
    const each = (value: string) => `  it.each(['x'])('%s', (v) => { expect(v).toBe('${value}'); });`;
    const review = blockReview(file(target, each('x')));
    const result = audit(review, file(target, each('y')));
    expect(result.rows[0].status).toBe('reviewed');
  });
  it('[REQ-347] 不明な hashScope と、旧形式のファイル全体のハッシュの違いを無効にする', () => {
    const review = blockReview();
    expect(audit({ ...review, tests: [{ ...review.tests[0], hashScope: 'line' }] }, file()).rows[0].status).toBe('invalid');
    const legacy = { ...review, tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(file()) }] };
    expect(audit(legacy, file()).rows[0].status).toBe('reviewed');
    expect(audit(legacy, file(target, other + '\n')).rows[0].status).toBe('invalid');
  });
});

describe('監査の対象と未着手', () => {
  const entries = [
    { file: 'openspec/specs/x/spec.md', text: spec() },
    { file: 'openspec/changes/c1/specs/x/spec.md', text: '## ADDED Requirements\n' + spec('変更中') },
    { file: 'openspec/changes/c2/specs/y/spec.md', text: '### Requirement: 壊れた\n' },
    { file: 'openspec/changes/archive/2026-01-01-old/specs/x/spec.md', text: '## ADDED Requirements\n' + spec('反映済み') },
  ];
  it('[REQ-188] 現行仕様だけを一覧にし、進行中の change は未着手として数え、archive は数えない', () => {
    const { inventory, pending } = inventoryRepository(entries);
    expect(inventory.map((row: { file: string }) => row.file)).toEqual(['openspec/specs/x/spec.md']);
    expect(pending.scenarios).toEqual([{ id: expect.stringMatching(/^SCN-/), change: 'c1' }]);
    expect(pending.unreadable).toEqual(['openspec/changes/c2/specs/y/spec.md']);
  });
  it('[REQ-190] 未着手だけにレビューがないとき、件数を JSON と Markdown に出して終了コード 0 にする', () => {
    const { inventory, pending } = inventoryRepository(entries);
    const pendingReview = { id: pending.scenarios[0].id, status: 'unreviewed' };
    const result = auditScenarios(inventory, [blockReview(), pendingReview], run(), { [testFile]: file() }, pending);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.pending).toEqual({ total: 1, byChange: { c1: 1 }, unreadable: ['openspec/changes/c2/specs/y/spec.md'] });
    const markdown = renderAudit(result);
    expect(markdown).toContain('未着手（進行中のchange。終了コードに含めない）1件：c1 1');
    expect(markdown).toContain('読めなかった差分仕様：openspec/changes/c2/specs/y/spec.md');
  });
  it('[REQ-190] 一覧にも未着手にもない参照は、従来どおり未知の参照として報告する', () => {
    const { inventory, pending } = inventoryRepository(entries);
    const result = auditScenarios(inventory, [blockReview(), { id: 'SCN-unknown', status: 'unreviewed' }], run(), { [testFile]: file() }, pending);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(['存在しないScenarioのレビューです：SCN-unknown']);
  });
});

describe('旧形式の対応の移行', () => {
  const legacy = (recorded: string) => ({ schemaVersion: 1, reviews: [{ ...blockReview(), tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(recorded) }] }] });
  const noHistory = () => undefined;
  it('[REQ-346] ファイルの別の箇所だけが変わった旧形式を、本文ブロックのハッシュに書き換える', () => {
    const recorded = file(); const current = file(target, other + "\n  it('[REQ-099] 追加', () => {});");
    const history = (path: string, digest: string) => path === testFile && digest === sha256(recorded) ? recorded : undefined;
    const { review, counts } = migrateReviews(legacy(recorded), run(), { [testFile]: current }, history);
    expect(review.reviews[0].tests[0]).toEqual({ file: testFile, contains: '条件を検査する', sha256: digestOf(current), hashScope: 'block' });
    expect(counts.migrated.sameBlock).toBe(1);
    expect(auditScenarios(rows(), review.reviews, run(), { [testFile]: current }).ok).toBe(true);
    expect(migrateReviews(legacy(current), run(), { [testFile]: current }, noHistory).counts.migrated.unchangedFile).toBe(1);
  });
  it('[REQ-346] 本文が変わったか、記録時の版がないか、試験を実行していない旧形式は残す', () => {
    const recorded = file(); const current = file(target.replace('toBe(true)', 'toBe(false)'));
    const history = () => recorded;
    const changed = migrateReviews(legacy(recorded), run(), { [testFile]: current }, history);
    expect(changed.review.reviews[0].tests[0].hashScope).toBeUndefined();
    expect(changed.counts.kept.blockChanged).toBe(1);
    expect(migrateReviews(legacy(recorded), run(), { [testFile]: current }, noHistory).counts.kept.historyNotFound).toBe(1);
    expect(migrateReviews(legacy(recorded), [], { [testFile]: current }, history).counts.kept.notExecuted).toBe(1);
    const block = { schemaVersion: 1, reviews: [blockReview()] };
    const kept = migrateReviews(block, run(), { [testFile]: file() }, history);
    expect(kept.review).toEqual(block);
    expect(kept.counts.alreadyBlock).toBe(1);
  });
});

describe('リポジトリでの実行', () => {
  let root: string | undefined;
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = undefined; });
  const prepare = (reviews: unknown[], options: { registry?: string; files?: Record<string, string>; report?: { name: string; assertionResults: { fullName: string; status: string }[] }[] } = {}) => {
    root = mkdtempSync(join(tmpdir(), 'scenario-audit-'));
    for (const [path, text] of [['openspec/specs/x/spec.md', spec()], ['openspec/changes/c1/specs/x/spec.md', '## ADDED Requirements\n' + spec('変更中')], [testFile, file()], ['tests/test-partition.json', options.registry ?? JSON.stringify({ files: {} })], ...Object.entries(options.files ?? {}), ['scripts/scenario-audit.mjs', readFileSync('scripts/scenario-audit.mjs', 'utf8')]]) {
      mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text);
    }
    writeFileSync(join(root, 'report.json'), JSON.stringify({ testResults: options.report ?? [{ name: testFile, assertionResults: run() }] }));
    mkdirSync(join(root, 'docs/quality'), { recursive: true });
    writeFileSync(join(root, 'docs/quality/scenarios.json'), JSON.stringify({ schemaVersion: 1, reviews }));
    return root;
  };
  it('[REQ-346] --dry-run はレビュー表を書き換えず、理由ごとの件数だけを返す', async () => {
    const dir = prepare([{ ...blockReview(), tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(file()) }] }]);
    const before = readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8');
    const dry = await migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit, history: () => undefined });
    expect(dry).toMatchObject({ dryRun: true, counts: { migrated: { unchangedFile: 1 } } });
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8')).toBe(before);
    await migrateRepository(dir, { reportFile: 'report.json', kit, history: () => undefined });
    expect(JSON.parse(readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8')).reviews[0].tests[0].hashScope).toBe('block');
  });
  it('[REQ-188][REQ-190] リポジトリの監査は現行仕様だけを対象にし、未着手の件数を audit.json に書く', async () => {
    const dir = prepare([blockReview()]);
    const result = await auditRepository(dir, join(dir, 'out'), undefined, 'report.json', kit);
    expect(result.ok).toBe(true);
    expect(result.counts.total).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, 'out/audit.json'), 'utf8')).pending).toEqual({ total: 1, byChange: { c1: 1 }, unreadable: [] });
  });
  const companion = 'tests/fixture.slow.test.ts';
  const companionText = "// 整形やコメントがあっても元fileだけを読む\nawait import( './fixture.test.js' );\n";
  const registered = JSON.stringify({ files: { [testFile]: { cases: { a: [], b: ['linux'] } } } });
  const routed = (tests = run(), source = file(), text = companionText) => ({ registry: registered, files: { [testFile]: source, [companion]: text }, report: [{ name: companion, assertionResults: tests }] });
  const execute = (dir: string, out = 'out') => auditRepository(dir, join(dir, out), undefined, 'report.json', kit);

  it('[REQ-347] 登録済みcompanionを元本文で照合しraw入力・レビュー表と追跡用hashを保つ', async () => {
    const dir = prepare([blockReview()], routed());
    const raw = readFileSync(join(dir, 'report.json'), 'utf8'); const ledger = readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8');
    const result = await execute(dir);
    expect(result.rows[0].status).toBe('reviewed');
    expect(result.rows[0].tests).toEqual([{ ...run()[0], rawFile: companion }]);
    expect(result.inputs).toMatchObject({ partitionSha256: sha256(registered), companions: { [companion]: sha256(companionText) }, testReportSha256: sha256(raw), reviewSha256: sha256(ledger) });
    expect(result.inputs.testSources[testFile]).toBe(sha256(file()));
    expect(renderAudit(result)).toContain(`${testFile}（${companion}）: ${run()[0].fullName}`);
    expect(readFileSync(join(dir, 'report.json'), 'utf8')).toBe(raw);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8')).toBe(ledger);
    writeFileSync(join(dir, companion), companionText + '// comment\n');
    const commented = await execute(dir, 'commented');
    expect(commented.rows[0].status).toBe('reviewed');
    expect(commented.inputs.companions[companion]).not.toBe(result.inputs.companions[companion]);
    writeFileSync(join(dir, testFile), file(target.replace('toBe(true)', 'toBe(false)')));
    expect((await execute(dir, 'changed')).rows[0]).toMatchObject({ status: 'invalid', reason: expect.stringContaining('本文が変更') });
  });
  it.each(['failed', 'skipped', 'todo'])('[REQ-347] 元fileの成功でcompanionの%sを覆わない', async (status) => {
    const options = routed(run(undefined, status)); options.report.unshift({ name: testFile, assertionResults: run() });
    const result = await execute(prepare([blockReview()], options));
    expect(result.rows[0]).toMatchObject({ status: 'invalid', reason: '選んだ試験に失敗または未実行があります' });
  });
  it('[REQ-347] companion対応後も必要なSourceを欠く実行は無効にする', async () => {
    const source = file(target.replace('[REQ-012] ', ''));
    const tests = run('群 条件を検査する');
    const result = await execute(prepare([blockReview(source, tests)], routed(tests, source)));
    expect(result.rows[0]).toMatchObject({ status: 'invalid', reason: '対応する試験に必要なSourceがありません' });
  });
  it('[REQ-347] 登録外companionはrawfileを保ち名前から元fileへ対応させない', async () => {
    const dir = prepare([blockReview()], { files: { [companion]: file() }, report: [{ name: companion, assertionResults: run() }] });
    const result = await execute(dir);
    expect(result.rows[0]).toMatchObject({ status: 'invalid', reason: expect.stringContaining('ソースが変更されたか存在しません') });
    expect(result.rows[0].candidates).toEqual([{ ...run()[0], file: companion, rawFile: companion }]);
    expect(result.inputs.companions).toEqual({});
  });
  it.each([
    ['壊れたJSON', '{'],
    ['未知key', JSON.stringify({ files: {}, extra: true })],
    ['不正path', JSON.stringify({ files: { '../fixture.test.ts': { cases: { a: [] } } } })],
  ])('[REQ-347] 不正な一覧（%s）は出力作成前に拒否する', async (_, registry) => {
    const dir = prepare([blockReview()], { registry });
    await expect(execute(dir)).rejects.toThrow('試験の分割一覧を読めません');
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
  it('[REQ-347] 欠落した一覧・companionを監査と移行の両入口で拒否する', async () => {
    const dir = prepare([blockReview()], routed());
    rmSync(join(dir, companion));
    await expect(execute(dir)).rejects.toThrow('ファイルがありません');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('ファイルがありません');
    writeFileSync(join(dir, 'tests/test-partition.json'), JSON.stringify({ files: {} }));
    rmSync(join(dir, 'tests/test-partition.json'));
    await expect(execute(dir)).rejects.toThrow('試験の分割一覧を読めません');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('試験の分割一覧を読めません');
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
  it.each([
    "it('own case', () => {}); await import('./fixture.test.js');",
    "await import('./other.test.js');",
    "await import('./fixture.test.js'); await import('./fixture.test.js');",
    "import './other.test.js'; await import('./fixture.test.js');",
    "import { helper } from './other.test.ts'; await import('./fixture.test.js');",
    "await import(target);",
    "import * as v from 'vitest'; (v).it('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; (v as typeof v).test('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const namespace = (v); const check = namespace.it; check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const namespace = v as typeof v; const check = namespace.test; check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const check = (v.it); check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const check = v.test as typeof v.test; check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const namespace = v; const check = namespace.it; check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; v['test']('own case', () => {}); await import('./fixture.test.js');",
    "import * as vitest from 'vitest'; vitest.it('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; const check = v.test; check('own case', () => {}); await import('./fixture.test.js');",
    "import * as v from 'vitest'; v.test.each([1])('own %j', () => {}); await import('./fixture.test.js');",
    "await import('./fixture.test.js'",
  ])('[REQ-347] 不正なcompanionを出力作成前に拒否する: %s', async (text) => {
    const dir = prepare([blockReview()], routed(run(), file(), text));
    await expect(execute(dir)).rejects.toThrow('companion');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('companion');
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
  it.each(['it', 'test'].flatMap((name) => [
    [name, '文字列key', `const { '${name}': check } = v; check('own case', () => {});`],
    [name, '識別子key', `const { ${name}: check } = v; check('own case', () => {});`],
    [name, 'computed literal key', `const { ['${name}']: check } = v; check('own case', () => {});`],
    [name, 'namespace別名と型wrapper', `const namespace = ((v as typeof v) satisfies typeof v)!; const { '${name}': check } = namespace; check('own case', () => {});`],
    [name, '取り出した関数の別名', `const { '${name}': base } = v; const check = (base as typeof base)!; check('own case', () => {});`],
    [name, 'nested bind', `const { '${name}': { 'bind': bindFn } } = v; const check = bindFn.call(v.${name}, v.${name}); check('own case', () => {});`],
    [name, '関数からbindを取得', `const { 'bind': bindFn } = v.${name}; const check = bindFn.call(v.${name}, v.${name}); check('own case', () => {});`],
    [name, 'named importのbind', `import { ${name} as base } from 'vitest'; const { 'bind': bindFn } = base; const check = bindFn.call(base, base); check('own case', () => {});`],
    [name, '関数内の先行参照', `function declareOwn() { check('own case', () => {}); } const { '${name}': check } = v; declareOwn();`],
    [name, 'namespace rest', `const { ...namespace } = v; namespace['${name}']('own case', () => {});`],
    [name, '分割代入式', `let check; ({ '${name}': check } = v); check('own case', () => {});`],
    [name, 'namespaceの代入と型wrapper', `let namespace; namespace = (v as typeof v)!; let check; ({ '${name}': check } = namespace); check('own case', () => {});`],
    [name, '試験関数の代入', `let check; check = v['${name}']; check('own case', () => {});`],
  ]))('[REQ-347] companionの分割代入した%sの宣言を監査と移行で拒否する: %s', async (_, __, body) => {
    const text = `import * as v from 'vitest'; ${body} await import('./fixture.test.js');`;
    const dir = prepare([blockReview()], routed(run(), file(), text));
    const raw = readFileSync(join(dir, 'report.json'));
    const ledger = readFileSync(join(dir, 'docs/quality/scenarios.json'));
    await expect(execute(dir)).rejects.toThrow('companionに試験の宣言があります');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('companionに試験の宣言があります');
    expect(existsSync(join(dir, 'out'))).toBe(false);
    expect(readFileSync(join(dir, 'report.json'))).toEqual(raw);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'))).toEqual(ledger);
  });
  it.each(['it', 'test'].flatMap((name) => [
    [name, '非literalな分割代入key', `const key = '${name}'; const { [key]: check } = v; check('own case', () => {});`],
    [name, '非literalなnamespace参照', `const key = '${name}'; const check = v[key]; check('own case', () => {});`],
    [name, '非literalな分割代入式key', `const key = '${name}'; let check; ({ [key]: check } = v); check('own case', () => {});`],
    [name, '未対応の代入先', `const holder = {}; holder.check = v['${name}']; holder.check('own case', () => {});`],
  ]))('[REQ-347] companionの%s由来の未確定な束縛は推測で許可しない: %s', async (_, __, body) => {
    const dir = prepare([blockReview()], routed(run(), file(), `import * as v from 'vitest'; ${body} await import('./fixture.test.js');`));
    await expect(execute(dir)).rejects.toThrow('companionの試験関数の束縛を静的に確認できません');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('companionの試験関数の束縛を静的に確認できません');
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
  it.each([
    "import * as v from 'vitest'; const { 'expect': assert } = v; assert(true).toBe(true);",
    "import * as v from 'vitest'; const { ['expect']: assert } = v; assert(true).toBe(true);",
    "import * as v from 'vitest'; let assert; ({ 'expect': assert } = v); assert(true).toBe(true);",
    "const { 'test': check } = { 'test': () => {} }; check();",
  ])('[REQ-347] 試験関数でない分割代入をcompanionの宣言と推測しない: %s', (body) => {
    expect(companionLinks(JSON.parse(registered), () => `${body} await import('./fixture.test.js');`)).toEqual(new Map([[companion, testFile]]));
  });
  const closedBindings = [
    ['bindingの既定値', "const { 'test': check = v['test'] } = {}; check('own case', () => {});"],
    ['代入bindingの既定値', "let check; ({ 'test': check = v['test'] } = {}); check('own case', () => {});", 'companionに試験の宣言があります'],
    ['引数bindingの既定値', "function own({ 'test': check = v['test'] } = {}) { check('own case', () => {}); } own();"],
    ['object carrier', "const holder = { check: v['test'] }; holder.check('own case', () => {});"],
    ['parameter carrier', "function own(check) { check('own case', () => {}); } own(v['test']);"],
    ['array carrier', "const [check] = [v['test']]; check('own case', () => {});"],
    ['条件式', "const check = true ? v['test'] : undefined; check('own case', () => {});"],
    ['カンマ式', "const check = (0, v['test']); check('own case', () => {});"],
    ['論理式', "const check = true && v['test']; check('own case', () => {});"],
    ['戻り値', "function take() { return v['test']; } const check = take(); check('own case', () => {});"],
    ['namespace引数', "function own(ns) { ns['test']('own case', () => {}); } own(v);"],
    ['namespace既定引数', "function own(ns = v) { ns['test']('own case', () => {}); } own();"],
    ['namespace object', "const holder = { namespace: v }; holder.namespace['test']('own case', () => {});"],
    ['namespace array', "const [ns] = [v]; ns['test']('own case', () => {});"],
    ['namespace spread', "const ns = { ...v }; ns['test']('own case', () => {});"],
    ['namespace shorthand', "const holder = { v }; holder.v['test']('own case', () => {});"],
    ['namespace条件式', "const ns = true ? v : undefined; ns['test']('own case', () => {});"],
    ['namespace戻り値', "function take() { return v; } take()['test']('own case', () => {});"],
    ['Reflect.get', "const check = Reflect.get(v, 'test'); check('own case', () => {});"],
    ['Object.values', "const values = Object.values(v);"],
    ['namespace export', "export { v };"],
    ['namespaceのexport付き初期化', "export const ns = v;"],
    ['namespace別名のcarrier', "const ns = (v as typeof v)!; const holder = { namespace: ns };"],
    ['許可外のproperty', "const value = v.describe;"],
    ['許可外のliteral key', "const value = v['describe'];"],
  ];
  const closedImports = [
    ['createRequire', "import { createRequire } from 'node:module'; createRequire(import.meta.url)('vitest');"],
    ['vitest subpath', "import * as runner from 'vitest/suite';"],
    ['Vitest runner package', "import * as runner from '@vitest/runner';"],
    ['external export', "export { createRequire } from 'node:module';"],
    ['external import equals', "import module = require('node:module');"],
  ];
  it.each([
    ...closedBindings.map(([label, body, message]) => [label, `import * as v from 'vitest'; ${body}`, message ?? 'companionの試験関数の束縛を静的に確認できません']),
    ...closedImports.map(([label, body]) => [label, body, `companionの読み込み先を静的に確認できません：${companion}`]),
    ['named bench', "import { bench } from 'vitest';", 'companionの試験関数の束縛を静的に確認できません'],
    ['default import', "import v from 'vitest';", 'companionの試験関数の束縛を静的に確認できません'],
    ['import equals vitest', "import v = require('vitest');", 'companionの試験関数の束縛を静的に確認できません'],
  ])('[REQ-347] 閉じたcompanion構文に反する%sを両入口で拒否して入力を保つ', async (_, body, message) => {
    const dir = prepare([blockReview()], routed(run(), file(), `${body} await import('./fixture.test.js');`));
    const raw = readFileSync(join(dir, 'report.json'));
    const ledger = readFileSync(join(dir, 'docs/quality/scenarios.json'));
    await expect(execute(dir)).rejects.toThrow(message);
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow(message);
    expect(existsSync(join(dir, 'out'))).toBe(false);
    expect(readFileSync(join(dir, 'report.json'))).toEqual(raw);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'))).toEqual(ledger);
  });
  it('[REQ-189][REQ-347] companion自身の同名宣言を元sourceのreviewedへ昇格しない', async () => {
    const text = "import * as v from 'vitest'; const { 'test': check = v['test'] } = {}; check('群 [REQ-012] 条件を検査する', () => {}); await import('./fixture.test.js');";
    const dir = prepare([blockReview()], routed(run(), file(), text));
    const raw = readFileSync(join(dir, 'report.json'));
    const ledger = readFileSync(join(dir, 'docs/quality/scenarios.json'));
    await expect(execute(dir)).rejects.toThrow('companionの試験関数の束縛を静的に確認できません');
    await expect(migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit })).rejects.toThrow('companionの試験関数の束縛を静的に確認できません');
    expect(existsSync(join(dir, 'out'))).toBe(false);
    expect(readFileSync(join(dir, 'report.json'))).toEqual(raw);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'))).toEqual(ledger);
  });
  it.each([
    "import * as v from 'vitest'; const ns = (v as typeof v)!; ns.expect(true).toBe(true);",
    "import * as v from 'vitest'; const { expect: assert = () => {} } = v; assert(true);",
    "import * as v from 'vitest'; v['expect'](true).toBe(true);",
    "import { expect as assert } from 'vitest'; assert(true).toBe(true);",
    "import { setPart } from './helpers/partition-part.js'; setPart('slow');",
    "import * as v from 'vitest'; type Namespace = typeof v; const { ['expect']: assert } = v; assert(true).toBe(true);",
  ])('[REQ-347] 閉じた構文のexpect・別名・型・setPartは受理する: %s', (body) => {
    expect(companionLinks(JSON.parse(registered), () => `${body} await import('./fixture.test.js');`)).toEqual(new Map([[companion, testFile]]));
  });
  it('[REQ-347] native1起動の自前宣言と正例の実行行を静的な拒否と対照する', () => {
    const dir = prepare([]);
    symlinkSync(realpathSync('node_modules'), join(dir, 'node_modules'), 'junction');
    mkdirSync(join(dir, 'tmp'));
    mkdirSync(join(dir, 'tests/helpers'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(join(dir, 'tests/helpers/partition-part.js'), "export function setPart(part) { if (part !== 'slow') throw new Error('part'); }");
    const cases = [
      ['original', "import * as v from 'vitest'; const { test: check } = v; check('own case', () => {});", true],
      ['fallback', "import * as v from 'vitest'; const { test: check = v['test'] } = {}; check('own case', () => {});", true],
      ['object', "import * as v from 'vitest'; const holder = { check: v['test'] }; holder.check('own case', () => {});", true],
      ['parameter', "import * as v from 'vitest'; function own(check) { check('own case', () => {}); } own(v['test']);", true],
      ['comment', "/* import('./other.test.js') */", false],
      ['helper', "import { setPart } from './helpers/partition-part.js'; setPart('slow');", false],
      ['expect', "import * as v from 'vitest'; const { 'expect': assert } = v; assert(true).toBe(true);", false],
      ['local', "const { 'test': check } = { 'test': () => {} }; check();", false],
    ] as const;
    const texts = new Map<string, string>();
    for (const [id, body] of cases) {
      const source = `tests/${id}.test.ts`;
      const companionFile = `tests/${id}.slow.test.ts`;
      writeFileSync(join(dir, source), "import { it, expect } from 'vitest'; it('source case', () => { expect(true).toBe(true); });");
      const text = `${body}\nawait import( './${id}.test.js' );`;
      texts.set(companionFile, text);
      writeFileSync(join(dir, companionFile), text);
    }
    writeFileSync(join(dir, 'vitest.config.mjs'), `export default { cacheDir: './cache', test: { include: ['tests/*.slow.test.ts'], globals: false, maxWorkers: 1, fileParallelism: false, reporters: ['json'], outputFile: './native-report.json' } };`);
    const native = spawnSync(process.execPath, [join(realpathSync('node_modules/vitest'), 'vitest.mjs'), 'run', '--configLoader', 'native', '--config', join(dir, 'vitest.config.mjs')], {
      cwd: dir, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, TMPDIR: join(dir, 'tmp'), TMP: join(dir, 'tmp'), TEMP: join(dir, 'tmp') },
    });
    expect(native.status, native.stderr + native.stdout).toBe(0);
    expect(native.signal).toBeNull();
    const report = JSON.parse(readFileSync(join(dir, 'native-report.json'), 'utf8')) as { numPassedTests: number; numFailedTests: number; testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[] };
    expect(report.numPassedTests).toBe(12);
    expect(report.numFailedTests).toBe(0);
    expect(report.testResults).toHaveLength(8);
    for (const [id, , declaresOwn] of cases) {
      const companionFile = `tests/${id}.slow.test.ts`;
      const result = report.testResults.find((row) => row.name.replaceAll('\\', '/').endsWith(`/${companionFile}`));
      expect(result?.assertionResults.map((row) => [row.fullName, row.status])).toEqual(declaresOwn ? [['own case', 'passed'], ['source case', 'passed']] : [['source case', 'passed']]);
      const registry = { files: { [`tests/${id}.test.ts`]: { cases: { a: ['linux'] } } } };
      const check = () => companionLinks(registry, (path: string) => texts.get(path)!);
      if (declaresOwn) expect(check).toThrow('companion');
      else expect(check()).toEqual(new Map([[companionFile, `tests/${id}.test.ts`]]));
    }
  }, 90000);
  it('[REQ-347] rawFileのない従来の純粋関数入力も元fileで表示する', () => {
    const markdown = renderAudit(audit(blockReview(), file()));
    expect(markdown).toContain(`${testFile}: ${run()[0].fullName}`);
    expect(markdown).not.toContain('undefined');
  });
  it('[REQ-347] companionのコメント内の偽importを無視し構造で確認する', () => {
    expect(companionLinks(JSON.parse(registered), () => "import { helper } from './helper.js'; /* import('./other.test.js') */ await import( './fixture.test.js' );")).toEqual(new Map([[companion, testFile]]));
  });
  it('[REQ-347] 選んだ複数本文blockの一部欠測を成功で補わない', async () => {
    const tests = [...run(), ...run('群 [REQ-012] 別の条件')];
    const review = blockReview(file(), tests, '[REQ-012]');
    const result = await execute(prepare([review], routed()));
    expect(result.rows[0]).toMatchObject({ status: 'invalid', reason: expect.stringContaining('本文が変更') });
  });
  it('[REQ-347] 同名の別入力行は残し、overlap selectorによる同じ行の重複を除く', async () => {
    const review = blockReview(); review.tests.push({ ...review.tests[0], contains: '[REQ-012]' });
    const dir = prepare([review], routed([...run(), ...run()]));
    const result = await execute(dir);
    expect(result.rows[0].status).toBe('reviewed');
    expect(result.rows[0].tests).toHaveLength(2);
    expect(result.rows[0].tests[0]).not.toBe(result.rows[0].tests[1]);
    writeFileSync(join(dir, 'report.json'), JSON.stringify({ testResults: [{ name: companion, assertionResults: [...run(), ...run(undefined, 'failed')] }] }));
    expect((await execute(dir, 'failed')).rows[0].status).toBe('invalid');
  });
  it('[REQ-347] overlap selectorが単一入力行を選んでも一度だけ数える', async () => {
    const review = blockReview(); review.tests.push({ ...review.tests[0], contains: '[REQ-012]' });
    const result = await execute(prepare([review], routed()));
    expect(result.rows[0].status).toBe('reviewed'); expect(result.rows[0].tests).toHaveLength(1);
  });
  it.each([
    [{ scenarioSha256: 'old' }, 'invalid', 'ScenarioかRequirementが変更されています'],
    [{ status: 'unreviewed', reason: '未確認のまま' }, 'unreviewed', '未確認のまま'],
    [{ tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(file() + '// old') }] }, 'invalid', `試験のソースが変更されたか存在しません：${testFile}`],
  ])('[REQ-347] companion登録だけで既存状態を昇格させない: %s', async (patch, status, reason) => {
    const result = await execute(prepare([{ ...blockReview(), ...patch }], routed()));
    expect(result.rows[0]).toMatchObject({ status, reason });
  });
  it('[REQ-347] companionだけで実行された旧形式も元本文で移行しdry-runとblock形式を保つ', async () => {
    const legacy = { ...blockReview(), tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(file()) }] };
    const dir = prepare([legacy, blockReview()], routed());
    const before = readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8');
    const dry = await migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit, history: () => file() });
    expect(dry.counts.migrated.unchangedFile).toBe(1); expect(dry.counts.alreadyBlock).toBe(1); expect(dry.counts.kept.notExecuted).toBe(0);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8')).toBe(before);
    writeFileSync(join(dir, testFile), '// prefix\n' + file());
    const sameBlock = await migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit, history: () => file() });
    expect(sameBlock.counts.migrated.sameBlock).toBe(1); expect(sameBlock.counts.alreadyBlock).toBe(1);
    const prefixed = auditScenarios(rows(), [legacy], [{ ...run()[0], rawFile: companion }], { [testFile]: '// prefix\n' + file() });
    expect(prefixed.rows[0]).toMatchObject({ status: 'invalid', reason: expect.stringContaining('ソースが変更されたか存在しません') });
    writeFileSync(join(dir, testFile), file(target.replace('toBe(true)', 'toBe(false)')));
    const changed = await migrateRepository(dir, { dryRun: true, reportFile: 'report.json', kit, history: () => file() });
    expect(changed.counts.kept.blockChanged).toBe(1); expect(changed.counts.kept.notExecuted).toBe(0);
    expect(readFileSync(join(dir, 'docs/quality/scenarios.json'), 'utf8')).toBe(before);
  });

});
