import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as kit from '../packages/kit/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';
import { auditRepository, auditScenarios, blockDigest, extractTestBlocks, inventoryRepository, inventoryScenarios, migrateRepository, migrateReviews, renderAudit, sha256 } from '../scripts/scenario-audit.mjs';

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
  it('[REQ-189] 同じファイルの別の試験が変わっても、選んだ試験の対応は有効のまま', () => {
    const changed = file(target, other.replace('toBe(1)', 'toBe(2)') + "\n  it('[REQ-099] 追加した試験', () => {});");
    const result = audit(blockReview(), changed);
    expect(result.rows[0].status).toBe('reviewed');
    expect(result.ok).toBe(true);
  });
  it('[REQ-189] 選んだ試験の本文が変われば無効にする', () => {
    const result = audit(blockReview(), file(target.replace('toBe(true)', 'toBe(false)')));
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文が変更されています');
  });
  it('[REQ-189] it.each の表が変われば無効にし、%s の置換を試験名に当てる', () => {
    const each = (rows: string) => `  it.each([${rows}])('[REQ-012] %s で条件を検査する', (value) => {\n    expect(value).toBeTruthy();\n  });`;
    const tests = run('群 [REQ-012] a で条件を検査する');
    const review = blockReview(file(each("'a'")), tests, 'a で条件を検査する');
    expect(audit(review, file(each("'a'")), tests).rows[0].status).toBe('reviewed');
    expect(audit(review, file(each("'a', 'b'")), tests).rows[0].status).toBe('invalid');
  });
  it('[REQ-189] テンプレート文字列の式と $name を任意の文字列として当てる', () => {
    const source = "for (const name of ['甲']) {\n  it(`[REQ-012] ${name} の条件を検査する`, () => {});\n}\nit.each([{ who: '乙' }])('[REQ-012] $who を検査する', () => {});\n";
    expect(blockDigest(source, [{ file: testFile, fullName: '[REQ-012] 甲 の条件を検査する', status: 'passed' }])).toBeTypeOf('string');
    expect(blockDigest(source, [{ file: testFile, fullName: '[REQ-012] 乙 を検査する', status: 'passed' }])).toBeTypeOf('string');
  });
  it('[REQ-189] 同じ名前のブロックが複数あれば、どれが変わっても無効にする', () => {
    const twice = file(target, target.replace('expect(value)', 'expect(second)'));
    const review = blockReview(twice);
    expect(audit(review, twice).rows[0].status).toBe('reviewed');
    expect(audit(review, file(target, target.replace('expect(value)', 'expect(third)'))).rows[0].status).toBe('invalid');
  });
  it('[REQ-189] 文字列・コメント・正規表現の括弧と、型引数・別名の試験関数を読み違えない', () => {
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
  ])('[REQ-189] 本文ブロックを特定できないとき（%s）は無効にする', (_, source) => {
    const review = blockReview();
    const result = audit(review, source);
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文ブロックを特定できません');
  });
  it('[REQ-189] ヘルパー経由の本物の試験と it(`${n}`) が同じファイルにあるとき、本物の本文の変更で無効になる', () => {
    const helper = (assertion: string) => `const check = (name: string) => it(name, () => { expect(${assertion}).toBe(true); });\ncheck('[REQ-012] 条件を検査する');\nfor (const n of ['a']) it(\`\${n}\`, () => {});\n`;
    const tests = [{ file: testFile, fullName: '[REQ-012] 条件を検査する', status: 'passed' }];
    expect(blockDigest(helper('value'), tests)).toBeUndefined();
    const recorded = { ...blockReview(), tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256('記録時の本文'), hashScope: 'block' }] };
    const result = auditScenarios(rows(), [recorded], tests, { [testFile]: helper('changed') });
    expect(result.rows[0].status).toBe('invalid');
    expect(result.rows[0].reason).toContain('本文ブロックを特定できません');
  });
  it("[REQ-189] '%s' だけのブロックの変更が別の試験を無効にしない", () => {
    const each = (value: string) => `  it.each(['x'])('%s', (v) => { expect(v).toBe('${value}'); });`;
    const review = blockReview(file(target, each('x')));
    const result = audit(review, file(target, each('y')));
    expect(result.rows[0].status).toBe('reviewed');
  });
  it('[REQ-189] 不明な hashScope と、旧形式のファイル全体のハッシュの違いを無効にする', () => {
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
  const prepare = (reviews: unknown[]) => {
    root = mkdtempSync(join(tmpdir(), 'scenario-audit-'));
    for (const [path, text] of [['openspec/specs/x/spec.md', spec()], ['openspec/changes/c1/specs/x/spec.md', '## ADDED Requirements\n' + spec('変更中')], [testFile, file()], ['scripts/scenario-audit.mjs', readFileSync('scripts/scenario-audit.mjs', 'utf8')]]) {
      mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text);
    }
    writeFileSync(join(root, 'report.json'), JSON.stringify({ testResults: [{ name: testFile, assertionResults: run() }] }));
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
});
