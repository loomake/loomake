import { fenceMask, splitLines, type ParseResult } from './parse.js';

export type Task = {
  /** `- [x]`・`- [X]` なら true、`- [ ]` なら false */
  checked: boolean;
  /** チェックボックスのあとの文 */
  text: string;
  line: number;
};

/** tasks.md からチェック済みと未チェックのタスクを取り出す（REQ-014）。コードブロックの中は読まない */
export function parseTasks(_file: string, text: string): ParseResult<Task[]> {
  const lines = splitLines(text);
  const fenced = fenceMask(lines);
  const value: Task[] = [];
  lines.forEach((line, i) => {
    const m = !fenced[i] && line.match(/^\s*- \[([ xX])\]\s*(.*?)\s*$/);
    if (m) value.push({ checked: m[1] !== ' ', text: m[2], line: i + 1 });
  });
  return { value, errors: [] };
}
