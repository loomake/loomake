import { lstatSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { UsageError } from './errors.js';

/** report をルートからの POSIX 相対パスにそろえる。 */
export function normalizeReportPath(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new UsageError('loomake.config.json の tests.report は空でない文字列にしてください');
  const path = value.replace(/\\/g, '/');
  const parts = path.split('/');
  if (Array.from(path).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..') || ['', '.'].includes(parts.at(-1) ?? '')) {
    throw new UsageError('loomake.config.json の tests.report は、プロジェクト内のファイルを指す相対パスにしてください');
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/');
}

/** 存在する各要素を確認する。最後の内部リンクはリンクだけを削除できる。 */
export function assertReportTarget(root: string, report: string): void {
  const canonicalRoot = realpathSync(root);
  const parts = report.split('/');
  for (let i = 0; i < parts.length; i++) {
    const path = join(root, ...parts.slice(0, i + 1));
    try {
      const entry = lstatSync(path);
      const actual = realpathSync(path);
      const rel = relative(canonicalRoot, actual);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('プロジェクトの外を指しています');
      const target = entry.isSymbolicLink() ? statSync(path) : entry;
      if (i === parts.length - 1 ? !target.isFile() : !target.isDirectory()) throw new Error(i === parts.length - 1 ? '通常のファイルではありません' : '途中の要素がディレクトリではありません');
    } catch (error) {
      // lstat の ENOENT だけが未作成。リンク先の ENOENT は拒む。
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try { lstatSync(path); } catch (missing) { if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return; }
      }
      throw new UsageError(`loomake.config.json の tests.report「${report}」を使えません（${(error as Error).message}）`, { cause: error });
    }
  }
}

/** gitignore のパターン文字を引用し、ルートの一つのファイルを除外する。 */
export function reportIgnoreLine(report: string): string {
  let line = report.replace(/[*?[]/g, '\\$&').replace(/^[#!]/, '\\$&').replace(/^ +/, (spaces) => spaces.replace(/ /g, '\\ ')).replace(/ +$/, (spaces) => spaces.replace(/ /g, '\\ '));
  if (!report.includes('/')) line = `/${line}`;
  return line;
}
