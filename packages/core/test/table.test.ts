import { describe, expect, it } from 'vitest';
import { readTable, splitLines } from '../src/index.js';
import type { Table, TableRow } from '../src/index.js';

const lines = (text: string) => splitLines(text);

describe('readTable の公開', () => {
  it('[REQ-467] 入口から表を読み、見出しがなければ null を返す', () => {
    const table: Table | null = readTable(lines('## 実績\n\n| 日 | 時間 |\n|---|---|\n| 2026-11-06 | 90分 |\n'), '実績');
    expect(table?.rows[0]?.cells).toEqual({ 日: '2026-11-06', 時間: '90分' });
    expect(readTable(lines('# なし\n'), '実績')).toBeNull();
  });
  it('[REQ-467] 行ごとに実際に分けたセルの数を size に持つ', () => {
    const table = readTable(lines('## 実績\n| a | b |\n|---|---|\n| 1 | 2 | 3 |\n| 4 |\n'), '実績');
    const sizes = table?.rows.map((row: TableRow) => row.size);
    expect(sizes).toEqual([3, 1]);
  });
});
