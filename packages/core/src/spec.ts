import type { z } from 'zod';
import type { specOperationSchema, specRequirementSchema } from './parser-schemas.js';
import { REQ_ID, fenceMask, splitLines, type ParseError, type ParseResult } from './parse.js';

export type SpecOperation = z.infer<typeof specOperationSchema>;
export type SpecRequirement = z.infer<typeof specRequirementSchema>;

// OpenSpec 1.14 と同じく、RENAMED の FROM・TO は箇条書きの記号を省いてよく、名前はバッククォートで囲んでよい
const FROM = /^\s*[-*+]?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const TO = /^\s*[-*+]?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;

const OP_HEADING = /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/;
const REQUIREMENT = /^### Requirement:\s*(.+?)\s*$/;
const SOURCE = /^\**Source\**:\**\s*(.+)$/;

type SpecLine = { text: string; line: number };
type PendingFrom = { name: string; line: number };
type SpecState = {
  file: string; value: SpecRequirement[]; errors: ParseError[];
  op: SpecOperation | null; cur: SpecRequirement | null; pendingFrom: PendingFrom | null;
};

/**
 * OpenSpec の差分仕様（spec.md）から Requirement を取り出す（REQ-013, REQ-051）。
 * コードブロックの中は読まない。RENAMED の FROM と TO が組にならないときはエラーにする
 */
export function parseSpec(file: string, text: string): ParseResult<SpecRequirement[]> {
  const s: SpecState = { file, value: [], errors: [], op: null, cur: null, pendingFrom: null };
  for (const line of unfencedLines(splitLines(text))) readLine(s, line);
  dropPending(s);
  return { value: s.value, errors: s.errors };
}

function unfencedLines(lines: string[]): SpecLine[] {
  const fenced = fenceMask(lines);
  return lines.map((text, i) => ({ text, line: i + 1 })).filter((_, i) => !fenced[i]);
}

function readLine(s: SpecState, { text, line }: SpecLine): void {
  if (/^## /.test(text)) startSection(s, text);
  else if (s.op === 'RENAMED') readRenamed(s, text, line);
  else readRequirementLine(s, text, line);
}

/** 操作の見出しなら操作を切り替え、ほかの ## 見出しなら操作を外す */
function startSection(s: SpecState, text: string): void {
  dropPending(s);
  s.op = (text.match(OP_HEADING)?.[1] as SpecOperation | undefined) ?? null;
  s.cur = null;
}

function readRenamed(s: SpecState, text: string, line: number): void {
  const from = text.match(FROM);
  const to = text.match(TO);
  if (from) startRename(s, from[1].trim(), line);
  else if (to) finishRename(s, to[1].trim(), line);
}

function startRename(s: SpecState, name: string, line: number): void {
  dropPending(s);
  s.pendingFrom = { name, line };
}

function finishRename(s: SpecState, name: string, line: number): void {
  if (s.pendingFrom) s.value.push(renamed(s.pendingFrom, name));
  else s.errors.push({ file: s.file, line, message: `RENAMED の TO「${name}」の前に FROM がありません` });
  s.pendingFrom = null;
}

function renamed(from: PendingFrom, name: string): SpecRequirement {
  return { op: 'RENAMED', name, from: from.name, sources: [], scenarios: 0, line: from.line };
}

/** 組になる TO のない FROM をエラーにする */
function dropPending(s: SpecState): void {
  if (s.pendingFrom) s.errors.push({ file: s.file, line: s.pendingFrom.line, message: `RENAMED の FROM「${s.pendingFrom.name}」に対応する TO がありません` });
  s.pendingFrom = null;
}

function readRequirementLine(s: SpecState, text: string, line: number): void {
  const req = text.match(REQUIREMENT);
  if (req) startRequirement(s, req[1], line);
  else if (s.cur) readRequirementBody(s.cur, text);
}

function startRequirement(s: SpecState, name: string, line: number): void {
  s.cur = { op: s.op, name, sources: [], scenarios: 0, line };
  s.value.push(s.cur);
}

function readRequirementBody(req: SpecRequirement, text: string): void {
  if (/^#### Scenario:/.test(text)) req.scenarios++;
  const src = text.match(SOURCE);
  if (src) addSources(req, src[1].match(REQ_ID) ?? []);
}

/** Source の ID を、初出順に重複なく足す */
function addSources(req: SpecRequirement, ids: string[]): void {
  for (const id of ids) {
    if (!req.sources.includes(id)) req.sources.push(id);
  }
}
