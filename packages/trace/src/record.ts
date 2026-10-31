import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runExternal } from '@loomake/kit';
import type { VerifyResult, VerifyScope, Evidence } from '@loomake/core';
import { RuntimeFailure, UsageError, assertChangeId, type QualitySchemaLike, isAbortedResult, loadConfig, runVerify, verifyAbortedResult, verifyExitCode } from '@loomake/kit';
import { changedDocuments, readDocuments } from './documents.js';

import { EVIDENCE_SCHEMA_VERSION } from './schema.js';
import { serializeEvidence } from './serialization.js';
import { publishEvidence } from './publication.js';
export { EVIDENCE_SCHEMA_VERSION } from './schema.js';

export type { Evidence } from '@loomake/core';

export type RecordOptions = {
  /** プロジェクトのルート（loomake.config.json のあるディレクトリ） */
  root: string;
  changeId: string;
  stdout: (text: string) => void;
  /** verify の進捗の表示先 */
  progress?: (text: string) => void;
  /** 記録した日時。テストで時刻を決めるために渡す */
  now?: () => Date;
  /** 自動実装から渡す品質コマンドの残り時間。省略時は従来どおり上限なし。 */
  timeoutMs?: number;
  /** 今回の検証結果を呼び出し側へ通知する。 */
  onVerify?: (result: VerifyResult) => void;
  /** verify の scope。省略すると ci。local の記録は最終 CI の合格を表さない（REQ-315） */
  scope?: VerifyScope;
  /** quality.yaml のスキーマ。`await loadVerifyQualitySchema()` の結果を渡す。ci の記録では必須（REQ-319） */
  qualitySchema?: QualitySchemaLike;
};

export const EVIDENCE_DIR = '.loomake/evidence';

function git(root: string, args: string[]): string {
  const r = runExternal('git', args, { cwd: root });
  if (r.error || r.status !== 0) {
    throw new UsageError(`git ${args.join(' ')} に失敗しました。git のリポジトリの中で実行してください（${(r.stderr || r.error?.message || '').trim()}）`);
  }
  return r.stdout;
}

/** 記録のファイル名の日時の部分：YYYYMMDDTHHMMSSZ */
const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');

/**
 * verify --done を実行し、2.0.0 の結果を Evidence 2 として記録する（REQ-066・REQ-315）。終了コードは verify と同じ（verifyExitCode）。
 * 検査を始める前の未コミットの変更と、検査のあいだの変化では記録せず 1 を返す
 */
export function runRecord(options: RecordOptions): number {
  const { changeId, stdout, progress = () => {}, now = () => new Date() } = options;
  const root = resolve(options.root);
  const config = loadConfig(root);
  assertChangeId(changeId);
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    throw new UsageError(`change「${changeId}」がありません（${config.openspecDir}/changes/${changeId}）`);
  }

  // 追跡していないファイルも含め、.gitignore で除外したものは含めない（REQ-067）
  const dirtyFiles = () => git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  const dirty = dirtyFiles();
  if (dirty.length) {
    stdout('作業ツリーに未コミットの変更があるので、記録しませんでした。コミットしてから、もう一度実行してください。');
    stdout(dirty.map((l) => `  ${l}`).join('\n'));
    return 1;
  }
  const sha = git(root, ['rev-parse', 'HEAD']).trim();
  const committedAt = git(root, ['show', '-s', '--format=%cI', 'HEAD']).trim();

  const documents = readDocuments(changeDir);

  const scope = options.scope ?? 'ci';
  let result: VerifyResult;
  try {
    result = runVerify({ root, changeId, gate: 'done', scope, progress, timeoutMs: options.timeoutMs, qualitySchema: options.qualitySchema });
  } catch (error) {
    // change が確定したあとの実行時の失敗は、aborted として記録する。使い方の誤りは記録しない（REQ-315）
    if (!(error instanceof RuntimeFailure)) throw error;
    result = verifyAbortedResult(error, changeId);
  }
  options.onVerify?.(result);
  // 検査のあいだに HEAD・作業ツリー・文書が変わったら、どの内容を検査したか分からないので記録しない（REQ-128）。
  // .gitignore で除外したテストのレポートなどは、変更とみなさない
  const changed = [
    git(root, ['rev-parse', 'HEAD']).trim() !== sha && 'HEAD のコミット',
    dirtyFiles().length > 0 && '作業ツリーのファイル',
    changedDocuments(documents, readDocuments(changeDir)).length > 0 && 'trace.md か差分仕様',
  ].filter((x): x is string => Boolean(x));
  if (changed.length) {
    stdout(`検査のあいだに${changed.join('・')}が変わったので、記録しませんでした。変わった理由を確かめてから、もう一度実行してください。`);
    const after = dirtyFiles();
    if (after.length) stdout(after.map((l) => `  ${l}`).join('\n'));
    return 1;
  }
  const recordedAt = now();
  const evidence: Evidence = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    change: changeId,
    sha,
    committedAt,
    recordedAt: recordedAt.toISOString(),
    verify: result,
    documents,
  };

  const json = serializeEvidence(evidence);
  const rel = `${EVIDENCE_DIR}/${changeId}/${stamp(recordedAt)}-${sha.slice(0, 12)}.json`;
  if (!publishEvidence(join(root, rel), json)) {
    stdout(`${rel} がすでにあるので、記録しませんでした。記録は書き換えません。`);
    return 1;
  }
  const code = verifyExitCode(result);
  stdout(`verify の結果（${resultLabel(result, code)}）を記録しました：${rel}`);
  stdout(`このファイルを git にコミットしてください：git add ${rel} && git commit`);
  return code;
}

/** 記録した結果の短い説明。local の完了を最終合格と呼ばない（REQ-311） */
function resultLabel(result: VerifyResult, code: number): string {
  if (isAbortedResult(result)) return '中止';
  if (result.scope === 'local') return code === 0 ? 'ローカルの項目はすべて完了。CI の最終合格は未確認' : 'ローカルの項目が未完了';
  return code === 0 ? '合格' : '不合格';
}
