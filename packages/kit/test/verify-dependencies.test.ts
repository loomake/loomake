import { expect, it } from 'vitest';

import { readDependencies } from '../src/verify/dependencies.js';
const header = '| ID | 関連 | 種類 | 依存先 | 提供元 | 期待blob | CI |';
const separator = '| --- | --- | --- | --- | --- | --- | --- |';
const row = ['D-01', 'REQ-400', 'change', 'add-x', '', '', ''];
const table = (rows = [row], head = header, sep = separator) =>
  ['## 依存する成果物', head, sep, ...rows.map((cells) => `| ${cells.join(' | ')} |`)].join('\n');
const read = (body: string) => readDependencies(body, ['REQ-400', 'REQ-401'], 'self');

it.each(['', '## 依存と技術確認\n説明', `\`\`\`md\n${table()}\n\`\`\``, `~~~md\n${table()}\n~~~`])('[REQ-400] 節なし・旧節・フェンス内: %s', (body) => {
  expect(read(body)).toEqual({ present: false, declarations: [], errors: [] });
});
it.each(['\n', '\r\n', '\r'])('[REQ-400] 全3種と元の値・順序・行を保持する: %j', (eol) => {
  const rows = [row, ['D-02', 'REQ-400, REQ-401', 'issue', '#123', 'producer', '', '12/34, 56/78'],
    ['D-003', 'REQ-401', 'path', 'src/a..b\\|c.ts', 'producer', 'aB'.repeat(32), '']];
  const result = read(['# Trace', '```', '## dummy', '```', table(rows), '## 次節', table([row])].join('\n').replace(/\n/g, eol));
  expect(result).toEqual({ present: true, errors: [], declarations: [
    { id: 'D-01', related: ['REQ-400'], kind: 'change', target: 'add-x', provider: '', expectedBlob: '', ci: [], line: 8 },
    { id: 'D-02', related: ['REQ-400', 'REQ-401'], kind: 'issue', target: '#123', provider: 'producer', expectedBlob: '', ci: ['12/34', '56/78'], line: 9 },
    { id: 'D-003', related: ['REQ-401'], kind: 'path', target: 'src/a..b|c.ts', provider: 'producer', expectedBlob: 'aB'.repeat(32), ci: [], line: 10 },
  ] });
});
it('[REQ-400] 有効な同一提供元・40桁blob・最初の表を受け付ける', () => {
  expect(read(table([[...row.slice(0, 4), 'add-x', '', ''], ['D-02', 'REQ-400', 'path', 'a.ts', 'other', 'a'.repeat(40), '']]) + '\n本文\n' + table()).declarations).toHaveLength(2);
  expect(read(table([[...row.slice(0, 4), 'add-x', '', ''], ['D-02', 'REQ-400', 'path', 'a.ts', 'other', 'a'.repeat(40), '']])).errors).toEqual([]);
});
it.each([
  ['## 依存する成果物\n説明', 1], [table([]), 1], [table([row], header, ''), 2],
  [table([row], header.replace('関連', '不明')), 2], [table([row], header.replace('ID | 関連', '関連 | ID')), 2],
  [table([row], header + ' 余分 |'), 2], [table([row], header.replace(' CI |', '')), 2],
  [table([row.slice(0, 6)]), 4], [table([[...row, 'extra']]), 4], [table([row, row]), 5],
])('[REQ-400] 表の形と重複の位置: %s', (body, line) => {
  expect(read(body).errors).toContainEqual(expect.objectContaining({ file: 'trace.md', line }));
});
it.each([
  [0, 'D-1', 'ID'], [0, '', 'ID'], [1, '', '関連'], [1, 'REQ-999', '関連'], [1, 'REQ-400,', '関連'],
  [1, ',REQ-400', '関連'], [1, 'REQ-400,,REQ-401', '関連'], [2, 'unknown', '種類'],
  [3, 'Bad-id', '依存先'], [3, 'self', '依存先'], [3, 'archive', '依存先'], [3, '', '依存先'],
  [4, 'other', '提供元'], [4, 'Bad-id', '提供元'], [4, 'self', '提供元'], [4, 'archive', '提供元'],
  [5, 'a'.repeat(40), '期待blob'], [6, '1', 'CI'], [6, '1/2,', 'CI'], [6, 'https://x/1/2', 'CI'],
])('[REQ-400] 共通列とchangeの不正: %j %s', (column, value, reason) => {
  const cells = [...row]; cells[column] = value;
  expect(read(table([cells])).errors).toContainEqual({ file: 'trace.md', line: 4, id: cells[0] || undefined, message: expect.stringContaining(reason) });
});
it.each([
  ['issue', 'https://github.com/a/b/issues/1', 'producer', '', '依存先'], ['issue', 'a/b#1', 'producer', '', '依存先'],
  ['issue', '#1', '', '', '提供元'], ['path', 'a.ts', '', 'a'.repeat(40), '提供元'],
  ...['/a', 'a\\b', '../a', 'a/../b', 'a//b', 'a/', ''].map((path) => ['path', path, 'producer', 'a'.repeat(40), '依存先']),
  ...['', 'g'.repeat(40), 'a'.repeat(39), 'a'.repeat(41), 'a'.repeat(63), 'a'.repeat(65)].map((blob) => ['path', 'a.ts', 'producer', blob, '期待blob']),
  ['issue', '#1', 'producer', 'a'.repeat(40), '期待blob'],
])('[REQ-400] Issue/pathの形: %s %s %s %s', (kind, target, provider, blob, reason) => {
  expect(read(table([['D-01', 'REQ-400', kind, target, provider, blob, '']])).errors)
    .toContainEqual({ file: 'trace.md', line: 4, id: 'D-01', message: expect.stringContaining(reason) });
});
it('[REQ-400] フェンス外の実節とセルの空白を読み、次節の表を含めない', () => {
  const body = ['```md', table(), '```', table([row.map((value) => ` ${value} `)]), '## 次節', table()].join('\n');
  expect(read(body)).toEqual({ present: true, errors: [], declarations: [{ id: 'D-01', related: ['REQ-400'], kind: 'change', target: 'add-x', provider: '', expectedBlob: '', ci: [], line: 10 }] });
});
it('[REQ-400] 次節にしか表がなければ元の見出しで表欠落を返す', () => {
  expect(read('## 依存する成果物\n## 次節\n' + table())).toEqual({ present: true, declarations: [], errors: [{ file: 'trace.md', line: 1, id: undefined, message: expect.any(String) }] });
});

it.each([
  '|-|-|-|-|-|-|-|', '|:-:|:-:|:-:|:-:|:-:|:-:|:-:|',
  ...['-', '--', ':-', '-:', ':-:', ':--:'].map((cell) => `| ${Array(7).fill(cell).join(' | ')} |`),
  '| - | :-- | --: | :-: | --- | -- | :- |',
])('[REQ-400] 短い有効な区切り行で値と位置を保持する: %s', (sep) => {
  expect(read(table([row], header, sep))).toEqual({ present: true, errors: [], declarations: [
    { id: 'D-01', related: ['REQ-400'], kind: 'change', target: 'add-x', provider: '', expectedBlob: '', ci: [], line: 4 },
  ] });
});
it.each(['\r\n', '\r'])('[REQ-400] 混在する短い区切りと改行で全3種の順序と位置を保持する: %j', (eol) => {
  const rows = [row, ['D-02', 'REQ-400, REQ-401', 'issue', '#123', 'producer', '', '12/34, 56/78'],
    ['D-003', 'REQ-401', 'path', 'src/a..b\\|c.ts', 'producer', 'aB'.repeat(32), '']];
  const body = table(rows, header, '| - | :-- | --: | :-: | --- | -- | :- |').replace(/\n/g, eol);
  expect(read(body)).toEqual({ present: true, errors: [], declarations: [
    { id: 'D-01', related: ['REQ-400'], kind: 'change', target: 'add-x', provider: '', expectedBlob: '', ci: [], line: 4 },
    { id: 'D-02', related: ['REQ-400', 'REQ-401'], kind: 'issue', target: '#123', provider: 'producer', expectedBlob: '', ci: ['12/34', '56/78'], line: 5 },
    { id: 'D-003', related: ['REQ-401'], kind: 'path', target: 'src/a..b|c.ts', provider: 'producer', expectedBlob: 'aB'.repeat(32), ci: [], line: 6 },
  ] });
});
it.each(['', ':', '::', '- -', '-=-', '=', 'a', ':-:-', '+-'])('[REQ-400] 区切りでないセルを拒否する: %j', (cell) => {
  const sep = `| ${[...Array(6).fill('-'), cell].join(' | ')} |`;
  expect(read(table([row], header, sep))).toEqual({ present: true, declarations: [],
    errors: [{ file: 'trace.md', line: 2, id: undefined, message: expect.stringContaining('区切り行') }] });
});
it.each([6, 8])('[REQ-400] 短い区切り行でも7列以外を拒否する: %i', (count) => {
  const sep = `| ${Array(count).fill('-').join(' | ')} |`;
  expect(read(table([row], header, sep))).toEqual({ present: true, declarations: [],
    errors: [{ file: 'trace.md', line: 2, id: undefined, message: expect.stringContaining('区切り行') }] });
});
