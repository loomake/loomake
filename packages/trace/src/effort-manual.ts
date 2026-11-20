import { createHash } from 'node:crypto';
import { readTable, splitLines } from '@loomake/core';
import type { EffortMinutes, ParseError, Table, TableRow } from '@loomake/core';
import { CHANGE_ID } from '@loomake/kit';
import { parseCost, parseDuration } from './effort-input.js';
import type { ChangeRef, EffortObservation, ManualEffortRecord, ManualEstimate } from './effort-types.js';

type Sink = (line: number, message: string) => void;
type Basic = { value: string; line: number };
type Parts = { minutes: EffortMinutes; decisions?: number; attempts?: number; cost?: EffortObservation['cost'] };
const CATEGORIES = ['instruct', 'review', 'rework', 'run', 'wait'] as const;
const MINUTE_COLUMNS = Object.entries({ 指示: 'instruct', レビュー: 'review', 手直し: 'rework', 実行: 'run', 待機: 'wait', うち判断根拠を探す時間: 'search' } as const);
const ACTUAL_COLUMNS = ['日', ...MINUTE_COLUMNS.map(([column]) => column), '判断要求', '試行', '費用'];
const ESTIMATE_COLUMNS = ['最小', '最大', '根拠', '推定した人', '推定した日'];
const REQUIRED_ITEMS = ['対象', 'change', '作業範囲'];
const COMPARISONS: Record<string, 'estimate' | 'measured'> = { '推定との比較・人力実測なし': 'estimate', 人力実測あり: 'measured' };
const BASELINES: Record<string, 'human' | 'ai-assisted'> = { 'AI なしの人力': 'human', '人が AI を操作する方式': 'ai-assisted' };

/** 手書きの時間（`24 時間`・`90分` など）を、CLI と同じ換算で整数分にする。読めなければ null */
function manualDuration(text: string): number | null {
  const match = /^(.+?) ?(分|m|時間|h)$/.exec(text);
  if (!match || / /.test(match[1])) return null;
  try { return parseDuration(match[1] + (/^(分|m)$/.test(match[2]) ? 'm' : 'h')); } catch { return null; }
}
function realDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  return date !== null && date.toISOString().startsWith(text);
}
const decode = (bytes: Uint8Array): string[] | null => {
  try { return splitLines(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return null; }
};

const sectionFault = (table: Table | null, columns: string[]): string | null => {
  if (!table) return 'の節がありません';
  if (!table.found) return 'に表がありません';
  const names = table.header?.names ?? [];
  if (new Set(names).size !== names.length) return 'の列が重複しています';
  return columns.every((column) => names.includes(column)) ? null : 'の必須の列が足りません';
};
function readSection(lines: string[], heading: string, columns: string[], sink: Sink): Table | null {
  const table = readTable(lines, heading);
  const fault = sectionFault(table, columns);
  if (fault) sink(table?.line ?? 1, `「${heading}」${fault}`);
  return fault ? null : table;
}
const widthFault = (table: Table, row: TableRow): boolean => row.size !== table.header?.names.length;

function addItem(items: Map<string, Basic>, table: Table, row: TableRow, sink: Sink): void {
  const name = row.cells['項目'] ?? '';
  const duplicate = items.has(name);
  if (widthFault(table, row)) sink(row.line, '記録の基本の列数が表と合いません');
  else if (duplicate) sink(row.line, '記録の基本に同じ項目が重複しています');
  if (!widthFault(table, row)) items.set(name, { value: duplicate ? '' : (row.cells['値'] ?? ''), line: row.line });
}
function basicItems(lines: string[], sink: Sink): Map<string, Basic> {
  const items = new Map<string, Basic>();
  const table = readSection(lines, '記録の基本', ['項目', '値'], sink);
  for (const row of table?.rows ?? []) addItem(items, table as Table, row, sink);
  for (const name of REQUIRED_ITEMS) if (table && !items.get(name)?.value) sink(table.line, `記録の基本の「${name}」が空か、ありません`);
  return items;
}
function changeRef(value: string): ChangeRef {
  if (value === '未作成') return { status: 'unmapped', reason: 'change 未作成' };
  if (CHANGE_ID.test(value) && value !== 'archive') return { status: 'single', id: value };
  return { status: 'unmapped', reason: 'change を 1 つに特定できません' };
}
function choose<T>(items: Map<string, Basic>, name: string, options: Record<string, T>, sink: Sink): T | null {
  const found = items.get(name);
  const value = found && Object.hasOwn(options, found.value) ? options[found.value] : null;
  if (value === null) sink(found?.line ?? 1, `記録の基本の「${name}」が選択されていません`);
  return value;
}
function readBasics(lines: string[], sink: Sink) {
  const items = basicItems(lines, sink);
  return { change: changeRef(items.get('change')?.value ?? ''), comparison: choose(items, '比較の種類', COMPARISONS, sink), baseline: choose(items, '比較方式', BASELINES, sink) };
}

function estimateFault(row: TableRow, table: Table, min: number | null, max: number | null): string | null {
  if (widthFault(table, row)) return '事前の推定の列数が表と合いません';
  if (min === null || max === null) return '事前の推定の時間を読めません';
  if (!row.cells['根拠']) return '事前の推定の根拠がありません';
  return realDate(row.cells['推定した日'] ?? '') ? null : '事前の推定の日が日付ではありません';
}
const estimateTimes = (row: TableRow): [number | null, number | null] =>
  [manualDuration(row.cells['最小'] ?? ''), manualDuration(row.cells['最大'] ?? '')];

function estimateRow(table: Table, row: TableRow, sink: Sink): ManualEstimate {
  const [min, max] = estimateTimes(row);
  const fault = estimateFault(row, table, min, max);
  if (fault === null) return { minMinutes: min as number, maxMinutes: max as number, line: row.line };
  sink(row.line, fault);
  return { missing: fault };
}
function readEstimate(lines: string[], sink: Sink): ManualEstimate {
  const table = readSection(lines, '事前の推定', ESTIMATE_COLUMNS, sink);
  if (!table) return { missing: '事前の推定の表を読めません' };
  if (table.rows.length === 1) return estimateRow(table, table.rows[0], sink);
  sink(table.line, '事前の推定は 1 行にしてください');
  return { missing: '事前の推定が 1 行ではありません' };
}

const cellMinutes = (text = ''): number | null | undefined => (text === '' ? undefined : manualDuration(text));
const cellCount = (text = ''): number | null | undefined => {
  if (text === '') return undefined;
  return /^[0-9]+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
};
function minutesFault(minutes: EffortMinutes): string | null {
  const known = CATEGORIES.reduce((sum, key) => sum + (minutes[key] ?? 0), 0);
  if (!CATEGORIES.some((key) => minutes[key] !== undefined)) return '実績に時間の区分がありません';
  return (minutes.search ?? 0) > known ? '実績の判断根拠を探す時間が合計を超えています' : null;
}
function readMinutes(row: TableRow): EffortMinutes | string {
  const values = MINUTE_COLUMNS.map(([column, key]) => [key, cellMinutes(row.cells[column])] as const);
  if (values.some(([, value]) => value === null)) return '実績の時間を読めません';
  const minutes = Object.fromEntries(values.filter(([, value]) => value !== undefined)) as EffortMinutes;
  return minutesFault(minutes) ?? minutes;
}
const optional = (key: 'decisions' | 'attempts', value: number | undefined) => (value === undefined ? {} : { [key]: value });
function readCounts(row: TableRow) {
  const decisions = cellCount(row.cells['判断要求']);
  const attempts = cellCount(row.cells['試行']);
  if (decisions === null || attempts === null) return '実績の回数を読めません';
  return { ...optional('decisions', decisions), ...optional('attempts', attempts) };
}
function readCost(row: TableRow) {
  const text = row.cells['費用'] ?? '';
  if (text === '') return {};
  try { return { cost: parseCost(text) }; } catch { return '実績の費用の書式を読めません'; }
}
const rowFault = (table: Table, row: TableRow): string | null => {
  if (widthFault(table, row)) return '実績の列数が表と合いません';
  return realDate(row.cells['日'] ?? '') ? null : '実績の日が日付ではありません';
};
const asFault = (value: unknown): string | null => (typeof value === 'string' ? value : null);
function rowParts(table: Table, row: TableRow): Parts | string {
  const minutes = readMinutes(row);
  const counts = readCounts(row);
  const cost = readCost(row);
  const fault = rowFault(table, row) ?? asFault(minutes) ?? asFault(counts) ?? asFault(cost);
  return fault ?? { minutes: minutes as EffortMinutes, ...(counts as object), ...(cost as object) };
}
function actualRow(path: string, table: Table, row: TableRow, sink: Sink): EffortObservation | null {
  const parts = rowParts(table, row);
  if (typeof parts === 'string') { sink(row.line, parts); return null; }
  return { source: { path, line: row.line }, ...parts };
}
function readActuals(path: string, lines: string[], sink: Sink): ManualEffortRecord['actuals'] {
  const table = readSection(lines, '実績', ACTUAL_COLUMNS, sink);
  if (!table) return { invalid: '実績の表を読めません' };
  const rows = table.rows.map((row) => actualRow(path, table, row, sink));
  return rows.every((row) => row !== null) ? rows : { invalid: '実績に読めない行があります' };
}

function unreadable(path: string, sha256: string): ManualEffortRecord {
  const problems: ParseError[] = [{ file: path, line: 1, message: 'UTF-8 として読めません' }];
  return { path, sha256, change: { status: 'unmapped', reason: 'UTF-8 として読めません' }, comparison: null, baseline: null,
    estimate: { missing: 'UTF-8 として読めません' }, actuals: { invalid: 'UTF-8 として読めません' }, problems };
}
/** 手書きの効率記録を読む純関数。構造の誤りは例外にせず、行番号つきの problems で返す */
export function parseManualEffort(path: string, bytes: Uint8Array): ManualEffortRecord {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const lines = decode(bytes);
  return lines === null ? unreadable(path, sha256) : parseLines(path, sha256, lines);
}

function parseLines(path: string, sha256: string, lines: string[]): ManualEffortRecord {
  const problems: ParseError[] = [];
  const sink: Sink = (line, message) => { problems.push({ file: path, line, message }); };
  const basics = readBasics(lines, sink);
  return { path, sha256, ...basics, estimate: readEstimate(lines, sink), actuals: readActuals(path, lines, sink), problems };
}
