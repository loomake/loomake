import { readFileSync } from 'node:fs';

export type BaselineCase = { argv: string[]; code: number; stdout: string[]; stderr: string[] };
type BaselineChange = { change: string; requirement: string; approval: string; reason: string; argv: string[][]; stream: 'stdout' | 'stderr'; from: string; to: string };

const read = <T>(name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;

/** 基準mainの原本（書き換えない） */
export const originalBaseline = () => read<{ source: string; cases: BaselineCase[] }>('reference-cli-baseline.json');
/** 改版の change で承認した、原本への具体差分（REQ-324） */
export const baselineChanges = () => read<{ changes: BaselineChange[] }>('reference-cli-baseline-changes.json').changes;

/**
 * 原本に承認済みの差分を当てた、いまの CLI の期待値を返す。
 * 差分の対象の行が原本のその出力にちょうど 1 回なければ、黙って当てずに例外にする
 */
export function currentBaseline(): BaselineCase[] {
  const cases = originalBaseline().cases.map((item) => ({ ...item, stdout: [...item.stdout], stderr: [...item.stderr] }));
  for (const change of baselineChanges()) {
    for (const argv of change.argv) {
      const target = cases.find((item) => JSON.stringify(item.argv) === JSON.stringify(argv));
      if (!target) throw new Error(`基準の差分の対象がありません：${JSON.stringify(argv)}（${change.change}）`);
      if (target[change.stream].length !== 1) throw new Error(`基準の差分は 1 回の出力だけに当てます：${JSON.stringify(argv)}（${change.change}）`);
      const lines = target[change.stream][0].split('\n');
      if (lines.filter((line) => line === change.from).length !== 1) throw new Error(`基準の差分の旧文が 1 行だけではありません：${JSON.stringify(argv)}（${change.change}）`);
      const replaced = lines.map((line) => (line === change.from ? change.to : line)).join('\n');
      target[change.stream] = [replaced];
    }
  }
  return cases;
}
