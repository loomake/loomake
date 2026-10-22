import { REQ_ID, fenceMask, splitLines, type ParseError, type ParseResult } from './parse.js';

export type SpecOperation = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

export type SpecRequirement = {
  /** 属する見出し（`## ADDED Requirements` など）の操作。どの見出しの下にも無いときは null */
  op: SpecOperation | null;
  /** Requirement の名前。RENAMED では新しい名前（TO） */
  name: string;
  /** RENAMED の古い名前（FROM）。RENAMED 以外では無い */
  from?: string;
  /** `Source:` 行にある要件 ID */
  sources: string[];
  scenarios: number;
  /** `### Requirement:` の行（RENAMED では FROM の行）の行番号 */
  line: number;
};

// OpenSpec 1.14 と同じく、RENAMED の FROM・TO は箇条書きの記号を省いてよく、名前はバッククォートで囲んでよい
const FROM = /^\s*[-*+]?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const TO = /^\s*[-*+]?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;

/**
 * OpenSpec の差分仕様（spec.md）から Requirement を取り出す（REQ-013, REQ-051）。
 * コードブロックの中は読まない。RENAMED の FROM と TO が組にならないときはエラーにする
 */
export function parseSpec(file: string, text: string): ParseResult<SpecRequirement[]> {
  const lines = splitLines(text);
  const fenced = fenceMask(lines);
  const value: SpecRequirement[] = [];
  const errors: ParseError[] = [];
  let op: SpecOperation | null = null;
  let cur: SpecRequirement | null = null;
  let pendingFrom: { name: string; line: number } | null = null;
  const dropPending = () => {
    if (pendingFrom) errors.push({ file, line: pendingFrom.line, message: `RENAMED の FROM「${pendingFrom.name}」に対応する TO がありません` });
    pendingFrom = null;
  };

  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const opMatch = line.match(/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/);
    if (opMatch || /^## /.test(line)) {
      dropPending();
      op = opMatch ? (opMatch[1] as SpecOperation) : null;
      cur = null;
      return;
    }
    if (op === 'RENAMED') {
      const from = line.match(FROM);
      const to = line.match(TO);
      if (from) {
        dropPending();
        pendingFrom = { name: from[1].trim(), line: i + 1 };
      } else if (to) {
        if (pendingFrom) {
          value.push({ op, name: to[1].trim(), from: pendingFrom.name, sources: [], scenarios: 0, line: pendingFrom.line });
          pendingFrom = null;
        } else {
          errors.push({ file, line: i + 1, message: `RENAMED の TO「${to[1].trim()}」の前に FROM がありません` });
        }
      }
      return;
    }
    const req = line.match(/^### Requirement:\s*(.+?)\s*$/);
    if (req) {
      cur = { op, name: req[1], sources: [], scenarios: 0, line: i + 1 };
      value.push(cur);
      return;
    }
    if (!cur) return;
    const c: SpecRequirement = cur;
    if (/^#### Scenario:/.test(line)) c.scenarios++;
    const src = line.match(/^\**Source\**:\**\s*(.+)$/);
    if (src) c.sources.push(...(src[1].match(REQ_ID) ?? []));
  });
  dropPending();
  return { value, errors };
}
