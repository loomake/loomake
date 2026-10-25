import { describe, expect, it } from 'vitest';
import { inventoryScenarios, auditScenarios, renderAudit, sha256 } from '../scripts/scenario-audit.mjs';
const spec = (scenario = '条件', rule = '規則を守る SHALL。') => `### Requirement: 振る舞い\n${rule}\nSource: REQ-012\n#### Scenario: ${scenario}\n- **WHEN** 条件\n- **THEN** 結果\n`;
const rows = () => inventoryScenarios('openspec/specs/x/spec.md', spec());
const testFile = 'tests/fixture.test.ts';
const source = "it('[REQ-012] 条件を検査する',()=>{expect(value).toBe(true)})";
const report = (status = 'passed') => [{ file: testFile, fullName: '[REQ-012] 条件を検査する', status }];
const review = () => ({ id: rows()[0].id, status: 'reviewed', scenarioSha256: rows()[0].sha256, reason: '条件を与えて結果をassertする', sources: ['REQ-012'], tests: [{ file: testFile, contains: '条件を検査する', sha256: sha256(source) }] });
const audit = (reviews: unknown[] = [], tests = report(), sources = { [testFile]: source }) => auditScenarios(rows(), reviews, tests, sources);

describe('Scenarioの同一性', () => {
  it('[REQ-188] 別Requirementの同名を分け、コード例を数えない', () => {
    const text = spec() + '\n```md\n' + spec('コード例') + '\n```\n' + spec().replace('振る舞い', '別の振る舞い');
    const result = inventoryScenarios('file', text); expect(result).toHaveLength(2); expect(result[0].id).not.toBe(result[1].id); expect(result[0].sources).toEqual(['REQ-012']); expect(result[0].line).toBe(4);
  });
  it('[REQ-188] 文書が違えば同名でも別にする', () => { expect(inventoryScenarios('one', spec())[0].id).not.toBe(inventoryScenarios('two', spec())[0].id); });
  it('[REQ-188] 行の移動は同一性を保ち、規則の変更はハッシュを変える', () => {
    const before = rows()[0]; const moved = inventoryScenarios('openspec/specs/x/spec.md', '\n\n' + spec())[0]; const changed = inventoryScenarios('openspec/specs/x/spec.md', spec('条件', '別の規則 SHALL。'))[0];
    expect(moved.id).toBe(before.id); expect(moved.sha256).toBe(before.sha256); expect(moved.line).toBe(6); expect(changed.id).toBe(before.id); expect(changed.sha256).not.toBe(before.sha256);
  });
  it('[REQ-188] 規則のコード例の変更も検出し、例のSourceを混同しない', () => {
    const withExample = spec().replace('Source: REQ-012', '```md\nSource: REQ-999\nexample one\n```\nSource: REQ-012');
    const first = inventoryScenarios('file', withExample)[0];
    const changed = inventoryScenarios('file', withExample.replace('example one', 'example two'))[0];
    expect(first.sources).toEqual(['REQ-012']); expect(first.sha256).not.toBe(changed.sha256);
  });
  it.each([spec() + spec(), spec().replace('Source: REQ-012', ''), spec() + '\n```', '#### Scenario: 先にある\n' + spec()])('[REQ-188] 不明な同一性や構造を拒否する #%#', (text) => { expect(() => inventoryScenarios('file', text)).toThrow(); });
});

const removed = '## REMOVED Requirements\n\n### Requirement: 廃止する振る舞い\n**Reason**: 新しい振る舞いに置き換える\n**Migration**: 追加した要件へ移行する\nSource: REQ-012\n';

describe('削除指示を含む差分仕様', () => {
  it.each(['ADDED', 'MODIFIED'])('[REQ-188] 削除と%sの混在では有効なScenarioのIDと内容ハッシュを保つ', (operation) => {
    const active = `## ${operation} Requirements\n\n${spec()}`;
    const [expected] = inventoryScenarios('file', active);
    for (const text of [removed + '\n' + active, active + '\n' + removed]) {
      const result = inventoryScenarios('file', text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: expected.id, sha256: expected.sha256, scenario: '条件', sources: ['REQ-012'] });
    }
  });
  it('[REQ-188] 削除指示だけの文書は空の一覧を返す', () => {
    expect(inventoryScenarios('file', removed)).toEqual([]);
  });
  it('[REQ-188] 削除指示に残った古いScenarioを一覧に含めない', () => {
    const text = removed + '#### Scenario: 古い条件\n- **WHEN** 古い条件\n- **THEN** 古い結果\n\n## ADDED Requirements\n' + spec();
    const result = inventoryScenarios('file', text);
    expect(result.map((row) => row.scenario)).toEqual(['条件']);
  });
  it.each(['Requirements', 'ADDED Requirements', 'MODIFIED Requirements'])('[REQ-188] %sの通常要件にScenarioがなければ拒否する', (heading) => {
    const text = `## ${heading}\n\n### Requirement: 不足\n規則を守る SHALL。\nSource: REQ-012\n`;
    expect(() => inventoryScenarios('file', text)).toThrow('Scenarioがありません');
  });
  it('[REQ-188] コード例のREMOVED見出しを実際の節と混同しない', () => {
    const text = '## ADDED Requirements\n\n```md\n' + removed + '```\n\n' + spec();
    const [before] = inventoryScenarios('file', '## ADDED Requirements\n' + spec());
    const [after] = inventoryScenarios('file', text);
    expect(after).toMatchObject({ id: before.id, sha256: before.sha256 });
  });
  it.each(['', '## REMOVED Requirements\n'])('[REQ-188] 要件も削除指示もない文書を有効な削除と混同しない #%#', (text) => {
    expect(() => inventoryScenarios('file', text)).toThrow('Scenarioを読み取れません');
  });
});

describe('試験との対応の根拠', () => {
  it('[REQ-189] IDの一致だけでは候補で、確認済みにしない', () => { const result = audit(); expect(result.ok).toBe(false); expect(result.rows[0].status).toBe('unreviewed'); expect(result.rows[0].candidates).toHaveLength(1); });
  it('[REQ-189] 対応理由と内容・試験のハッシュと成功結果を認める', () => { const result = audit([review()]); expect(result.ok).toBe(true); expect(result.rows[0].status).toBe('reviewed'); expect(result.rows[0].tests).toHaveLength(1); });
  it.each(['failed', 'pending', 'todo', 'skipped'])('[REQ-189] %sを成功した一部だけで覆い隠さない', (status) => {
    const result = audit([review()], [...report(), { ...report()[0], fullName: '[REQ-012] 条件を検査する 別の実行', status }]); expect(result.ok).toBe(false); expect(result.rows[0].status).toBe('invalid');
  });
  it.each([
    { reason: '' }, { scenarioSha256: 'old' }, { tests: [] }, { sources: ['REQ-099'] },
    { tests: [{ file: testFile, contains: 'ない試験', sha256: sha256(source) }] },
    { tests: [{ file: testFile, contains: '条件を検査する', sha256: 'old' }] },
  ])('[REQ-189] 不足・古い根拠を認めない #%#', (patch) => { const result = audit([{ ...review(), ...patch }]); expect(result.rows[0].status).toBe('invalid'); expect(result.ok).toBe(false); });
  it('[REQ-189] 古いテストソースとSourceのない選択を拒否する', () => {
    expect(audit([review()], report(), { [testFile]: source + '// change' }).ok).toBe(false);
    expect(audit([review()], [{ ...report()[0], fullName: '条件を検査する' }]).ok).toBe(false);
  });
});

describe('不足と置換の表示', () => {
  it('[REQ-190] 未確認と行番号・理由をMarkdownへ残す', () => { const result = audit(); const markdown = renderAudit(result); expect(markdown).toContain('unreviewed'); expect(markdown).toContain('spec.md:4'); expect(markdown).toContain('振る舞い'); expect(markdown).toContain('条件'); expect(result.counts.unreviewed).toBe(1); });
  it('[REQ-190] 文書内のHTMLを実行可能な形で埋め込まない', () => {
    const list = inventoryScenarios('file', spec('<img src=x onerror=alert(1)>'));
    const markdown = renderAudit(auditScenarios(list, [], [], {}));
    expect(markdown).not.toContain('<img'); expect(markdown).toContain('&lt;img');
  });
  it('[REQ-190] 重複と未知の参照を報告する', () => { const result = audit([review(), review(), { ...review(), id: 'unknown' }]); expect(result.ok).toBe(false); expect(result.issues.length).toBeGreaterThanOrEqual(2); });
  it('[REQ-190] 確認済みへの置換だけを認める', () => {
    const other = inventoryScenarios('other', spec())[0]; const replacement = { ...review(), id: other.id, scenarioSha256: other.sha256 };
    const result = auditScenarios([...rows(), other], [{ id: rows()[0].id, status: 'superseded', scenarioSha256: rows()[0].sha256, reason: '変更後の条件で確認する', replacement: other.id }, replacement], report(), { [testFile]: source });
    expect(result.ok).toBe(true); expect(result.counts.superseded).toBe(1);
  });
  it('[REQ-190] 循環と存在しない置換を拒否する', () => {
    const row = rows()[0];
    for (const replacement of [row.id, 'missing']) { expect(audit([{ id: row.id, status: 'superseded', scenarioSha256: row.sha256, reason: '置換', replacement }]).rows[0].status).toBe('invalid'); }
  });
});
