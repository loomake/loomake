import { it as vitestIt } from 'vitest';
import { PartitionError } from '../../scripts/lib/test-partition.mjs';

let part: 'fast' | 'slow' = 'fast';
export function setPart(value: 'fast' | 'slow') { part = value; }
export function currentPart() { return part; }

/** Keep the complete table for Vitest's arity and title rules; select callbacks only. */
export function selectRows<T>(cases: readonly T[], chosen: readonly boolean[]): T[] {
  if (!Array.isArray(cases) || cases.length !== chosen.length) throw new PartitionError(`行IDの数（${chosen.length}）が表の行数と一致しません`);
  const table = cases.slice();
  Object.defineProperty(table, 'forEach', { value(cb: (row: T, index: number, array: readonly T[]) => void, thisArg?: unknown) {
    cases.forEach((row, index, array) => { if (chosen[index]) cb.call(thisArg, row, index, array); });
  } });
  return table;
}

/** One direct it.each call, preserving the original table expression and callback. */
export function eachRows(has: (id: string) => boolean, ids: readonly string[]): Pick<typeof vitestIt, 'each'> {
  if (ids.length === 0 || new Set(ids).size !== ids.length) throw new PartitionError('行IDは重複しない1件以上にしてください');
  const chosen = ids.map((id) => has(id));
  let used = false;
  return Object.freeze({
    each(cases: readonly unknown[], ...rest: unknown[]) {
      if (used || rest.length) throw new PartitionError('eachRows は配列の表で1回だけ使えます');
      used = true;
      return vitestIt.each(selectRows(cases, chosen));
    },
  }) as Pick<typeof vitestIt, 'each'>;
}
