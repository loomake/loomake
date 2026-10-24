// run の段階：タスクの実装、完了ゲートと直し、証拠の記録と PR
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRecord } from '@loomake/trace';
import { remainingProcessTime, INTERRUPTED, TIMED_OUT, UsageError, runVerify, createInputReader } from '@loomake/kit';
import { runClaude } from '../engine.js';
import { git, gitConfig } from '../git.js';
import { APPROVAL_GUIDE, findEngineMove, findInternalsChange, findViolations, gitInternals, headState } from '../guards.js';
import { createPr, findOpenPr, ghLoggedIn, prBody } from '../pr.js';
import { reusableEvidence } from '../reuse.js';
import { baseKey } from './prepare.js';
import { buildPrompt } from './prompt.js';
import { checkTask, taskLabel } from './tasks.js';
import { decideAfterEngine, decideAfterGate } from './decision-policy.js';
import type { Recorder, RunContext, RunSummary, Stop } from './types.js';

/** エンジンを 1 回動かす。止まる理由があれば、その状態と文を返す */
async function callEngine(ctx: RunContext, rec: Recorder, prompt: string): Promise<{ status: RunSummary['status']; reason: string } | undefined> {
  const { root, env, options } = ctx;
  rec.step++;
  const n = String(rec.step).padStart(2, '0');
  rec.save(`${n}-prompt.md`, prompt);
  const timeoutMs = Math.min(rec.deadline - ctx.now().getTime(), remainingProcessTime() ?? Infinity);
  if (timeoutMs <= 0) return { status: 'stopped', reason: '実行時間の上限に達しました' };
  const before = headState(root, env);
  const internals = gitInternals(root, env);
  const result = await runClaude({
    cwd: root,
    env,
    prompt,
    commands: Object.values(ctx.config.commands).filter((c): c is string => Boolean(c)),
    skipPermissions: Boolean(options.skipPermissions),
    timeoutMs: Math.min(timeoutMs, remainingProcessTime() ?? Infinity),
    signal: options.signal,
    maxOutputBytes: ctx.runConfig.maxOutputBytes,
  });
  rec.save(`${n}-output.json`, result.raw);
  // HEAD変更を見つけた場合は、Git内部を追加で読まない。
  const moved = findEngineMove(root, env, before, ctx.branch);
  const changed = moved ? undefined : findInternalsChange(root, env, internals);
  if (moved) ctx.stdout(moved.report);
  else if (changed) ctx.stdout(changed.report);
  const decision = decideAfterEngine({ ...result, movementReason: moved?.reason, internalsReason: changed?.reason });
  return decision.kind === 'stop' ? { status: decision.status, reason: decision.reason } : undefined;
}

// コミットする前に不正な直し方を探し、見つけたら変更を作業ツリーに残して止まる理由を返す（REQ-109〜REQ-112）
function guard(ctx: RunContext): string | undefined {
  const { findings, diff } = findViolations(ctx.root, ctx.env, ctx.config.openspecDir);
  if (!findings.length) return undefined;
  git(ctx.root, ctx.env, ['reset', '-q']);
  ctx.stdout(['不正な直し方を見つけました。', ...findings.map((f) => `  - ${f.file}：${f.reason}`), '', diff, APPROVAL_GUIDE].join('\n'));
  return `不正な直し方を見つけました（${findings.map((f) => f.file).join('、')}）`;
}

/** タスクを上から 1 つずつ渡し、終えるたびにコミットする（REQ-097・REQ-099） */
export async function runEngineTasks(ctx: RunContext, rec: Recorder): Promise<Stop | undefined> {
  const { root, env, changeId, engineTasks, gateTasks } = ctx;
  for (let i = 0; i < engineTasks.length; i++) {
    const task = engineTasks[i];
    const remaining = [...engineTasks.slice(i), ...gateTasks];
    if (ctx.options.signal?.aborted) return { status: 'interrupted', reason: '中断されました', remaining };
    const stop = await callEngine(ctx, rec, buildPrompt(root, ctx.changeDir, `- [ ] ${taskLabel(task)}`));
    if (stop) return { ...stop, remaining };
    const violation = guard(ctx);
    if (violation) return { status: 'stopped', reason: violation, remaining };
    checkTask(ctx.tasksPath, task.line);
    git(root, env, ['add', '-A']);
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): ${taskLabel(task)}`]);
    rec.done.push(taskLabel(task));
  }
  return undefined;
}

/**
 * 完了ゲートと直し（REQ-100・REQ-104）。ゲートのタスクは検査のあいだだけ完了にし、エンジンを呼ぶ前に戻す。
 * run 自身が変えた tasks.md を、不正な直し方として見つけないため
 */
export async function runGate(ctx: RunContext, rec: Recorder): Promise<Stop | undefined> {
  const { root, env, changeId, gateTasks, tasksRel } = ctx;
  const stopped = (reason: string): Stop => ({ status: 'stopped', reason, remaining: gateTasks });
  for (let fixes = 0; ; fixes++) {
    if (ctx.options.signal?.aborted) return { status: 'interrupted', reason: '中断されました', remaining: gateTasks };
    const left = Math.min(rec.deadline - ctx.now().getTime(), remainingProcessTime() ?? Infinity);
    if (left <= 0) return stopped('実行時間の上限に達しました');
    const originalTasks = createInputReader().read(ctx.tasksPath);
    for (const t of gateTasks) checkTask(ctx.tasksPath, t.line);
    const markedTasks = createInputReader().read(ctx.tasksPath);
    const restore = () => {
      if (!gateTasks.length) return;
      if (createInputReader().read(ctx.tasksPath) !== markedTasks) throw new UsageError('検証のあいだにtasks.mdが変わりました。一時的な完了印を自動で戻せません。変更を上書きしていません。差分を確認してください。');
      writeFileSync(ctx.tasksPath, originalTasks);
    };
    let beforeVerify;
    try {
      beforeVerify = headState(root, env);
      rec.lastVerify = runVerify({ root, changeId, gate: 'done', progress: ctx.progress, timeoutMs: left });
    } catch (error) {
      restore();
      throw error;
    }
    restore();
    rec.save(`${String(rec.step).padStart(2, '0')}-verify${fixes ? `-${fixes}` : ''}.json`, `${JSON.stringify(rec.lastVerify, null, 2)}\n`);
    // 中断後は共有予算が閉じる。Gitを追加で呼ぶ前に、観測済みの中断を処理する。
    const observed = {
      ok: rec.lastVerify.ok,
      interrupted: rec.lastVerify.results.some((r) => r.detail === INTERRUPTED),
      timedOut: rec.lastVerify.results.some((r) => r.detail === TIMED_OUT),
      fixes, maxFixes: ctx.runConfig.maxFixes,
    };
    const beforeGit = decideAfterGate({ ...observed, stateChanged: false });
    if (beforeGit.kind === 'interrupted') return { status: 'interrupted', reason: beforeGit.reason, remaining: gateTasks };
    const afterVerify = headState(root, env);
    const decision = decideAfterGate({ ...observed, stateChanged: beforeVerify.sha !== afterVerify.sha || beforeVerify.branch !== afterVerify.branch });
    if (decision.kind === 'stop') return stopped(decision.reason);
    if (decision.kind === 'interrupted') return { status: 'interrupted', reason: decision.reason, remaining: gateTasks };
    if (decision.kind === 'passed') break;
    const stop = await callEngine(ctx, rec, buildPrompt(root, ctx.changeDir, '完了ゲートに合格するように直す。', rec.lastVerify));
    if (stop) return { ...stop, remaining: gateTasks };
    const violation = guard(ctx);
    if (violation) return stopped(violation);
    git(root, env, ['add', '-A']);
    if (git(root, env, ['diff', '--cached', '--name-only']).trim()) {
      git(root, env, ['commit', '-q', '-m', `run(${changeId}): 完了ゲートの直し（${fixes + 1} 回目）`]);
    }
  }
  if (gateTasks.length) {
    for (const t of gateTasks) checkTask(ctx.tasksPath, t.line);
    git(root, env, ['add', '--', tasksRel]);
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): 完了ゲートに合格`]);
    rec.done.push(...gateTasks.map(taskLabel));
  }
  return undefined;
}

/** 証拠を記録してから PR を作る（REQ-114〜REQ-116）。gh が使えなければ、記録の前に止まる */
export function recordAndOpenPr(ctx: RunContext, rec: Recorder): number {
  const { root, env, changeId, branch } = ctx;
  if (!ghLoggedIn(root, env)) {
    return rec.finish('stopped', '完了ゲートに合格しましたが、gh CLI がないか、ログインしていないので PR を作れません。gh auth login でログインしてください', []);
  }
  const base = gitConfig(root, env, baseKey(ctx)) || ctx.startBranch;
  if (base === branch) {
    return rec.finish('stopped', `完了ゲートに合格しましたが、PR の向き先が分かりません。git config ${baseKey(ctx)} <向き先のブランチ> で設定してから、もう一度実行してください`, []);
  }
  const left = Math.min(rec.deadline - ctx.now().getTime(), remainingProcessTime() ?? Infinity);
  if (left <= 0) return rec.finish('stopped', '実行時間の上限に達しました', []);
  let evidence = reusableEvidence(root, env, changeId, ctx.changeDir);
  if (!evidence) {
    const recorded = runRecord({
      root, changeId, stdout: ctx.stdout, progress: ctx.progress, now: ctx.now, timeoutMs: left,
      onVerify: (result) => { rec.lastVerify = result; },
    });
    if (recorded !== 0) {
      const timedOut = rec.lastVerify?.results.some((r) => r.detail === TIMED_OUT);
      return rec.finish('stopped', timedOut ? '実行時間の上限に達しました' : '証拠の記録で完了ゲートに不合格になりました', []);
    }
    git(root, env, ['add', '--', `.loomake/evidence/${changeId}`]);
    git(root, env, ['commit', '-q', '-m', `evidence(${changeId}): 証拠を記録する`]);
    evidence = git(root, env, ['diff', '--name-only', '-z', 'HEAD~1', 'HEAD']).split('\0').filter(Boolean)[0];
  }
  rec.save('pr-body.md', prBody(root, ctx.changeDir, evidence));
  try {
    git(root, env, ['push', '-q', '-u', 'origin', branch]);
    const existing = findOpenPr(root, env, { base, head: branch });
    if (existing) return rec.finish('completed', `既存のPRを確認しました：${existing}`, []);
    const url = createPr(root, env, { base, head: branch, title: changeId, bodyFile: join(rec.runDir, 'pr-body.md') });
    return rec.finish('completed', `PR を作りました：${url}`, []);
  } catch (e) {
    return rec.finish('stopped', `証拠のコミットを保っていますが、PRの公開を完了できませんでした：${(e as Error).message}`, []);
  }
}
