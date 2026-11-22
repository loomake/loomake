import { describe, expect, it } from 'vitest';
import { formatEfficiencySection, type EfficiencyRow, type EfficiencyTable } from '../src/index.js';

const HEADING = '## 開発効率（推定との差。人力実測との比較ではない）';
const HEADER = '| change | 比較方式 | 推定（最小〜最大） | Loomake 利用時の人の実績 | 推定に対する削減率 | 比較の種類 | 判断要求 | 試行 | 費用 |';
const miss = (reason = '記録なし') => ({ status: 'missing' as const, reason });
const row = (over: Partial<EfficiencyRow> = {}): EfficiencyRow => ({
  group: 'estimate', change: 'add-x', baseline: { status: 'value', value: 'human' },
  estimate: { status: 'value', value: { minMinutes: 1440, maxMinutes: 3480 } },
  actual: { status: 'value', value: { totalMinutes: 1620 } },
  reduction: { status: 'value', value: { lowerPermille: -125, upperPermille: 534 } },
  comparison: { status: 'value', value: 'estimate' }, decisions: { status: 'value', value: 3 }, attempts: miss(),
  cost: miss('費用の記録がありません'), sources: { manual: [{ path: 'docs/effort/c-001.md', sha256: 'f'.repeat(64), lines: [12, 20] }], effort: ['.loomake/evidence/add-x/effort/20261106T010203Z-aaaaaaaaaaaa.json'] },
  ...over,
});
const table = (...rows: EfficiencyRow[]): EfficiencyTable => ({ rows });
const lines = (rows: EfficiencyRow[]) => formatEfficiencySection(table(...rows)).split('\n');

describe('開発効率の表の整形', () => {
  it('[REQ-468] 見出しと9列は7.8と同じ文字で、日時を含まず、末尾は改行1つ', () => {
    const text = formatEfficiencySection(table(row()));
    const out = text.split('\n');
    expect([out[0], out[2], out[3]]).toEqual([HEADING, HEADER, '|---|---|---|---|---|---|---|---|---|']);
    expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T|生成/);
  });
  it('[REQ-468] 各セルは推定・実績・削減率・比較・費用を決めた書式で表示し、欠測は不明（理由）と書く', () => {
    const cells = lines([row()])[4]!.split(' | ').map((c) => c.replace(/^\| | \|$/g, ''));
    expect(cells).toEqual(['add-x', 'AI なしの人力', '1440〜3480分', '1620分', '-12.5%〜53.4%', '推定との比較・人力実測なし', '3', '不明（記録なし）', '不明（費用の記録がありません）']);
  });
  it('[REQ-468] 幅0の推定と削減率は1点で示し、部分計は以上と内訳不明を付ける', () => {
    const out = lines([row({
      estimate: { status: 'value', value: { minMinutes: 100, maxMinutes: 100 } }, reduction: { status: 'value', value: { lowerPermille: 130, upperPermille: 130 } },
      actual: { status: 'partial', known: { totalMinutes: 30 }, reason: '一部の記録は区分の一部だけで、内訳不明です' },
      decisions: { status: 'partial', known: 2, reason: '一部の記録に判断要求がありません' } })])[4]!;
    expect(out).toContain('| 100分 |');
    expect(out).toContain('| 部分計 30分以上（内訳不明） |');
    expect(out).toContain('| 13.0%（幅なし） |');
    expect(out).toContain('| 部分計 2以上（一部欠測） |');
  });
  it('[REQ-468] 推定に幅があれば、削減率の下限と上限が同じでも「幅なし」と付けない', () => {
    const out = lines([row({ actual: { status: 'value', value: { totalMinutes: 0 } }, reduction: { status: 'value', value: { lowerPermille: 1000, upperPermille: 1000 } } })])[4]!;
    expect(out).toContain('| 1440〜3480分 |');
    expect(out).toContain('| 100.0% |');
    expect(out).not.toContain('幅なし');
  });
  it('[REQ-468] 費用は区分ごとに実額・推計・トークンを書き、セントは小数の計算なしにドルへ直す', () => {
    const cost = { status: 'value' as const, value: {
      'actual-usd': { status: 'value' as const, value: 125 }, 'estimated-usd': { status: 'value' as const, value: 5 }, tokens: { status: 'partial' as const, known: 12000, reason: '一部' } } };
    expect(lines([row({ cost })])[4]).toContain('| 実額 $1.25 / 推計 $0.05 / トークン 12000以上（一部欠測） |');
  });
  it('[REQ-468] 出典を表の後に、手書き記録のpath・SHA-256・行番号とEffortのファイル名の辞書順で並べる', () => {
    const text = formatEfficiencySection(table(row(), row({ change: 'b', sources: { manual: [], effort: ['.loomake/evidence/add-x/effort/20261106T010203Z-aaaaaaaaaaaa.json'] } })));
    const tail = text.slice(text.indexOf('### 出典'));
    expect(tail).toBe(`### 出典\n\n- docs/effort/c-001.md（SHA-256 ${'f'.repeat(64)}、行 12, 20）\n- .loomake/evidence/add-x/effort/20261106T010203Z-aaaaaaaaaaaa.json\n`);
  });
  it('[REQ-468] 推定行も実績行もない手書き記録の出典は、行の部分を省いて SHA-256 だけを示す（Q-P2-08）', () => {
    const text = formatEfficiencySection(table(row({ sources: { manual: [{ path: 'docs/effort/e.md', sha256: 'e'.repeat(64), lines: [] }], effort: [] } })));
    expect(text.slice(text.indexOf('### 出典'))).toBe(`### 出典\n\n- docs/effort/e.md（SHA-256 ${'e'.repeat(64)}）\n`);
  });
  it('[REQ-468] 記録がなければ表の本体を空にし、出典はなしとする', () => {
    expect(formatEfficiencySection(table())).toBe(`${HEADING}\n\n${HEADER}\n|---|---|---|---|---|---|---|---|---|\n\n### 出典\n\n- なし\n`);
  });
  it('[REQ-468] バーティカルバー・バックスラッシュ・改行・制御文字をエスケープし、秘密の形を置換し、2回の出力が一致する', () => {
    const secret = 'sk-' + 'a'.repeat(24);
    const t = table(row({ change: `a|b\\c\nd\u0007e ${secret}`, estimate: miss('理由|あり') }));
    const out = formatEfficiencySection(t);
    const body = out.split('\n')[4]!;
    expect(body.startsWith('| a\\|b\\\\c\\u{000A}d\\u{0007}e ')).toBe(true);
    expect(body).toContain('不明（理由\\|あり）');
    expect(out).not.toContain(secret);
    expect(out.split('\n').filter((l) => l.startsWith('| ')).length).toBe(2);
    expect(formatEfficiencySection(t)).toBe(out);
  });
});
