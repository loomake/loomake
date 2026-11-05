import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { UsageError } from '@loomake/kit';

/** 保存済みかどうかをeffort経路だけで区別する内部エラー。 */
export class PublicationFailure extends UsageError {
  constructor(message: string, readonly linked: boolean, options?: ErrorOptions) { super(message, options); }
}

/** 既存の公開契約（戻り値・診断・cause）を維持する。 */
export function publishEvidence(file: string, content: string): boolean {
  try { return publishEvidenceState(file, content) === 'published'; }
  catch (error) {
    if (error instanceof PublicationFailure) throw new UsageError(error.message, { cause: error.cause });
    throw error;
  }
}

/** 完全な一時ファイルを最終名へ公開する。既存名は上書きせずcollisionを返す。 */
export function publishEvidenceState(file: string, content: string): 'published' | 'collision' {
  const directory = dirname(file);
  const temporary = join(directory, `.loomake-evidence-${process.pid}-${randomUUID()}.tmp`);
  let fd: number | undefined;
  let created = false;
  let collision = false;
  let linked = false;
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
    try { linkSync(temporary, file); linked = true; }
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
    throw new PublicationFailure(`証拠を保存できません：${file}（${details}）。保存先と作業状態を確認してから、もう一度実行してください。`, linked, { cause: failure });
  }
  return collision ? 'collision' : 'published';
}
