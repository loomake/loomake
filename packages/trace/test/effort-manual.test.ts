import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseManualEffort } from '../src/index.js';

const PATH = 'docs/effort/sample.md';
const BASICS = { 対象: 'C-009', change: 'add-x', 比較の種類: '推定との比較・人力実測なし', 比較方式: 'AI なしの人力', 作業範囲: '実装' };
type Parts = { basics?: Record<string, string>; estimate?: string[]; rows?: string[][]; omit?: string };
const table = (head: string[], rows: string[][]) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const ACTUAL_HEAD = ['日', '指示', 'レビュー', '手直し', '実行', '待機', 'うち判断根拠を探す時間', '判断要求', '試行', '費用', 'メモ'];
const row = (cells: Record<string, string>) => ACTUAL_HEAD.map((h) => cells[h] ?? '');
function doc({ basics = BASICS, estimate = ['24 時間', '58 時間', '内訳', '人', '2026-10-26'], rows = [], omit }: Parts = {}): string {
  const sections: Record<string, string> = {
    記録の基本: table(['項目', '値'], Object.entries(basics).map(([k, v]) => [k, v])),
    事前の推定: table(['最小', '最大', '根拠', '推定した人', '推定した日'], [estimate]),
    実績: table(ACTUAL_HEAD, rows),
  };
  return Object.entries(sections).filter(([k]) => k !== omit).map(([k, v]) => `## ${k}\n\n${v}\n`).join('\n');
}
const parse = (text: string | Buffer) => parseManualEffort(PATH, Buffer.from(text));
const est = (min: string, max = '58 時間') => parse(doc({ estimate: [min, max, '根拠', '人', '2026-10-26'] })).estimate;

describe('手書きの効率記録の読取り', () => {
  it('[REQ-467] 手書きの時間の字句を整数分へ正確に変換する', () => {
    for (const [text, minutes] of [['24 時間', 1440], ['90分', 90], ['1.5h', 90], ['0分', 0], ['5m', 5], ['0.05時間', 3]] as const) {
      expect(est(text), text).toMatchObject({ minMinutes: minutes });
    }
  });
  it('[REQ-467] 読めない時間はその欄の問題として返し、推定を欠測にする', () => {
    for (const text of ['24時', '1,5時間', '１分', '01分', '24', '（時間）', '24  時間', '100001分', '1e2m', '-1m']) {
      const record = parse(doc({ estimate: [text, '58 時間', '根拠', '人', '2026-10-26'] }));
      expect(record.estimate, text).toHaveProperty('missing');
      expect(record.problems.length, text).toBeGreaterThan(0);
    }
  });
  it('[REQ-467] C-001 の実ファイルは推定 1440〜3480 分・人力・change 未作成・実績なしで読める', () => {
    const bytes = readFileSync(new URL('../../../docs/effort/c-001.md', import.meta.url));
    const record = parseManualEffort('docs/effort/c-001.md', bytes);
    expect(record).toMatchObject({ comparison: 'estimate', baseline: 'human', estimate: { minMinutes: 1440, maxMinutes: 3480 }, actuals: [], problems: [] });
    expect(record.change).toEqual({ status: 'unmapped', reason: 'change 未作成' });
    expect(record.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
  it('[REQ-467] 記録の基本は完全一致だけを選択として受け付け、未選択は理由つきの問題にする', () => {
    const ok = parse(doc({ basics: { ...BASICS, 比較の種類: '人力実測あり', 比較方式: '人が AI を操作する方式' } }));
    expect(ok).toMatchObject({ comparison: 'measured', baseline: 'ai-assisted', change: { status: 'single', id: 'add-x' }, problems: [] });
    const bad = parse(doc({ basics: { ...BASICS, 比較の種類: '推定との比較・人力実測なし ／ 人力実測あり', 比較方式: '' } }));
    expect(bad).toMatchObject({ comparison: null, baseline: null });
    expect(bad.problems).toHaveLength(2);
  });
  it('[REQ-467] change は有効な id 1 つだけを対応させ、複数・括弧書き・archive は未対応にする', () => {
    for (const text of ['add-x、add-y', 'add-x, add-y', 'add-x（仮）', 'archive', '', '未作成']) {
      expect(parse(doc({ basics: { ...BASICS, change: text } })).change, text).toMatchObject({ status: 'unmapped' });
    }
  });
  it('[REQ-467] 節・必須列の欠落、項目の重複、セル数の違い、推定の 0 行と複数行は行番号つきの問題になる', () => {
    expect(parse(doc({ omit: '実績' }))).toMatchObject({ actuals: { invalid: expect.any(String) } });
    expect(parse(doc({ omit: '事前の推定' })).estimate).toHaveProperty('missing');
    const dup = parse(doc({ basics: BASICS }).replace('| 対象 |', '| 比較方式 | 人が AI を操作する方式 |\n| 対象 |'));
    expect(dup.baseline).toBeNull();
    const wide = parse(doc({ rows: [[...row({ 日: '2026-11-06', 指示: '10分' }), '余分']] }));
    expect(wide.actuals).toHaveProperty('invalid');
    expect(wide.problems[0]?.line).toBeGreaterThan(1);
    const two = parse(doc().replace('| 24 時間 |', '| 1 時間 | 2 時間 | 根拠 | 人 | 2026-10-26 |\n| 24 時間 |'));
    expect(two.estimate).toHaveProperty('missing');
    expect(parse(doc({ estimate: ['1 時間', '2 時間', '', '人', '2026-10-26'] })).estimate).toHaveProperty('missing');
    expect(parse(doc({ estimate: ['1 時間', '2 時間', '根拠', '人', 'YYYY-MM-DD'] })).estimate).toHaveProperty('missing');
    expect(parse(doc({ estimate: ['1 時間', '2 時間', '根拠', '人', '2026-02-30'] })).estimate).toHaveProperty('missing');
  });
  it('[REQ-467] 実績の行は空欄を欠測、0 分を観測値の 0 とし、費用は CLI の文法だけで読む', () => {
    const { actuals } = parse(doc({ rows: [row({ 日: '2026-11-06', 指示: '30分', レビュー: '0分', うち判断根拠を探す時間: '10分', 判断要求: '03', 試行: '2', 費用: 'actual-usd:1.25,tokens:100', メモ: 'x' })] }));
    expect(actuals).toEqual([{ source: { path: PATH, line: 21 }, minutes: { instruct: 30, review: 0, search: 10 }, decisions: 3, attempts: 2, cost: [{ kind: 'actual-usd', cents: 125 }, { kind: 'tokens', count: 100 }] }]);
  });
  it('[REQ-467] 読めない費用はその行の費用だけを欠測にし、実績は保つ', () => {
    const record = parse(doc({ rows: [row({ 日: '2026-11-06', 指示: '30分', 費用: '約 3 ドル' })] }));
    expect(record.actuals).toMatchObject([{ minutes: { instruct: 30 } }]);
    expect(record.actuals).not.toMatchObject([{ cost: expect.anything() }]);
    expect(record.problems).toHaveLength(1);
  });
  it('[REQ-467] 不正な行が 1 つでもあれば、行を落とさず実績全体を算出不能にする', () => {
    for (const bad of [row({ 日: '2026-11-06' }), row({ 日: '2026-13-01', 指示: '1分' }), row({ 日: '2026-11-06', 指示: '1分', うち判断根拠を探す時間: '2分' }), row({ 日: '2026-11-06', 指示: '1分', 試行: '1.5' }), row({ 日: '2026-11-06', 指示: '1時' })]) {
      const record = parse(doc({ rows: [row({ 日: '2026-11-05', 指示: '1分' }), bad] }));
      expect(record.actuals).toHaveProperty('invalid');
      expect(record.problems).toHaveLength(1);
    }
  });
  it('[REQ-467] BOM・CRLF つきは同じ値で原本 bytes の SHA-256 を持ち、不正な UTF-8 は問題として欠測にする', () => {
    const text = doc({ rows: [row({ 日: '2026-11-06', 指示: '5分' })] });
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text.replace(/\n/g, '\r\n'))]);
    const record = parse(bytes);
    expect(record.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect({ ...record, sha256: '' }).toEqual({ ...parse(text), sha256: '' });
    const broken = parse(Buffer.concat([Buffer.from(text), Buffer.from([0x80, 0xe3])]));
    expect(broken.problems).toEqual([{ file: PATH, line: 1, message: 'UTF-8 として読めません' }]);
    expect(broken.estimate).toHaveProperty('missing');
    expect(broken.actuals).toHaveProperty('invalid');
  });
  it('[REQ-467] 問題の文言にセルの原文を含めない', () => {
    const secret = 'sk-' + 'a'.repeat(20);
    const record = parse(doc({ estimate: [secret, secret, secret, secret, secret], rows: [row({ 日: secret, 費用: secret })] }));
    expect(JSON.stringify(record.problems)).not.toContain(secret);
  });
});
