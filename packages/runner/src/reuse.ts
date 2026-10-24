import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError } from '@loomake/kit';
import { changedDocuments, evidenceProblem, readDocuments, type Evidence } from '@loomake/trace';
import { dirtyFiles, git } from './git.js';

/** 直前の証拠だけのコミットを再利用する。不正な候補は保ったまま停止する。 */
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
    if (!lstatSync(join(root, file)).isFile()) return stop('通常のファイルではありません');
    value = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch { return stop('JSONファイルを読み取れません'); }
  const problem = evidenceProblem(value, change);
  if (problem) return stop(problem);
  const evidence = value as Evidence;
  if (!evidence.verify.ok || evidence.verify.results.some((result) => result.status === 'fail')) return stop('合格した証拠ではありません');
  if (evidence.sha !== parents[0] || !file.endsWith(`-${evidence.sha.slice(0, 12)}.json`)) return stop('対象SHAが直前の親コミットと一致しません');
  if (!evidence.documents) return stop('文書のスナップショットがありません');
  if (changedDocuments(evidence.documents, readDocuments(changeDir)).length) return stop('現在の文書と一致しません');
  return file;
}
