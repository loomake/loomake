import { spawnSync } from 'node:child_process';
import { UsageError } from '@loomake/kit';

/** git を実行して標準出力を返す。失敗したら UsageError を投げる */
export function git(root: string, env: NodeJS.ProcessEnv, args: string[]): string {
  const r = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new UsageError(`git ${args.join(' ')} に失敗しました（${(r.stderr || r.error?.message || '').trim()}）`);
  }
  return r.stdout;
}

/** 未コミットの変更。追跡していないファイルを含み、.gitignore で除外したものは含めない（add-run-loop の仮定 A-02） */
export const dirtyFiles = (root: string, env: NodeJS.ProcessEnv) =>
  git(root, env, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);

export const branchExists = (root: string, env: NodeJS.ProcessEnv, branch: string) =>
  spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root, env }).status === 0;
