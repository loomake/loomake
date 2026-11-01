import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, posix, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
// Windows の checkout で改行が CRLF になっても同じに読む
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

/** Markdown の見出し（## 以降）の名前の一覧 */
function headings(markdown: string, level: number): string[] {
  const mark = '#'.repeat(level);
  return markdown.split('\n').filter((line) => line.startsWith(`${mark} `)).map((line) => line.slice(level + 1).trim());
}

/** 見出し `## <name>` から次の `## ` の前までの本文 */
function section(markdown: string, name: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line === `## ${name}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** 本文の相対リンクの先（コードを除く） */
function links(markdown: string): string[] {
  const text = markdown.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target).filter((t) => !/^([a-z][a-z0-9+.-]*:|#)/i.test(t));
}

function git(...args: string[]) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

const ADR_HEADINGS = ['決定', '検討した選択肢', '理由', '適用範囲', '見直す条件'];

// 4 つの決定と、それを残した ADR
const ADRS = [
  { topic: '版管理の方式', file: 'docs/adr/0001-versioning-with-changesets.md', keyword: 'changesets' },
  { topic: '0.x の互換性の方針', file: 'docs/adr/0002-breaking-changes-in-0x.md', keyword: '0.x' },
  { topic: 'core の実行時依存', file: 'docs/adr/0003-zod-as-core-runtime-dependency.md', keyword: 'Zod' },
  { topic: '開発の技術スタック', file: 'docs/adr/0004-keep-development-stack.md', keyword: '技術スタック' },
];

describe('版管理と互換性の方針の記載', () => {
  const contributing = read('CONTRIBUTING.md');
  const policy = section(contributing, '版と互換性');

  it('[REQ-227][REQ-228] CONTRIBUTING.md に版管理の方式と 0.x の互換性の方針が書かれ、それぞれに ADR へのリンクがある', () => {
    const paragraphs = policy.split(/\n\s*\n/);
    const versioning = paragraphs.find((p) => p.includes('changesets'));
    const compatibility = paragraphs.find((p) => p.includes('`0.x`') && p.includes('破壊的変更'));
    expect(versioning, '版管理の方式の段落').toBeDefined();
    expect(compatibility, '0.x の互換性の方針の段落').toBeDefined();
    expect(links(versioning ?? '')).toContain('docs/adr/0001-versioning-with-changesets.md');
    expect(links(compatibility ?? '')).toContain('docs/adr/0002-breaking-changes-in-0x.md');
  });

  it('[REQ-227][REQ-228] CONTRIBUTING.md からたどった ADR のファイルがリポジトリにある', () => {
    const adrLinks = links(policy).filter((target) => target.startsWith('docs/adr/'));
    expect(adrLinks.length).toBeGreaterThanOrEqual(2);
    for (const target of adrLinks) expect(existsSync(resolve(root, target.split('#')[0])), target).toBe(true);
  });
});

describe('設計判断の ADR', () => {
  it.each(ADRS)('[REQ-234] $topic の ADR がある', ({ file, keyword }) => {
    expect(existsSync(join(root, file)), file).toBe(true);
    const [title] = headings(read(file), 1);
    expect(title).toContain(keyword);
    // ADR の一覧からもたどれる
    expect(links(read('docs/adr/README.md')).map((t) => posix.join('docs/adr', t))).toContain(file);
  });

  it.each(ADRS)('[REQ-234] $topic の ADR に、決定・検討した選択肢・理由・適用範囲・見直す条件の見出しがある', ({ file }) => {
    const markdown = read(file);
    expect(headings(markdown, 2)).toEqual(ADR_HEADINGS);
    for (const name of ADR_HEADINGS) expect(section(markdown, name), name).not.toBe('');
  });

  it('[REQ-234] ADR の雛形は、決定・検討した選択肢・理由・適用範囲・見直す条件の見出しを持つ', () => {
    expect(headings(read('docs/adr/template.md'), 2)).toEqual(ADR_HEADINGS);
  });
});

describe('開発効率の手書きの記録様式', () => {
  it('[REQ-229] 様式に、比較の種類・比較方式・作業範囲・推定の最小・最大・根拠・指示・レビュー・手直し・実行・待機の時間の欄がある', () => {
    const template = read('docs/effort/template.md');
    const basics = section(template, '記録の基本');
    for (const field of ['比較の種類', '比較方式', '作業範囲']) expect(basics, field).toMatch(new RegExp(`^\\| ${field} \\|`, 'm'));
    const [estimateHeader] = section(template, '事前の推定').split('\n').filter((line) => line.startsWith('|'));
    for (const field of ['最小', '最大', '根拠']) expect(estimateHeader, field).toContain(`| ${field} |`);
    const [actualHeader] = section(template, '実績').split('\n').filter((line) => line.startsWith('|'));
    for (const field of ['指示', 'レビュー', '手直し', '実行', '待機']) expect(actualHeader, field).toContain(`| ${field} |`);
  });
});

describe('C-001 の事前見積もり', () => {
  const RECORD = 'docs/effort/c-001.md';
  // 記録を最初に足したコミット
  const added = git('log', '--diff-filter=A', '--format=%H', '--', RECORD).stdout.trim().split('\n').filter(Boolean).at(-1);

  it('[REQ-230] C-001 の推定は、C-001 の change の最初のコミットより前のコミットで記録されている', () => {
    expect(added, `${RECORD} を足したコミット`).toMatch(/^[0-9a-f]{40}$/);
    const estimate = section(read(RECORD), '事前の推定');
    expect(estimate).toMatch(/^\| \d+ 時間 \| \d+ 時間 \| \S/m);
    // change を作ったら、記録の基本の表に change ID を書く。書いてあれば、その change の最初のコミットと順番を比べる
    const change = /^\| change \| (.+?) \|$/m.exec(section(read(RECORD), '記録の基本'))?.[1];
    expect(change).toBeDefined();
    if (change === '未作成') return;
    const first = git('log', '--format=%H', '--', `openspec/changes/${change}`, `openspec/changes/archive/*-${change}`).stdout.trim().split('\n').filter(Boolean).at(-1);
    expect(first, `change ${change} のコミット`).toMatch(/^[0-9a-f]{40}$/);
    expect(first).not.toBe(added);
    expect(git('merge-base', '--is-ancestor', added ?? '', first ?? '').status).toBe(0);
  });

  it('[REQ-230] 推定の最小・最大・根拠の欄は、記録したときから書き換えていない', () => {
    expect(added).toMatch(/^[0-9a-f]{40}$/);
    const before = git('show', `${added}:${RECORD}`);
    expect(before.status, before.stderr).toBe(0);
    expect(section(read(RECORD), '事前の推定')).toBe(section(before.stdout, '事前の推定'));
  });
});

const DELIVERY_METRICS = [
  ['M1', '実装前に見つかった確認事項の数'],
  ['M2', '仕様ゲートで止まった回数'],
  ['M3', 'マージ後の手戻りの数'],
  ['M4', '1 change あたりの時間'],
  ['M5', 'AI コスト'],
];
const DEFINITION_COLUMNS = ['ID', '項目', '定義', '単位', '基準時点・観測期間', '取得元', '記録先', '欠測の扱い', 'Loomakeなしの場合'];
const RECORD_COLUMNS = ['ID', '項目', '値', '単位', '状態', '取得元', '観測期間', '理由', '観測を終える日'];

/** 文書の表を読み、欠けた列やセル数の不一致を検出する。 */
function metricTable(markdown: string, columns: string[]): string[][] {
  const cells = (line: string) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith('|') && JSON.stringify(cells(line)) === JSON.stringify(columns));
  if (start < 0 || !/^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[start + 1] ?? '')) throw new Error('必要な表の列がありません');
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const row = cells(line);
    if (row.length !== columns.length) throw new Error('表のセル数が列と合いません');
    rows.push(row);
  }
  return rows;
}

function definitionErrors(markdown: string): string[] {
  const rows = metricTable(section(markdown, '計測項目'), DEFINITION_COLUMNS);
  const errors = [];
  if (JSON.stringify(rows.map((row) => row.slice(0, 2))) !== JSON.stringify(DELIVERY_METRICS)) errors.push('5項目の名前と行');
  for (const row of rows) if (row.some((cell) => !cell)) errors.push(`${row[0]}: 属性の空欄`);
  return errors;
}

/** REQ-364/365の状態ごとの規則を、文書から読んだ記録行に適用する。 */
function measurementErrors(markdown: string): string[] {
  const rows = metricTable(section(markdown, '柱1の計測'), RECORD_COLUMNS);
  const errors = [];
  if (JSON.stringify(rows.map((row) => row.slice(0, 2))) !== JSON.stringify(DELIVERY_METRICS)) errors.push('5項目の名前と行');
  for (const [id, , value, unit, state, source, period, reason, end] of rows) {
    if (!['記録あり', '不明', '非該当', '観測中'].includes(state!)) errors.push(`${id}: 状態`);
    else if (state === '記録あり') {
      if (![value, unit, source, period].every(Boolean)) errors.push(`${id}: 記録ありの必須欄`);
    } else {
      if (value) errors.push(`${id}: 未確定の値`);
      if (state === '観測中' ? !end : !reason) errors.push(`${id}: 理由か終了日`);
    }
  }
  return errors;
}

const tableText = (columns: string[], rows: string[][]) => [columns, columns.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
const exampleRows = () => [
  ['M1', DELIVERY_METRICS[0]![1]!, '0', '件', '記録あり', '実装直前の問いの表', '実装着手の親', '', ''],
  ['M2', DELIVERY_METRICS[1]![1]!, '', '回', '非該当', '', '', '仕様ゲートがないため', ''],
  ['M3', DELIVERY_METRICS[2]![1]!, '', '件', '観測中', '', '', '', '2026-11-15'],
  ['M4', DELIVERY_METRICS[3]![1]!, '(a)30 / (b)2', '(a)分 / (b)時間', '記録あり', '実績表と開始・マージ日時', '要件書読取からマージ', '', ''],
  ['M5', DELIVERY_METRICS[4]![1]!, '', '', '不明', '', '', 'ツールの費用表示を取得していない', ''],
];
const exampleRecord = (rows = exampleRows()) => `## 柱1の計測\n\n${tableText(RECORD_COLUMNS, rows)}\n`;

describe('柱1の計測の定義と記録様式', () => {
  it('[REQ-364] 5項目の定義がそろい、各項目の6属性が空でない', () => {
    const definitions = read('docs/metrics/delivery-metrics.md');
    expect(definitionErrors(definitions)).toEqual([]);
    const rows = metricTable(section(definitions, '計測項目'), DEFINITION_COLUMNS);
    for (let index = 0; index < DELIVERY_METRICS.length; index++) {
      const missing = rows.filter((_, i) => i !== index);
      expect(definitionErrors(`## 計測項目\n${tableText(DEFINITION_COLUMNS, missing)}`), `M${index + 1}が欠けた表`).not.toEqual([]);
    }
    for (let column = 2; column <= 7; column++) {
      const missing = rows.map((row) => [...row]);
      missing[0]![column] = '';
      expect(definitionErrors(`## 計測項目\n${tableText(DEFINITION_COLUMNS, missing)}`), DEFINITION_COLUMNS[column]).not.toEqual([]);
    }
    expect(rows[0]!.join(' ')).toContain('最初の実装コミットの親');
    expect(rows[1]!.join(' ')).toContain('同じSHA・同じ失敗項目の組');
    expect(rows[2]!.join(' ')).toContain('14日間');
    for (const category of ['実額', '推計', '定額', 'トークンのみ']) expect(rows[4]!.join(' ')).toContain(category);
  });

  it('[REQ-364][REQ-365] 0と不明を区別し、4状態それぞれの正例を受け入れる', () => {
    expect(measurementErrors(exampleRecord())).toEqual([]);
    const rules = section(read('docs/metrics/delivery-metrics.md'), '状態と欠測');
    for (const state of ['記録あり', '不明', '非該当', '観測中']) expect(rules).toContain(`| ${state} |`);
    expect(rules).toContain('0を書けるのは記録ありのときだけ');
  });

  it.each([
    ['不明なのに0', 4, 2, '0'],
    ['非該当なのに0', 1, 2, '0'],
    ['観測中なのに0', 2, 2, '0'],
    ['観測中で終了日がない', 2, 8, ''],
    ['不明で理由がない', 4, 7, ''],
    ['非該当で理由がない', 1, 7, ''],
    ['記録ありで値がない', 0, 2, ''],
    ['記録ありで単位がない', 0, 3, ''],
    ['記録ありで取得元がない', 0, 5, ''],
    ['記録ありで観測期間がない', 0, 6, ''],
    ['定義にない状態', 0, 4, '未実施'],
  ] as const)('[REQ-364][REQ-365] 状態別の不正な記録「%s」を拒否する', (_, row, column, value) => {
    const rows = exampleRows();
    rows[row]![column] = value;
    expect(measurementErrors(exampleRecord(rows))).not.toEqual([]);
  });

  it('[REQ-364] FR-50の人の実績と費用に対応し、判断要求と試行は別の行である', () => {
    const mapping = metricTable(section(read('docs/metrics/delivery-metrics.md'), 'FR-50との対応'), ['柱1の項目', 'FR-50・7.8の欄', '対応と区別']);
    expect(mapping.map((row) => row.slice(0, 2))).toEqual([
      ['M4(a) 人の実作業時間', 'Loomake利用時の人の実績'], ['M5 AIコスト', '費用'],
      ['M1 確認事項の数', '判断要求とは別の項目'], ['M2 仕様ゲートの停止', '試行とは別の項目'],
    ]);
    expect(mapping.every((row) => Boolean(row[2]))).toBe(true);
  });

  it('[REQ-365] 様式の柱1節に5項目と比較の組・Loomakeの利用・規模があり、LoomakeなしのM2を非該当にできる', () => {
    const pillar = section(read('docs/effort/template.md'), '柱1の計測');
    for (const field of ['比較の組', 'Loomakeの利用', '規模']) expect(pillar).toContain(`| ${field} |`);
    const rows = metricTable(pillar, RECORD_COLUMNS);
    expect(rows.map((row) => row.slice(0, 2))).toEqual(DELIVERY_METRICS);
    expect(pillar).toContain('Loomakeを使わない記録のM2は、値を空、状態を非該当');
    expect(pillar).toContain('理由を「仕様ゲートがないため」');
    expect(measurementErrors(exampleRecord())).toEqual([]);
  });

  it('[REQ-365][REQ-229] 既存の欄・5区分・判断根拠の内数説明と固定推定の規則を保つ', () => {
    const template = read('docs/effort/template.md');
    const basics = section(template, '記録の基本');
    for (const name of ['対象', 'change', '比較の種類', '比較方式', '作業範囲']) expect(basics).toContain(`| ${name} |`);
    expect(section(template, '事前の推定')).toContain('| 最小 | 最大 | 根拠 | 推定した人 | 推定した日 |');
    expect(section(template, '実績')).toContain('| 日 | 指示 | レビュー | 手直し | 実行 | 待機 | うち判断根拠を探す時間 | 判断要求 | 試行 | 費用 | メモ |');
    expect(template).toContain('指示・レビューなどの時間の内訳として書き、合計には足さない');
    expect(template).toContain('推定の「最小」「最大」「根拠」は、コミットしたあとに書き換えない');
    expect(template).toContain('人力で実施した比較タスクの実績があるときだけ、比較の種類を「人力実測あり」にする');
  });

  it('[REQ-365] 実際の記録の柱1節を読み、各行の状態と必須欄を検査する', async () => {
    const { readdirSync } = await import('node:fs');
    const records = readdirSync(join(root, 'docs/effort'), { recursive: true }).filter((file) => file.endsWith('.md') && file !== 'template.md');
    for (const file of records) {
      const markdown = read(`docs/effort/${file}`);
      if (section(markdown, '柱1の計測')) expect(measurementErrors(markdown), file).toEqual([]);
    }
    expect(() => measurementErrors('## 柱1の計測\n値だけで表がない記録')).toThrow('必要な表の列がありません');
    expect(() => measurementErrors(exampleRecord().replace('| 状態 |', '| 記入欄 |'))).toThrow('必要な表の列がありません');
    expect(measurementErrors(exampleRecord(exampleRows().slice(1)))).toContain('5項目の名前と行');
  });
});
