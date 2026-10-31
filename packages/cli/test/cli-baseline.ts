import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTrace } from '@loomake/core';

export type BaselineCase = { argv: string[]; code: number; stdout: string[]; stderr: string[] };
/**
 * 原本への具体差分。from は 1 行で、to は 1 行以上（旧文の 1 行を、新文の 1 行以上に置き換える）。
 * stream が stderr のときは、何番目の出力かを entry で示す。stdout で出力が 1 回だけなら entry は要らない
 */
export type BaselineChange = { change: string; requirement: string; approval: string; reason: string; argv: string[][]; stream: 'stdout' | 'stderr'; entry?: number; from: string; to: string };

const repoRoot = resolve(import.meta.dirname, '../../..');
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const read = <T>(name: string) => JSON.parse(readFileSync(fixture(name), 'utf8')) as T;

/** 基準mainの原本の sha256（改行は LF にそろえて計る）。原本を書き換えると一致しない（REQ-324） */
export const ORIGINAL_BASELINE_SHA256 = '3aa01ff191f2cf45453f777f3137ff439f239b304e8f3c10013b4af17efcbe8c';
export const originalBaselineSha256 = () => createHash('sha256').update(readFileSync(fixture('reference-cli-baseline.json'), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

/** 基準mainの原本（書き換えない） */
export const originalBaseline = () => read<{ source: string; cases: BaselineCase[] }>('reference-cli-baseline.json');
/** 改版の change で承認した、原本への具体差分（REQ-324） */
export const baselineChanges = () => read<{ changes: BaselineChange[] }>('reference-cli-baseline-changes.json').changes;

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** 差分の記録の問題を返す。各欄が空でない文字列で、change が実在し、その trace に承認元の確認事項の回答がある（REQ-324） */
export function baselineChangeProblems(changes: unknown[], root = repoRoot): string[] {
  const problems: string[] = [];
  changes.forEach((value, index) => {
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const at = `差分 ${index + 1}`;
    for (const key of ['change', 'requirement', 'approval', 'reason', 'from', 'to']) {
      if (!filled(item[key])) problems.push(`${at} の ${key} が空です`);
    }
    if (item.stream !== 'stdout' && item.stream !== 'stderr') problems.push(`${at} の stream は stdout か stderr です`);
    if (item.entry !== undefined && !(Number.isInteger(item.entry) && (item.entry as number) >= 0)) problems.push(`${at} の entry は 0 以上の整数です`);
    if (!Array.isArray(item.argv) || item.argv.length === 0 || !item.argv.every((a) => Array.isArray(a) && a.every(filled))) problems.push(`${at} の argv が不正です`);
    if (filled(item.requirement) && !/^REQ-\d{3,}$/.test(item.requirement)) problems.push(`${at} の requirement が REQ-ID ではありません`);
    if (filled(item.from) && item.from.includes('\n')) problems.push(`${at} の from は 1 行です`);
    if (!filled(item.change) || !filled(item.approval)) return;
    const changesDir = join(root, 'openspec/changes');
    const dir = existsSync(join(changesDir, item.change, 'trace.md')) ? join(changesDir, item.change) : findArchived(changesDir, item.change);
    if (!dir) { problems.push(`${at} の change ${item.change} が openspec/changes にありません`); return; }
    const id = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/.exec(item.approval)?.[0];
    const question = id === undefined ? undefined : parseTrace(join(dir, 'trace.md'), readFileSync(join(dir, 'trace.md'), 'utf8')).value.questions.find((q) => q.ID === id);
    if (!question || !filled(question['回答'])) problems.push(`${at} の承認元 ${id ?? item.approval} の回答が ${item.change} の trace にありません`);
  });
  return problems;
}

// archive は日付つきの名前（YYYY-MM-DD-<change>）で置かれる
function findArchived(changesDir: string, change: string): string | undefined {
  const archive = join(changesDir, 'archive');
  if (!existsSync(archive)) return undefined;
  return readdirSync(archive).filter((name) => name === change || name.endsWith(`-${change}`)).map((name) => join(archive, name)).find((d) => existsSync(join(d, 'trace.md')));
}

/**
 * 原本の例に差分を当てる。旧文が対象の出力にちょうど 1 行ないとき、新文がすでにあるとき、
 * 出力が 1 回でないとき、対象の例がないときは、黙って当てずに例外にする
 */
export function applyBaselineChanges(original: BaselineCase[], changes: BaselineChange[]): BaselineCase[] {
  const cases = original.map((item) => ({ ...item, stdout: [...item.stdout], stderr: [...item.stderr] }));
  for (const change of changes) {
    for (const argv of change.argv) {
      const where = `${JSON.stringify(argv)}（${change.change}）`;
      const target = cases.find((item) => JSON.stringify(item.argv) === JSON.stringify(argv));
      if (!target) throw new Error(`基準の差分の対象がありません：${where}`);
      // entry を省くのは、出力が 1 回だけのとき。複数回の出力に当てるときは何番目かを示す
      const entry = change.entry ?? 0;
      if (change.entry === undefined ? target[change.stream].length !== 1 : target[change.stream][entry] === undefined) throw new Error(`基準の差分は 1 回の出力だけに当てます：${where}`);
      const text = target[change.stream][entry];
      const lines = text.split('\n');
      if (lines.filter((line) => line === change.from).length !== 1) throw new Error(`基準の差分の旧文が 1 行だけではありません：${where}`);
      // 新文が複数行のときは、旧文を含むことがあるので、文全体がすでにあるかで調べる
      if (change.to.includes('\n') ? text.includes(change.to) : lines.includes(change.to)) throw new Error(`基準の差分の新文がすでにあります：${where}`);
      target[change.stream] = target[change.stream].map((value, index) => (index === entry ? lines.map((line) => (line === change.from ? change.to : line)).join('\n') : value));
    }
  }
  return cases;
}

/** 原本のハッシュと差分の記録を確かめ、原本に承認済みの差分を当てた、いまの CLI の期待値を返す */
export function currentBaseline(): BaselineCase[] {
  if (originalBaselineSha256() !== ORIGINAL_BASELINE_SHA256) throw new Error('基準mainの原本 reference-cli-baseline.json が書き換えられています');
  const changes = baselineChanges();
  const problems = baselineChangeProblems(changes);
  if (problems.length > 0) throw new Error(`基準の差分の記録が不正です：${problems.join('、')}`);
  return applyBaselineChanges(originalBaseline().cases, changes);
}
