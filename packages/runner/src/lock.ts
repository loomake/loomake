import { randomUUID } from 'node:crypto';
import { lstatSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { UsageError, createInputReader } from '@loomake/kit';
import { git } from './git.js';

type Owner = { pid: number; host: string; token: string };

export class RunBusyError extends Error {}

function ownerOf(file: string): Owner | undefined {
  try {
    if (!lstatSync(file).isFile()) return undefined;
    const value: unknown = JSON.parse(createInputReader().read(file));
    if (typeof value !== 'object' || value === null) return undefined;
    const row = value as Record<string, unknown>;
    if (typeof row.pid !== 'number' || !Number.isInteger(row.pid) || row.pid <= 0 || row.pid > 2_147_483_647 || typeof row.host !== 'string' || !row.host || typeof row.token !== 'string' || !row.token) return undefined;
    return row as Owner;
  } catch { return undefined; }
}

function create(file: string, owner: Owner): boolean {
  try {
    writeFileSync(file, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw new UsageError(`実行ロックを作れません：${file}（${(error as Error).message}）`);
  }
}

function removeOwned(file: string, token: string) {
  if (ownerOf(file)?.token === token) unlinkSync(file);
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}

/** Git作業ツリーのロックを取得し、自分の所有分だけを解放する関数を返す。 */
export function acquireRunLock(root: string, env: NodeJS.ProcessEnv): () => void {
  const file = join(git(root, env, ['rev-parse', '--absolute-git-dir']).trim(), 'loomake-run.lock');
  const owner: Owner = { pid: process.pid, host: hostname(), token: randomUUID() };
  const guide = `同じ作業ツリーの実行ロックがあります：${file}。所有プロセスとホストを確認してください。終了したことを確認できた場合だけ専用ロックを取り除き、もう一度実行してください。`;
  if (!create(file, owner)) {
    const recovery = `${file}.recovery`;
    if (!create(recovery, owner)) throw new RunBusyError(`${guide} 回復用ロック ${recovery} も確認してください。`);
    try {
      const previous = ownerOf(file);
      if (!previous || previous.host !== owner.host || alive(previous.pid)) throw new RunBusyError(`${guide}${previous ? ` 所有者：PID ${previous.pid}、ホスト ${previous.host}` : ''}`);
      unlinkSync(file);
      if (!create(file, owner)) throw new RunBusyError(guide);
    } finally { removeOwned(recovery, owner.token); }
  }
  return () => removeOwned(file, owner.token);
}
