import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EffortCost } from '@loomake/core';
import { EFFORT_SCHEMA_VERSION } from '@loomake/core';
import { RuntimeFailure, UsageError, assertChangeId, loadConfig, maskValue, resolveChangeDir, runExternal } from '@loomake/kit';
import { EffortInputFailure, parseEffortOption, serializeEffort } from './effort-input.js';
import { PublicationFailure, publishEvidenceState } from './publication.js';
export type EffortRecordOptions = {
  root: string; changeId: string; effort: string; stdout: (text: string) => void;
  decisions?: number; attempts?: number; cost?: EffortCost[]; note?: string; now?: () => Date;
};
const failure = () => new UsageError('実績を記録できません。入力、change の所在、git と保存先の作業状態を確認してください。');
class EffortDiagnostic extends UsageError {}
class SavedEffortFailure extends RuntimeFailure {}
const inputFailure = () => new EffortDiagnostic('実作業時間の入力が不正です。時間・区分・回数・費用・メモの書式を確認してください。');
const sizeFailure = () => new EffortDiagnostic('実績記録の上限は65536バイトです。記録していません。');
const changeFailure = () => new EffortDiagnostic('change が見つからないか、archive で一意に決まりません。記録していません。');
const gitFailure = () => new EffortDiagnostic('git の状態を確認できません。記録していません。');
const saveFailure = () => new EffortDiagnostic('実績を保存できませんでした。保存先と作業状態を確認してから、もう一度実行してください。');
const savedFailure = (relative: string, phase: string) => new SavedEffortFailure(`実績は保存しました：${maskValue(relative)}。${phase}に失敗しました。もう一度記録せず、このファイルを git にコミットしてください。`);
function input<T>(action: () => T): T {
  try { return action(); } catch (error) {
    if (error instanceof EffortInputFailure && error.reason === 'size') throw sizeFailure();
    throw inputFailure();
  }
}
/** 人の申告した実作業時間だけを同期で追記する。verifyは実行しない。 */
export function runEffortRecord(options: EffortRecordOptions): number {
  try { return record(options); } catch (error) {
    if (error instanceof EffortDiagnostic || error instanceof SavedEffortFailure) throw error;
    throw failure();
  }
}
function record(options: EffortRecordOptions): number {
  const { changeId, stdout } = options;
  const root = resolve(options.root);
  const amount = input(() => parseEffortOption(options.effort));
  const extra = {
    ...(options.decisions !== undefined ? { decisions: options.decisions } : {}),
    ...(options.attempts !== undefined ? { attempts: options.attempts } : {}),
    ...(options.cost !== undefined ? { cost: options.cost } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
  };
  // 外部操作より先に申告値を検査する。原文の長さは共通置換前にも確かめる。
  input(() => serializeEffort({ schemaVersion: EFFORT_SCHEMA_VERSION, kind: 'loomake-effort', change: changeId, sha: '0'.repeat(40), recordedAt: '2000-01-01T00:00:00.000Z', ...amount, ...extra }));
  input(() => assertChangeId(changeId));
  const config = loadConfig(root);
  try {
    const location = resolveChangeDir(resolve(root, config.openspecDir, 'changes'), changeId);
    if (!('dir' in location) || !lstatSync(location.dir).isDirectory()) throw changeFailure();
  } catch { throw changeFailure(); }
  const git = (args: string[]) => {
    try {
      const result = runExternal('git', args, { cwd: root });
      if (result.error || result.status !== 0) throw gitFailure();
      return result.stdout;
    } catch { throw gitFailure(); }
  };
  const dirty = git(['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  if (dirty.length) {
    stdout('作業ツリーに未コミットの変更があるので、記録しませんでした。コミットしてから、もう一度実行してください。');
    stdout(maskValue(dirty.map((line) => `  ${line}`).join('\n')));
    return 1;
  }
  const sha = git(['rev-parse', 'HEAD']).trim();
  const recordedAt = input(() => (options.now ?? (() => new Date()))().toISOString());
  const json = input(() => serializeEffort({ schemaVersion: EFFORT_SCHEMA_VERSION, kind: 'loomake-effort', change: changeId, sha, recordedAt, ...amount, ...extra }));
  const stamp = recordedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const relative = `.loomake/evidence/${changeId}/effort/${stamp}-${sha.slice(0, 12)}.json`;
  let state: 'published' | 'collision';
  try { state = publishEvidenceState(join(root, relative), json); }
  catch (error) {
    if (error instanceof PublicationFailure && error.linked) throw savedFailure(relative, '一時ファイルの片付け');
    throw saveFailure();
  }
  if (state === 'collision') {
    stdout(maskValue(`${relative} がすでにあるので、記録しませんでした。記録は書き換えません。`));
    return 1;
  }
  try {
    stdout(maskValue(`人の実作業時間を記録しました：${relative}`));
    stdout(maskValue(`このファイルを git にコミットしてください：git add ${relative} && git commit`));
  } catch { throw savedFailure(relative, '結果の表示'); }
  return 0;
}
