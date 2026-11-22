import { fenceMask } from '@loomake/core';

export type LayoutFault = { line: number; message: string };
type BodyLine = { text: string; line: number };
type Section = { line: number; body: BodyLine[] };
const SEPARATOR = /^\|[\s:|-]*-[\s:|-]*$/;
const isRow = (l: BodyLine): boolean => l.text.startsWith('|');

const untilNextHeading = (rest: BodyLine[]): BodyLine[] => {
  const end = rest.findIndex((l) => l.text.startsWith('## '));
  return end < 0 ? rest : rest.slice(0, end);
};
/** `## <heading>` の節を、コードブロックの外の本文と行番号つきで返す。同じ見出しが複数あればその数だけ返す */
function sections(lines: string[], heading: string): Section[] {
  const fenced = fenceMask(lines);
  const all = lines.map((text, i) => ({ text: text.trim(), line: i + 1 })).filter((_, i) => !fenced[i]);
  return all.flatMap((l, i) => (l.text === `## ${heading}` ? [{ line: l.line, body: untilNextHeading(all.slice(i + 1)) }] : []));
}

const rowAfterTable = (body: BodyLine[], first: number): BodyLine | undefined => {
  const end = body.findIndex((l, i) => i > first && !isRow(l));
  return end < 0 ? undefined : body.slice(end).find(isRow);
};
function tableFault(body: BodyLine[], heading: string): LayoutFault | null {
  const first = body.findIndex(isRow);
  const tail = first < 0 ? undefined : rowAfterTable(body, first);
  if (tail) return { line: tail.line, message: `「${heading}」の表の後に表の行が続いています` };
  const separator = first < 0 ? undefined : body[first + 1];
  return separator && isRow(separator) && !SEPARATOR.test(separator.text) ? { line: separator.line, message: `「${heading}」の表に区切り行がありません` } : null;
}

/** 表の構造の誤り（節の重複・表の後に続く行・区切り行の欠落）を探す。core の readTable は最初の表だけを読むため、これらは行を黙って落とす */
export function layoutFault(lines: string[], heading: string): LayoutFault | null {
  const found = sections(lines, heading);
  if (found.length > 1) return { line: found[1].line, message: `「${heading}」の節が複数あります` };
  return found.length === 1 ? tableFault(found[0].body, heading) : null;
}
