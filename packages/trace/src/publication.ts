import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { UsageError } from '@loomake/kit';

/** 完全な一時ファイルを最終名へ公開する。既存名は上書きせずfalseを返す。 */
export function publishEvidence(file: string, content: string): boolean {
  const directory = dirname(file);
  const temporary = join(directory, `.loomake-evidence-${process.pid}-${randomUUID()}.tmp`);
  let fd: number | undefined;
  let created = false;
  let collision = false;
  let failure: unknown;
  const cleanup: string[] = [];
  try {
    mkdirSync(directory, { recursive: true });
    const stats = lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('保存先は通常のディレクトリにしてください');
    fd = openSync(temporary, 'wx', 0o600);
    created = true;
    writeFileSync(fd, content);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    try { linkSync(temporary, file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') collision = true;
      else throw error;
    }
  } catch (error) { failure = error; }
  finally {
    if (fd !== undefined) {
      try { closeSync(fd); }
      catch (error) { cleanup.push(`一時ファイルを閉じられません：${temporary}（${(error as Error).message}）`); }
    }
    if (created) {
      try { unlinkSync(temporary); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') cleanup.push(`一時ファイルの片付けに失敗しました：${temporary}（${(error as Error).message}）`);
      }
    }
  }
  if (failure || cleanup.length) {
    const details = [failure && (failure as Error).message, ...cleanup].filter(Boolean).join('。');
    throw new UsageError(`証拠を保存できません：${file}（${details}）。保存先と作業状態を確認してから、もう一度実行してください。`, { cause: failure });
  }
  return !collision;
}
