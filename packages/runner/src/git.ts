import { runExternal } from '@loomake/kit';

/** git の操作の失敗。run を始める前なら使い方の誤り、始めたあとなら実行中の失敗として扱う（REQ-137） */
export class GitError extends Error {}

/** git を実行して標準出力を返す。失敗したら GitError を投げる */
export function git(root: string, env: NodeJS.ProcessEnv, args: string[]): string {
  const r = runExternal('git', args, { cwd: root, env });
  if (r.error || r.status !== 0) {
    throw new GitError(`git の操作に失敗しました：git ${args.join(' ')}（${(r.stderr || r.error?.message || '').trim()}）`);
  }
  return r.stdout;
}

/** 未コミットの変更。追跡していないファイルを含み、.gitignore で除外したものは含めない（add-run-loop の仮定 A-02） */
export const dirtyFiles = (root: string, env: NodeJS.ProcessEnv) =>
  git(root, env, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);

export const branchExists = (root: string, env: NodeJS.ProcessEnv, branch: string) =>
  runExternal('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root, env }).status === 0;

/** git の設定の値。なければ空の文字列 */
export const gitConfig = (root: string, env: NodeJS.ProcessEnv, key: string) =>
  (runExternal('git', ['config', '--get', key], { cwd: root, env }).stdout ?? '').trim();

/** .gitignore で除外されているか。追跡しているファイルは除外されていないとみなす */
export const isIgnored = (root: string, env: NodeJS.ProcessEnv, path: string) =>
  runExternal('git', ['check-ignore', '-q', '--', path], { cwd: root, env }).status === 0;
