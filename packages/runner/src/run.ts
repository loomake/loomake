// loomake run の入口。段階ごとの処理は run/ にある
import { resolve } from 'node:path';
import { withProcessBudget, RuntimeFailure, UsageError } from '@loomake/kit';
import { GitError, git } from './git.js';
import { maskSecrets } from './mask.js';
import { acquireRunLock, RunBusyError } from './lock.js';
import { baseKey, loadRunConfig, prepare } from './run/prepare.js';
import { recordAndOpenPr, runEngineTasks, runGate } from './run/phases.js';
import { startRecording } from './run/recorder.js';
import { taskLabel } from './run/tasks.js';
import type { RunContext, RunOptions } from './run/types.js';

export type { RunOptions, RunSummary } from './run/types.js';
export { RUN_CONFIG_KEYS } from './config.js';
export { RUNS_DIR } from './run/types.js';
export { GATE_MARK } from './run/tasks.js';
export { buildPrompt } from './run/prompt.js';
export { inContainer } from './run/prepare.js';

/** change の tasks.md を実装させ、完了ゲートが通るまで直させる。終了コード（終えた 0・止まった 1）を返す */
export async function runRun(options: RunOptions): Promise<number> {
  const config = loadRunConfig(resolve(options.root));
  return withProcessBudget({ timeoutMs: config.timeoutMinutes * 60_000 }, () => runWithinBudget(options));
}

async function runWithinBudget(options: RunOptions): Promise<number> {
  const stdout = options.stdout;
  const progress = options.progress;
  options = {
    ...options,
    stdout: (text) => stdout(maskSecrets(text)),
    progress: progress && ((text) => progress(maskSecrets(text))),
  };
  let release: () => void;
  try {
    release = acquireRunLock(resolve(options.root), options.env ?? process.env);
  } catch (error) {
    if (error instanceof RunBusyError) {
      options.stdout(error.message);
      return 1;
    }
    if (error instanceof GitError) throw new UsageError(error.message);
    throw error;
  }
  try { return await runLocked(options); }
  finally { release(); }
}

async function runLocked(options: RunOptions): Promise<number> {
  // 始める前（実行の記録を作る前）の git の失敗は、使い方の誤りにする（REQ-137）
  let ctx: RunContext | number;
  try {
    ctx = await prepare(options);
  } catch (e) {
    if (e instanceof GitError) throw new UsageError(e.message);
    throw e;
  }
  if (typeof ctx === 'number') return ctx;
  const rec = startRecording(ctx);

  try {
    // PR の向き先は、run が change のブランチを作ったときのブランチ。git の設定に覚えて再開でも使う
    if (!ctx.hasBranch) {
      git(ctx.root, ctx.env, ['switch', '-q', '-c', ctx.branch]);
      git(ctx.root, ctx.env, ['config', baseKey(ctx), ctx.startBranch]);
    }
    const stop = (await runEngineTasks(ctx, rec)) ?? (await runGate(ctx, rec));
    if (stop) return rec.finish(stop.status, stop.reason, stop.remaining);
    return recordAndOpenPr(ctx, rec);
  } catch (e) {
    // 始めたあとの git と証拠の記録の失敗は、実行中の失敗として記録に残して止まる（REQ-137）
    if (!(e instanceof GitError) && !(e instanceof UsageError) && !(e instanceof RuntimeFailure)) throw e;
    const { engineTasks, gateTasks } = ctx;
    const remaining = [...engineTasks, ...gateTasks].filter((t) => !rec.done.includes(taskLabel(t)));
    return rec.finish('stopped', e.message, remaining);
  }
}
