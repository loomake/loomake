import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 使い方や設定の誤り。CLI は終了コード 2 で終える（REQ-041） */
export class UsageError extends Error {}

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
  /** 知らないキー（`tests.reprot` のようにドットでつなぐ）。打ち間違いに気づけるよう、verify と doctor が示す */
  unknownKeys: string[];
};

export const DEFAULT_TEST_REPORT = '.loomake/test-report.json';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 知っているキー。値が配列のキーは、その下のキーも確かめる。commands の下は利用者が名前を決めるので確かめない。
 * run の下は runner が読むキーで、runner のテストがこの一覧とずれていないかを確かめる（warn-unknown-config-keys の仮定 A-01）
 */
export const KNOWN_CONFIG_KEYS: Readonly<Record<string, readonly string[] | null>> = {
  $comment: null,
  openspecDir: null,
  openspecValidate: null,
  tests: ['report'],
  commands: null,
  run: ['maxFixes', 'timeoutMinutes', 'maxOutputBytes', 'maxLogBytes', 'maxHistoryBytes'],
};

const unknownKeys = (c: Record<string, unknown>): string[] =>
  Object.entries(c).flatMap(([key, value]) => {
    // toString のような、継承したプロパティと同じ名前のキーを知っているキーとみなさない
    if (!Object.hasOwn(KNOWN_CONFIG_KEYS, key)) return [key];
    const known = KNOWN_CONFIG_KEYS[key];
    return known && isObject(value) ? Object.keys(value).filter((k) => !known.includes(k)).map((k) => `${key}.${k}`) : [];
  });

/** root の loomake.config.json を読み、既定値と合わせて返す。形が正しくないときは UsageError を投げる */
export function loadConfig(root: string): LoomakeConfig {
  const base: LoomakeConfig = { openspecDir: 'openspec', openspecValidate: 'auto', tests: { report: DEFAULT_TEST_REPORT }, commands: {}, unknownKeys: [] };
  const p = join(root, 'loomake.config.json');
  if (!existsSync(p)) return base;
  let c: unknown;
  try {
    c = JSON.parse(readFileSync(p, 'utf8'));
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
    unknownKeys: unknownKeys(c),
  };
}

/** OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）。OpenSpec 1.14 の KEBAB_ID_REGEX と同じ（fix-evaluation-findings の仮定 A-01） */
export const CHANGE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * change-id を OpenSpec の change 名の形に限る。changes/ の外を指さず、Windows でシェルの記号が渡らないようにする。
 * archive は完了した change の置き場なので、change-id に使えない（fix-evaluation-findings の仮定 A-01）
 */
export function assertChangeId(changeId: string): void {
  if (!CHANGE_ID.test(changeId)) {
    throw new UsageError(`change-id「${changeId}」は、英小文字・数字と、間に 1 つずつのハイフンで書いてください（パスの区切りや大文字は使えません）`);
  }
  if (changeId === 'archive') throw new UsageError('archive は change-id に使えません。完了した change の置き場です');
}
