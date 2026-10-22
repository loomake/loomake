// 既存のファイルとテンプレートの差分を unified diff の形で作る（add-init-cli の仮定 A-03）。kit の実行時依存を core だけに保つため自前で持つ

type Op = { kind: ' ' | '-' | '+'; line: string; a: number; b: number };

const splitLines = (text: string) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

/** before（既存）から after（テンプレート）への差分。違いが無ければ空文字 */
export function unifiedDiff(path: string, before: string, after: string, context = 3): string {
  const a = splitLines(before);
  const b = splitLines(after);
  // lcs[i][j] は a[i..] と b[j..] の最長共通部分列の長さ
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) ops.push({ kind: ' ', line: a[i], a: i++, b: j++ });
    else if (j >= b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) ops.push({ kind: '-', line: a[i], a: i++, b: j });
    else ops.push({ kind: '+', line: b[j], a: i, b: j++ });
  }

  // 変更のある位置の前後 context 行を 1 つの塊にし、近い塊はまとめる
  const ranges: [number, number][] = [];
  ops.forEach((op, k) => {
    if (op.kind === ' ') return;
    const start = Math.max(0, k - context);
    const end = Math.min(ops.length - 1, k + context);
    const last = ranges.at(-1);
    if (last && start <= last[1] + 1) last[1] = end;
    else ranges.push([start, end]);
  });
  if (!ranges.length) return '';

  const out = [`--- ${path}（いまのファイル）`, `+++ ${path}（loomake のテンプレート）`];
  for (const [start, end] of ranges) {
    const hunk = ops.slice(start, end + 1);
    const aLen = hunk.filter((o) => o.kind !== '+').length;
    const bLen = hunk.filter((o) => o.kind !== '-').length;
    const aStart = aLen ? hunk[0].a + 1 : hunk[0].a;
    const bStart = bLen ? hunk[0].b + 1 : hunk[0].b;
    out.push(`@@ -${aStart},${aLen} +${bStart},${bLen} @@`, ...hunk.map((o) => o.kind + o.line));
  }
  return out.join('\n');
}
