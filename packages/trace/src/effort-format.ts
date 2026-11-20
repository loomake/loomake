import { maskSecrets } from '@loomake/kit';
import type { EfficiencyCost, EfficiencyRow, EfficiencyTable, EfficiencyValue } from './effort-table-types.js';

const HEADING = '## 開発効率（推定との差。人力実測との比較ではない）';
const COLUMNS = ['change', '比較方式', '推定（最小〜最大）', 'Loomake 利用時の人の実績', '推定に対する削減率', '比較の種類', '判断要求', '試行', '費用'];
const BASELINE = { human: 'AI なしの人力', 'ai-assisted': '人が AI を操作する方式' } as const;
const COMPARISON = { estimate: '推定との比較・人力実測なし', measured: '人力実測あり' } as const;
const KIND_LABEL = { 'actual-usd': '実額', 'estimated-usd': '推計', tokens: 'トークン' } as const;
const KIND_ORDER = ['actual-usd', 'estimated-usd', 'tokens'] as const;
const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const codePoint = (ch: string): string => `\\u{${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}}`;

/** 秘密を置換してから、表を壊す文字を `\\`・`\|`・`\u{XXXX}` へ直す */
export function escapeCell(text: string): string {
  return maskSecrets(text).replace(/[\\|]|[\p{Cc}\p{Zl}\p{Zp}]/gu, (ch) => (ch === '\\' || ch === '|' ? `\\${ch}` : codePoint(ch)));
}

const unknown = (reason: string): string => `不明（${reason}）`;
const dollars = (cents: number): string => `$${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
const percent = (permille: number): string => `${permille < 0 ? '-' : ''}${Math.trunc(Math.abs(permille) / 10)}.${Math.abs(permille) % 10}%`;

/** 値・部分計・不明を、書式つきの文字列へ変える */
function show<T>(value: EfficiencyValue<T>, whole: (v: T) => string, partial: (known: T) => string): string {
  if (value.status === 'value') return whole(value.value);
  return value.status === 'partial' ? partial(value.known) : unknown(value.reason);
}

const countCell = (value: EfficiencyValue<number>): string => show(value, String, (known) => `部分計 ${known}以上（一部欠測）`);

function kindCell(kind: keyof EfficiencyCost, value: EfficiencyValue<number>): string {
  const money = (n: number): string => (kind === 'tokens' ? String(n) : dollars(n));
  return `${KIND_LABEL[kind]} ${show(value, money, (known) => `${money(known)}以上（一部欠測）`)}`;
}

function costCell(value: EfficiencyValue<EfficiencyCost>): string {
  if (value.status !== 'value') return value.status === 'missing' ? unknown(value.reason) : '';
  return KIND_ORDER.flatMap((kind) => { const v = value.value[kind]; return v ? [kindCell(kind, v)] : []; }).join(' / ');
}

const range = (low: number, high: number, show1: (n: number) => string, single: string): string =>
  low === high ? single : `${show1(low)}〜${show1(high)}`;

function reductionCell(value: EfficiencyRow['reduction']): string {
  const text = (v: { lowerPermille: number; upperPermille: number }) =>
    range(v.lowerPermille, v.upperPermille, percent, `${percent(v.lowerPermille)}（幅なし）`);
  return show(value, text, () => '');
}

function estimateCell(value: EfficiencyRow['estimate']): string {
  return show(value, (v) => `${range(v.minMinutes, v.maxMinutes, String, String(v.minMinutes))}分`, () => '');
}

const actualCell = (value: EfficiencyRow['actual']): string =>
  show(value, (v) => `${v.totalMinutes}分`, (known) => `部分計 ${known.totalMinutes}分以上（内訳不明）`);

function cellsOf(row: EfficiencyRow): string[] {
  const label = <T extends string>(v: EfficiencyValue<T>, names: Record<T, string>) => show(v, (x) => names[x], () => '');
  return [row.change, label(row.baseline, BASELINE), estimateCell(row.estimate), actualCell(row.actual), reductionCell(row.reduction),
    label(row.comparison, COMPARISON), countCell(row.decisions), countCell(row.attempts), costCell(row.cost)];
}

const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
const separator = (): string => `|${COLUMNS.map(() => '---').join('|')}|`;

function sourceLines(rows: EfficiencyRow[]): string[] {
  const manual = new Map(rows.flatMap((r) => r.sources.manual).map((m) => [m.path, m]));
  const text = [...manual.values()].sort((a, b) => byCode(a.path, b.path))
    .map((m) => `- ${m.path}（SHA-256 ${m.sha256}、行 ${m.lines.join(', ')}）`);
  const effort = [...new Set(rows.flatMap((r) => r.sources.effort))].sort(byCode).map((p) => `- ${p}`);
  const all = [...text, ...effort].map(escapeCell);
  return all.length > 0 ? all : ['- なし'];
}

/** 「開発効率」の節を Markdown にする純関数。日時を入れない */
export function formatEfficiencySection(table: EfficiencyTable): string {
  const head = [HEADING, '', line(COLUMNS), separator()];
  const body = table.rows.map((row) => line(cellsOf(row).map(escapeCell)));
  return [...head, ...body, '', '### 出典', '', ...sourceLines(table.rows), ''].join('\n');
}
