import { existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { createInputReader } from '../runtime/input.js';

import { InputReadFailure, UsageError } from '../runtime/errors.js';
export { RuntimeFailure, UsageError } from '../runtime/errors.js';

export type LoomakeConfig = {
  openspecDir: string;
  /** OpenSpec CLI が無いとき、auto なら警告、true なら不合格、false なら validate を実行しない */
  openspecValidate: boolean | 'auto';
  tests: {
    /** test コマンドが書き出すテストランナーの JSON レポート */
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

/** root の loomake.config.json を読み、既定値と合わせて返す。OS読取失敗は内部InputReadFailure、形が正しくないときはUsageErrorを投げる */
export function loadConfig(root: string): LoomakeConfig {
  return readConfig(root, existsSync);
}

/** verifyだけ存在照会のOS失敗も区別する。共有利用側の不在判定は変えず、indexからexportしない（REQ-395）。 */
export function loadVerifyConfig(root: string): LoomakeConfig {
  return readConfig(root, (p) => {
    try { lstatSync(p); return true; } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return false;
      throw new InputReadFailure(`loomake.config.json を読めません（${(e as Error).message}）`, { cause: e });
    }
  });
}

function readConfig(root: string, present: (path: string) => boolean): LoomakeConfig {
  const base: LoomakeConfig = { openspecDir: 'openspec', openspecValidate: 'auto', tests: { report: DEFAULT_TEST_REPORT }, commands: {}, unknownKeys: [] };
  const p = join(root, 'loomake.config.json');
  if (!present(p)) { assertReportTarget(root, base.tests.report); return base; }
  let text: string;
  try { text = createInputReader().read(p); } catch (e) {
    const Failure = e instanceof InputReadFailure ? InputReadFailure : UsageError;
    throw new Failure(`loomake.config.json を読めません（${(e as Error).message}）`, { cause: e });
  }
  let c: unknown;
  try { c = JSON.parse(text); } catch (e) {
    throw new UsageError(`loomake.config.json を読めません（${(e as Error).message}）`, { cause: e });
  }
  if (!isObject(c)) throw new UsageError('loomake.config.json は JSON のオブジェクトにしてください');
  if (c.openspecDir !== undefined && typeof c.openspecDir !== 'string') throw new UsageError('loomake.config.json の openspecDir は文字列にしてください');
  if (c.openspecValidate !== undefined && ![true, false, 'auto'].includes(c.openspecValidate as never)) {
    throw new UsageError('loomake.config.json の openspecValidate は true・false・"auto" のどれかにしてください');
  }
  if (c.tests !== undefined && !isObject(c.tests)) throw new UsageError('loomake.config.json の tests はオブジェクトにしてください');
  const report = normalizeReportPath(isObject(c.tests) && c.tests.report !== undefined ? c.tests.report : DEFAULT_TEST_REPORT);
  assertReportTarget(root, report);
  if (c.commands !== undefined && (!isObject(c.commands) || !Object.values(c.commands).every((v) => typeof v === 'string' || v === null))) {
    throw new UsageError('loomake.config.json の commands は、値が文字列（または null）のオブジェクトにしてください');
  }
  return {
    openspecDir: c.openspecDir ?? base.openspecDir,
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

/** report をルートからの POSIX 相対パスにそろえる。 */
export function normalizeReportPath(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new UsageError('loomake.config.json の tests.report は空でない文字列にしてください');
  const path = value.replace(/\\/g, '/');
  const parts = path.split('/');
  const normalized = parts.filter((part) => part !== '' && part !== '.').join('/');
  if (/\p{Cc}/u.test(path) || path.startsWith('/') || /^[a-z]:/i.test(normalized) || parts.includes('..') || ['', '.'].includes(parts.at(-1) ?? '')) {
    throw new UsageError('loomake.config.json の tests.report は、プロジェクト内のファイルを指す相対パスにしてください');
  }
  return normalized;
}

/** 存在する各要素を確認する。最後の内部リンクはリンクだけを削除できる。 */
export function assertReportTarget(root: string, report: string): void {
  const canonicalRoot = realpathSync(root);
  const parts = report.split('/');
  for (let i = 0; i < parts.length; i++) {
    const path = join(root, ...parts.slice(0, i + 1));
    try {
      const entry = lstatSync(path);
      const actual = realpathSync(path);
      const rel = relative(canonicalRoot, actual);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('プロジェクトの外を指しています');
      const target = entry.isSymbolicLink() ? statSync(path) : entry;
      if (i === parts.length - 1 ? !target.isFile() : !target.isDirectory()) throw new Error(i === parts.length - 1 ? '通常のファイルではありません' : '途中の要素がディレクトリではありません');
    } catch (error) {
      // lstat の ENOENT だけが未作成。リンク先の ENOENT は拒む。
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try { lstatSync(path); } catch (missing) { if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return; }
      }
      throw new UsageError(`loomake.config.json の tests.report「${report}」を使えません（${(error as Error).message}）`, { cause: error });
    }
  }
}

/** gitignore のパターン文字を引用し、ルートの一つのファイルを除外する。 */
export function reportIgnoreLine(report: string): string {
  let line = report.replace(/[\\*?[]/g, '\\$&').replace(/^[#!]/, '\\$&').replace(/^ +| +$/g, (spaces) => '\\ '.repeat(spaces.length));
  if (!report.includes('/')) line = `/${line}`;
  return line;
}
