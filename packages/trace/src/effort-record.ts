import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EffortCost } from '@loomake/core';
import { EFFORT_SCHEMA_VERSION } from '@loomake/core';
import { UsageError, assertChangeId, loadConfig, maskValue, resolveChangeDir, runExternal } from '@loomake/kit';
import { parseEffortOption, serializeEffort } from './effort-input.js';
import { publishEvidence } from './publication.js';
export type EffortRecordOptions = {
  root: string; changeId: string; effort: string; stdout: (text: string) => void;
  decisions?: number; attempts?: number; cost?: EffortCost[]; note?: string; now?: () => Date;
};
const failure = () => new UsageError('実績を記録できません。入力、change の所在、git と保存先の作業状態を確認してください。');
/** 人の申告した実作業時間だけを同期で追記する。verifyは実行しない。 */
export function runEffortRecord(options: EffortRecordOptions): number {
  try { return record(options); } catch { throw failure(); }
}
function record(options: EffortRecordOptions): number {
  const { changeId, stdout } = options;
  const root = resolve(options.root);
  const amount = parseEffortOption(options.effort);
  const extra = {
    ...(options.decisions !== undefined ? { decisions: options.decisions } : {}),
    ...(options.attempts !== undefined ? { attempts: options.attempts } : {}),
    ...(options.cost !== undefined ? { cost: options.cost } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
  };
  // 外部操作より先に申告値を検査する。原文の長さは共通置換前にも確かめる。
  serializeEffort({ schemaVersion: EFFORT_SCHEMA_VERSION, kind: 'loomake-effort', change: changeId, sha: '0'.repeat(40), recordedAt: '2000-01-01T00:00:00.000Z', ...amount, ...extra });
  assertChangeId(changeId);
  const config = loadConfig(root);
  const location = resolveChangeDir(resolve(root, config.openspecDir, 'changes'), changeId);
  if (!('dir' in location) || !lstatSync(location.dir).isDirectory()) throw failure();
  const git = (args: string[]) => {
    const result = runExternal('git', args, { cwd: root });
    if (result.error || result.status !== 0) throw failure();
    return result.stdout;
  };
  const dirty = git(['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  if (dirty.length) {
    stdout('作業ツリーに未コミットの変更があるので、記録しませんでした。コミットしてから、もう一度実行してください。');
    stdout(maskValue(dirty.map((line) => `  ${line}`).join('\n')));
    return 1;
  }
  const sha = git(['rev-parse', 'HEAD']).trim();
  const time = (options.now ?? (() => new Date()))();
  const recordedAt = time.toISOString();
  const json = serializeEffort({ schemaVersion: EFFORT_SCHEMA_VERSION, kind: 'loomake-effort', change: changeId, sha, recordedAt, ...amount, ...extra });
  const stamp = recordedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const relative = `.loomake/evidence/${changeId}/effort/${stamp}-${sha.slice(0, 12)}.json`;
  if (!publishEvidence(join(root, relative), json)) {
    stdout(maskValue(`${relative} がすでにあるので、記録しませんでした。記録は書き換えません。`));
    return 1;
  }
  stdout(maskValue(`人の実作業時間を記録しました：${relative}`));
  stdout(maskValue(`このファイルを git にコミットしてください：git add ${relative} && git commit`));
  return 0;
}
