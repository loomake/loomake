import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runExternal } from '@loomake/kit';
import type { VerifyResult } from '@loomake/core';
import { UsageError, assertChangeId, loadConfig, runVerify } from '@loomake/kit';
import { changedDocuments, readDocuments, type EvidenceDocument } from './documents.js';

import { EVIDENCE_SCHEMA_VERSION } from './schema.js';
import { serializeEvidence } from './serialization.js';
import { publishEvidence } from './publication.js';
export { EVIDENCE_SCHEMA_VERSION } from './schema.js';

/** `.loomake/evidence/<change-id>/` に置く 1 回分の記録 */
export type Evidence = {
  schemaVersion: number;
  change: string;
  /** 検査したコミットの SHA（全体） */
  sha: string;
  /** 検査したコミットの日時（ISO 8601） */
  committedAt: string;
  /** 記録した日時（ISO 8601、UTC） */
  recordedAt: string;
  verify: VerifyResult;
  /** 検証した時点の trace.md と差分仕様（REQ-127）。古い記録にはない */
  documents?: EvidenceDocument[];
};

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

/** verify --done を実行し、結果を証拠として記録する。終了コード（合格 0・不合格や中止 1）を返す（REQ-066） */
export function runRecord(options: RecordOptions): number {
  const { changeId, stdout, progress = () => {}, now = () => new Date() } = options;
  const root = resolve(options.root);
  const config = loadConfig(root);
  assertChangeId(changeId);
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (changeId === 'archive' || !existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
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

  const result = runVerify({ root, changeId, gate: 'done', progress, timeoutMs: options.timeoutMs });
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
  stdout(`verify の結果（${result.ok ? '合格' : '不合格'}）を記録しました：${rel}`);
  stdout(`このファイルを git にコミットしてください：git add ${rel} && git commit`);
  return result.ok ? 0 : 1;
}
