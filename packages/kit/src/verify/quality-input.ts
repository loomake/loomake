import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { Quality, VerifyRunError } from '@loomake/core';
import { createInputReader, type InputReader } from '../runtime/input.js';

/** プロジェクトルートの品質基準のファイル名（要件定義 7.1） */
export const QUALITY_FILE = 'quality.yaml';

/** 既存の導入へ案内する最小の quality.yaml（REQ-310） */
export const MINIMAL_QUALITY_YAML = 'version: 2\nmodel: iso-iec-25010-2011\n';

/**
 * quality.yaml の Zod スキーマのうち、ここで使う部分。kit は zod を読まないので、呼び出し側が
 * `(await loadQualitySchema()).qualitySchema` を渡す
 */
export type QualitySchemaLike = {
  safeParse(input: unknown):
    | { success: true; data: Quality }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };
};

export type QualityReadOptions = {
  root: string;
  /** spec-only では不在を許す。done では不在を読取不能とする */
  gate: 'spec-only' | 'done';
  schema: QualitySchemaLike;
  /** 読み取りの予算。省略すると、この読み取りだけの予算を作る */
  reader?: InputReader;
};

export type QualityReadResult =
  | { status: 'loaded'; quality: Quality }
  | { status: 'absent' }
  | { status: 'error'; error: VerifyRunError };

const MINIMAL_HINT = `リポジトリ直下に最小の quality.yaml（version: 2 と model の 2 行）を手で作成してください`;

const errorOf = (kind: VerifyRunError['kind'], message: string, next: string): QualityReadResult =>
  ({ status: 'error', error: { kind, target: QUALITY_FILE, message, next } });

const codeOf = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;
const isPermission = (text: string) => /\b(EACCES|EPERM)\b/.test(text);

/**
 * root の quality.yaml を読み、スキーマの既定値を補って返す（REQ-310）。同期で、例外を投げずに結果で返す。
 * 構文・型・版・対象外の必須値の誤りは config（終了コード 2）、権限不足は permission、
 * 完了ゲートでの不在やほかの読取の失敗は runtime（終了コード 3）にする。spec-only の不在は absent を返す
 */
export function readQualityFile(options: QualityReadOptions): QualityReadResult {
  const path = join(options.root, QUALITY_FILE);
  try {
    lstatSync(path);
  } catch (error) {
    const code = codeOf(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return options.gate === 'spec-only'
        ? { status: 'absent' }
        : errorOf('runtime', '完了ゲートに必要な quality.yaml がありません', MINIMAL_HINT);
    }
    if (code === 'EACCES' || code === 'EPERM') return errorOf('permission', 'quality.yaml を読む権限がありません', 'quality.yaml とリポジトリ直下の読み取り権限を確認してください');
    return errorOf('runtime', `quality.yaml を読めません（${(error as Error).message}）`, 'ファイルの状態を確認して、もう一度実行してください');
  }
  let text: string;
  try {
    text = (options.reader ?? createInputReader()).read(path);
  } catch (error) {
    const message = (error as Error).message;
    return isPermission(message)
      ? errorOf('permission', 'quality.yaml を読む権限がありません', 'quality.yaml の読み取り権限を確認してください')
      : errorOf('runtime', `quality.yaml を読めません（${message}）`, 'ファイルの種類と大きさを確認してください。シンボリックリンクと 1 MiB を超えるファイルは読みません');
  }
  const document = parseDocument(text, { prettyErrors: false });
  if (document.errors.length) {
    const first = document.errors[0];
    const line = first.linePos?.[0].line;
    return errorOf('config', `quality.yaml の YAML の書き方が正しくありません${line ? `（${line} 行目）` : ''}：${first.message}`, 'YAML の書き方を直してください');
  }
  const value: unknown = document.toJS({ maxAliasCount: 100 });
  const parsed = options.schema.safeParse(value);
  if (!parsed.success) {
    const version = typeof value === 'object' && value !== null ? (value as { version?: unknown }).version : undefined;
    if (version !== undefined && version !== 2) {
      return errorOf('config', `quality.yaml の version ${JSON.stringify(version)} には対応していません（対応している版は 2）`, 'version: 2 の形式に書き直してください');
    }
    const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.map(String).join('.') || '(最上位)'}：${issue.message}`);
    return errorOf('config', `quality.yaml の内容が正しくありません：${issues.join(' / ')}`, '対象外（not_applicable）には reason と confirmed_by を書くなど、quality.yaml の内容を直してください');
  }
  return { status: 'loaded', quality: parsed.data };
}
