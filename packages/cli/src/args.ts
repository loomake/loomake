import { UsageError } from '@loomake/kit';

/** サブコマンドが受け付けるオプション。values は値をとるもの、flags は値をとらないもの */
export type OptionSpec = { values?: readonly string[]; flags?: readonly string[] };
export type ParsedOptions = { values: Map<string, string>; flags: Set<string> };

/** 編集距離（挿入・削除・置換を 1 とする） */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** 編集距離が 2 以下で最も近い候補（REQ-195）。なければ undefined */
export function suggest(input: string, candidates: readonly string[]): string | undefined {
  let best: { name: string; d: number } | undefined;
  for (const name of candidates) {
    const d = distance(input, name);
    if (d <= 2 && (!best || d < best.d)) best = { name, d };
  }
  return best?.name;
}

/** 「もしかして」の 1 文。候補がなければ空 */
export const didYouMean = (input: string, candidates: readonly string[]) => {
  const hit = suggest(input, candidates);
  return hit ? `。もしかして：${hit}` : '';
};

/** オプションを解析する。`--name value` と `--name=value` を受け付ける（REQ-194） */
export function parseOptions(args: readonly string[], spec: OptionSpec): ParsedOptions {
  const valueNames = spec.values ?? [];
  const flagNames = spec.flags ?? [];
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq < 0 ? arg : arg.slice(0, eq);
    if (valueNames.includes(name)) {
      const value = eq < 0 ? args[++i] : arg.slice(eq + 1);
      if (!value || (eq < 0 && value.startsWith('--'))) throw new UsageError(`${name} には値を続けてください`);
      values.set(name, value);
    } else if (eq < 0 && flagNames.includes(name)) {
      flags.add(name);
    } else {
      throw new UsageError(`知らないオプションです：${arg}${didYouMean(name, [...valueNames, ...flagNames])}`);
    }
  }
  return { values, flags };
}
