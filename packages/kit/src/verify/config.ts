import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInputReader } from '../input.js';

import { UsageError } from '../errors.js';
export { RuntimeFailure, UsageError } from '../errors.js';

export type LoomakeConfig = {
  openspecDir: string;
  /** OpenSpec CLI が無いとき、auto なら警告、true なら不合格、false なら validate を実行しない（add-verify-cli の仮定 A-01） */
  openspecValidate: boolean | 'auto';
  tests: {
    /** test コマンドが書き出すテストランナーの JSON レポート（add-verify-cli の仮定 A-05） */
    report: string;
  };
  /** lint・typecheck・test などの品質コマンド。値が空か null のコマンドは実行しない */
  commands: Record<string, string | null>;
};

export const DEFAULT_TEST_REPORT = '.loomake/test-report.json';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** root の loomake.config.json を読み、既定値と合わせて返す。形が正しくないときは UsageError を投げる */
export function loadConfig(root: string): LoomakeConfig {
  const base: LoomakeConfig = { openspecDir: 'openspec', openspecValidate: 'auto', tests: { report: DEFAULT_TEST_REPORT }, commands: {} };
  const p = join(root, 'loomake.config.json');
  if (!existsSync(p)) return base;
  let c: unknown;
  try {
    c = JSON.parse(createInputReader().read(p));
  } catch (e) {
    throw new UsageError(`loomake.config.json を読めません（${(e as Error).message}）`, { cause: e });
  }
  if (!isObject(c)) throw new UsageError('loomake.config.json は JSON のオブジェクトにしてください');
  if (c.openspecDir !== undefined && typeof c.openspecDir !== 'string') throw new UsageError('loomake.config.json の openspecDir は文字列にしてください');
  if (c.openspecValidate !== undefined && ![true, false, 'auto'].includes(c.openspecValidate as never)) {
    throw new UsageError('loomake.config.json の openspecValidate は true・false・"auto" のどれかにしてください');
  }
  if (c.tests !== undefined && !isObject(c.tests)) throw new UsageError('loomake.config.json の tests はオブジェクトにしてください');
  const report = isObject(c.tests) && c.tests.report !== undefined ? c.tests.report : DEFAULT_TEST_REPORT;
  if (typeof report !== 'string' || report === '') throw new UsageError('loomake.config.json の tests.report は空でない文字列にしてください');
  if (c.commands !== undefined && (!isObject(c.commands) || !Object.values(c.commands).every((v) => typeof v === 'string' || v === null))) {
    throw new UsageError('loomake.config.json の commands は、値が文字列（または null）のオブジェクトにしてください');
  }
  return {
    openspecDir: (c.openspecDir as string | undefined) ?? base.openspecDir,
    openspecValidate: (c.openspecValidate as LoomakeConfig['openspecValidate'] | undefined) ?? base.openspecValidate,
    tests: { report },
    commands: (c.commands as LoomakeConfig['commands'] | undefined) ?? {},
  };
}

/** change-id にパスの区切りを含めない。changes/ の外を指さないようにする（fix-review-findings-2 の仮定 A-05） */
export function assertChangeId(changeId: string): void {
  if (/[/\\]/.test(changeId) || changeId.includes('..')) {
    throw new UsageError(`change-id「${changeId}」には、パスの区切り（/・\\・..）を含められません`);
  }
}
