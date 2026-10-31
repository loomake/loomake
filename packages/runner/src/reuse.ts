import { join } from 'node:path';
import { EVIDENCE_V2_SCHEMA_VERSION, type Evidence } from '@loomake/core';
import { UsageError, createInputReader, JSON_LIMITS, isAbortedResult, verifyExitCode } from '@loomake/kit';
import { changedDocuments, evidenceProblem, readDocuments } from '@loomake/trace';
import { dirtyFiles, git } from './git.js';

/**
 * 直前の証拠だけのコミットを再利用する。不正な候補は保ったまま停止する。
 * 再利用するのは Evidence 2 の scope:local の完了だけ。Evidence 1 は履歴の閲覧に限り、再利用せずに新しい検証と記録へ進む（REQ-164）
 */
export function reusableEvidence(root: string, env: NodeJS.ProcessEnv, change: string, changeDir: string): string | undefined {
  if (dirtyFiles(root, env).length) throw new UsageError('検証後に未コミットの変更があるため、証拠を再利用しません。変更を確認してから、もう一度実行してください。');
  const parents = git(root, env, ['show', '-s', '--format=%P', 'HEAD']).trim().split(' ').filter(Boolean);
  if (parents.length !== 1) return undefined;
  const fields = git(root, env, ['diff', '--name-status', '--no-renames', '-z', 'HEAD^', 'HEAD']).split('\0').filter(Boolean);
  if (fields.length !== 2 || fields[0] !== 'A') return undefined;
  const file = fields[1];
  const prefix = `.loomake/evidence/${change}/`;
  if (!file.startsWith(prefix) || !/^\d{8}T\d{6}Z-[0-9a-f]{12}\.json$/.test(file.slice(prefix.length))) return undefined;
  const stop = (reason: string): never => { throw new UsageError(`直前の証拠を再利用できません：${file}（${reason}）。証拠とコミットを確認してください。`); };
  let value: unknown;
  try {
    value = JSON.parse(createInputReader(JSON_LIMITS).read(join(root, file)));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    return stop('JSONファイルを読み取れません');
  }
  const problem = evidenceProblem(value, change);
  if (problem) return stop(problem);
  // 旧 Evidence 1 は再利用の根拠にしない。ファイルは削除せず、通常の検証と記録を行う（REQ-164）
  if ((value as { schemaVersion: unknown }).schemaVersion !== EVIDENCE_V2_SCHEMA_VERSION) return undefined;
  const evidence = value as Evidence;
  // Evidence 2 は scope:local の完了で、不合格や不足の検査がないものだけを再利用する（REQ-205）
  const verify = evidence.verify;
  if (isAbortedResult(verify) || verify.scope !== 'local' || verifyExitCode(verify) !== 0 || verify.checks.some((c) => c.result === 'FAIL' || c.result === 'INSUFFICIENT_EVIDENCE')) {
    return stop('ローカルの項目がすべて完了した証拠（scope:local）ではありません');
  }
  if (evidence.sha !== parents[0] || !file.endsWith(`-${evidence.sha.slice(0, 12)}.json`)) return stop('対象SHAが直前の親コミットと一致しません');
  if (!evidence.documents) return stop('文書のスナップショットがありません');
  if (changedDocuments(evidence.documents, readDocuments(changeDir)).length) return stop('現在の文書と一致しません');
  return file;
}
