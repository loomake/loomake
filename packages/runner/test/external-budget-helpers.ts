import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect } from 'vitest';
import { runRun } from '@loomake/runner';
import { CHANGE, stallOf, type FakeCli, type FakeCliEvent, type Repo } from './helpers.js';

// external-budget.test.ts と external-budget-deadline.test.ts が共有する、外部操作の期限の試験の補助
const DIAGNOSTIC_BYTES = 64 * 1024;
const diagnosticFile = (repo: Repo) => process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR
  ? join(process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR, `${basename(repo.base)}.jsonl`)
  : join(repo.base, 'budget-events.jsonl');
export function diagnosticEvent(repo: Repo, event: string, details: object = {}): void {
  const file = diagnosticFile(repo);
  const used = existsSync(file) ? statSync(file).size : 0;
  if (used >= DIAGNOSTIC_BYTES) return;
  appendFileSync(file, Buffer.from(JSON.stringify({ event, at: Date.now(), ...details }) + '\n').subarray(0, DIAGNOSTIC_BYTES - used));
}
export function diagnosticContext(repo: Repo, details: object, cli?: FakeCli): string {
  const file = diagnosticFile(repo);
  const value = JSON.stringify({ ...details, stalled: existsSync(join(repo.base, 'stalled')), events: existsSync(file) ? readFileSync(file, 'utf8') : '', fake: cli?.events() ?? [] });
  const context = Buffer.from(value).subarray(0, DIAGNOSTIC_BYTES).toString('utf8');
  const output = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_FILE;
  if (output) writeFileSync(output, context, { flag: 'wx' });
  return context;
}
// 偽の CLI が狙った操作で止まり、それより前の本物への転送が起動に失敗していないことを、期限の検査より先に確かめる（docs/dev/testing-across-os.md）
export function expectStalled(cli: FakeCli, match: (args: string[]) => boolean, context: string) {
  const { stall, failedForwards } = stallOf(cli, match);
  expect(failedForwards, context).toEqual([]);
  expect(stall, context).toBeDefined();
  // シグナルで終わった転送も、止まる前の操作の失敗として扱う（main の expectStalledAt から引き継ぐ）
  const events = cli.events();
  const index = events.findIndex((e) => e.event === 'stall-start' && match(e.args));
  expect(events.slice(0, index).filter((e) => e.event === 'forward-end' && e.signal), context).toEqual([]);
  return stall!;
}
// 期限から止まるまでの猶予（windows-fake-clis の仮定 A-03）。監視役の SIGTERM から SIGKILL までの 250ms、子の終了を待つ最大 1 秒、
// Windows の taskkill の最大 1 秒と、親へ戻るまでの分
export const STOP_GRACE_MS = 3000;
// 1 操作の期限で止める試験で、偽の CLI が止まる時間。期限に猶予を足した時間より長くし、偽の CLI が自分で終わったのではなく止められたと分かるようにする
export const STALL_MS = 10_000;
// Date.now() と監視役の単調時計の丸めの差
export const CLOCK_SLACK_MS = 50;
export const OPERATION_MS = 500;
// 止まった印から止まるまでが、期限に猶予を足した時間より短いことを確かめる（docs/dev/testing-across-os.md）
export function expectStoppedSoon(stall: FakeCliEvent, endedAt: number, limitMs: number, context: string) {
  expect(endedAt - stall.at, context).toBeLessThan(limitMs + STOP_GRACE_MS);
}
export async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
export const summary = (repo: Repo) => { const dir = join(repo.root, '.loomake/runs'); const run = readdirSync(dir).filter((s) => s !== '.gitignore').sort().at(-1)!; return JSON.parse(readFileSync(join(dir, run, 'summary.json'), 'utf8')); };
