import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { VerifyResult } from '@loomake/core';
import { UsageError, loadConfig, runVerify } from '@loomake/kit';

/** 証拠の記録の形の版。report が読むので、形を変えたら上げる（add-trace-record の仮定 A-04） */
export const EVIDENCE_SCHEMA_VERSION = 1;

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
};

export const EVIDENCE_DIR = '.loomake/evidence';

function git(root: string, args: string[]): string {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new UsageError(`git ${args.join(' ')} に失敗しました。git のリポジトリの中で実行してください（${(r.stderr || r.error?.message || '').trim()}）`);
  }
  return r.stdout;
}

/** 記録のファイル名の日時の部分：YYYYMMDDTHHMMSSZ（add-trace-record の仮定 A-03） */
const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');

/** verify --done を実行し、結果を証拠として記録する。終了コード（合格 0・不合格や中止 1）を返す（REQ-066） */
export function runRecord(options: RecordOptions): number {
  const { changeId, stdout, progress = () => {}, now = () => new Date() } = options;
  const root = resolve(options.root);
  const config = loadConfig(root);
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (changeId === 'archive' || !existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    throw new UsageError(`change「${changeId}」がありません（${config.openspecDir}/changes/${changeId}）`);
  }

  // 追跡していないファイルも含め、.gitignore で除外したものは含めない（REQ-067、仮定 A-02）
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  if (dirty.length) {
    stdout('作業ツリーに未コミットの変更があるので、記録しませんでした。コミットしてから、もう一度実行してください。');
    stdout(dirty.map((l) => `  ${l}`).join('\n'));
    return 1;
  }
  const sha = git(root, ['rev-parse', 'HEAD']).trim();
  const committedAt = git(root, ['show', '-s', '--format=%cI', 'HEAD']).trim();

  const result = runVerify({ root, changeId, gate: 'done', progress });
  const recordedAt = now();
  const evidence: Evidence = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    change: changeId,
    sha,
    committedAt,
    recordedAt: recordedAt.toISOString(),
    verify: result,
  };

  const dir = join(root, EVIDENCE_DIR, changeId);
  const rel = `${EVIDENCE_DIR}/${changeId}/${stamp(recordedAt)}-${sha.slice(0, 12)}.json`;
  mkdirSync(dir, { recursive: true });
  // 既存の記録は書き換えない（REQ-068）。同じ名前があれば書かずに止める
  try {
    writeFileSync(join(root, rel), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    stdout(`${rel} がすでにあるので、記録しませんでした。記録は書き換えません。`);
    return 1;
  }
  stdout(`verify の結果（${result.ok ? '合格' : '不合格'}）を記録しました：${rel}`);
  stdout(`このファイルを git にコミットしてください：git add ${rel} && git commit`);
  return result.ok ? 0 : 1;
}
