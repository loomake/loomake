// run の段階：タスクの実装、完了ゲートと直し、証拠の記録と PR
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRecord } from '@loomake/trace';
import { remainingProcessTime, ProcessLimitError, INTERRUPTED, TIMED_OUT, UsageError, runVerify, createInputReader, isAbortedResult, isVerifyResultV2, verifyExitCode } from '@loomake/kit';
import type { LegacyVerifyResult, VerifyResult } from '@loomake/core';
import { runClaude } from '../engine.js';
import { git, gitConfig } from '../git.js';
import { APPROVAL_GUIDE, engineBaseline, findEngineMove, findInternalsChange, findViolations, headState } from '../guards.js';
import { createPr, findOpenPr, ghLoggedIn, prBody } from '../pr.js';
import { maskSecrets } from '../mask.js';
import { reusableEvidence } from '../reuse.js';
import { baseKey } from './prepare.js';
import { buildPrompt } from './prompt.js';
import { checkTask, taskLabel } from './tasks.js';
import { decideAfterEngine, decideAfterGate, decideAfterChanges, type GateObservation } from './decision-policy.js';
import type { Recorder, RunContext, RunSummary, Stop } from './types.js';

/** 完了ゲートの検査のうち、理由（1.0.0 の detail、2.0.0 の reason）が reason と一致するものがあるか。aborted は検査を持たない */
function hasReason(result: LegacyVerifyResult | VerifyResult | null, reason: string): boolean {
  if (!result) return false;
  if (!isVerifyResultV2(result)) return result.results.some((r) => r.detail === reason);
  return !isAbortedResult(result) && result.checks.some((c) => c.reason === reason);
}

/**
 * 完了ゲートの結果から、純粋判断に渡す観測を作る（REQ-205）。1.0.0 は ok をそのまま使う。
 * 2.0.0 は scope:local で終了コード 0 の結果だけを完了とし、要判断と aborted と scope を観測に入れる。ci の PASS は完了とみなさず、純粋判断が止める（REQ-317）
 */
export function gateObservation(result: LegacyVerifyResult | VerifyResult): Pick<GateObservation, 'ok' | 'interrupted' | 'timedOut' | 'aborted' | 'decisionReasons' | 'scope'> {
  const interrupted = hasReason(result, INTERRUPTED);
  const timedOut = hasReason(result, TIMED_OUT);
  if (!isVerifyResultV2(result)) return { ok: result.ok, interrupted, timedOut };
  if (isAbortedResult(result)) return { ok: false, interrupted, timedOut, aborted: result.run.errors.map((e) => `${e.kind}：${e.message}`).join(' / ') };
  const reasons = result.decision.reasons.map((r) => `${r.message}（${r.code}・${r.target}）`);
  return {
    ok: result.scope === 'local' && verifyExitCode(result) === 0, interrupted, timedOut, scope: result.scope,
    decisionReasons: !result.decision.required ? [] : reasons.length ? reasons : ['理由の記載なし'],
  };
}

/** 利用者の信号による中断だけを、監視役の異常終了と区別する（REQ-250・REQ-337）。 */
export function interruptedOperation(error: unknown): boolean {
  return error instanceof ProcessLimitError && error.kind === 'interrupted' && error.reason === undefined;
}

/** エンジンを 1 回動かす。止まる理由があれば、その状態と文を返す */
async function callEngine(ctx: RunContext, rec: Recorder, prompt: string): Promise<{ kind: 'continue'; text: string } | { kind: 'stop'; status: RunSummary['status']; reason: string }> {
  const { root, env, options } = ctx;
  rec.step++;
  const n = String(rec.step).padStart(2, '0');
  rec.save(`${n}-prompt.md`, prompt);
  const timeoutMs = Math.min(rec.deadline - ctx.now().getTime(), remainingProcessTime() ?? Infinity);
  if (timeoutMs <= 0) return { kind: 'stop', status: 'stopped', reason: '実行時間の上限に達しました' };
  // 呼ぶ前の HEAD と git の設定・フックを、この境目で読み直す（REQ-348）
  const { head: before, internals } = engineBaseline(root, env);
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
  return decision.kind === 'stop' ? decision : { kind: 'continue', text: result.text };
}

// コミットする前に不正な直し方を探し、見つけたら変更を作業ツリーに残して止まる理由を返す（REQ-109〜REQ-112）
function guard(ctx: RunContext): string | undefined {
  const { findings, diff } = findViolations(ctx.root, ctx.env, ctx.config.openspecDir);
  if (!findings.length) return undefined;
  git(ctx.root, ctx.env, ['reset', '-q']);
  ctx.stdout(['不正な直し方を見つけました。', ...findings.map((f) => `  - ${f.file}：${f.reason}`), '', diff, APPROVAL_GUIDE].join('\n'));
  return `不正な直し方を見つけました（${findings.map((f) => f.file).join('、')}）`;
}

/** ガードと同じ index の差分を、run が tasks.md を完了にする前に調べる。 */
function hasStagedChanges(ctx: RunContext): boolean {
  return Boolean(git(ctx.root, ctx.env, ['diff', '--cached', '--name-only']).trim());
}

/** タスクを上から 1 つずつ渡し、終えるたびにコミットする（REQ-097・REQ-099） */
export async function runEngineTasks(ctx: RunContext, rec: Recorder): Promise<Stop | undefined> {
  const { root, env, changeId, engineTasks, gateTasks } = ctx;
  for (let i = 0; i < engineTasks.length; i++) {
    const task = engineTasks[i];
    const remaining = [...engineTasks.slice(i), ...gateTasks];
    if (ctx.options.signal?.aborted) return { status: 'interrupted', reason: '中断されました', remaining };
    const result = await callEngine(ctx, rec, buildPrompt(root, ctx.changeDir, `- [ ] ${taskLabel(task)}`));
    if (result.kind === 'stop') return { status: result.status, reason: result.reason, remaining };
    const violation = guard(ctx);
    if (violation) return { status: 'stopped', reason: violation, remaining };
    const decision = decideAfterChanges({ phase: 'task', hasChanges: hasStagedChanges(ctx), text: result.text });
    if (decision.kind === 'stop') {
      const output = join(rec.runDir, `${String(rec.step).padStart(2, '0')}-output.json`);
      return { status: 'stopped', reason: `エンジンが変更を残さずに終わりました。出力の記録：${output}。権限や環境を見直して実行し直すか、変更が要らないなら人が tasks.md のこのタスクを完了にしてコミットしてから実行し直してください。`, remaining };
    }
    const reason = decision.kind === 'no-change'
      ? maskSecrets(decision.reason).replace(/\p{Cc}/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
      : undefined;
    if (reason !== undefined) ctx.stdout(`変更不要としてタスクを完了にします：${reason}`);
    checkTask(ctx.tasksPath, task.line);
    git(root, env, ['add', '-A']);
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): ${taskLabel(task)}`, ...(reason === undefined ? [] : ['--cleanup=verbatim', '-m', `変更不要：${reason}`])]);
    rec.done.push(taskLabel(task));
  }
  return undefined;
}

/**
 * 完了ゲートと直し（REQ-100・REQ-104）。ゲートのタスクは検査のあいだだけ完了にし、エンジンを呼ぶ前に戻す。
 * run 自身が変えた tasks.md を、不正な直し方として見つけないため
 */
/**
 * 品質コマンドや git は同期的に動くので、そのあいだに届いた信号の処理は、イベントループに戻るまで実行されない（REQ-208）。
 * 同期の処理のあとでイベントループにいったん戻り、届いていた中断を確かめる
 */
async function interrupted(ctx: RunContext): Promise<boolean> {
  await new Promise((resolve) => setImmediate(resolve));
  return ctx.options.signal?.aborted === true;
}

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
      // run の完了ゲートは verify --done --scope local と同じ検査（REQ-100）
      rec.lastVerify = runVerify({ root, changeId, gate: 'done', scope: 'local', progress: ctx.progress, timeoutMs: left });
    } catch (error) {
      restore();
      throw error;
    }
    restore();
    rec.save(`${String(rec.step).padStart(2, '0')}-verify${fixes ? `-${fixes}` : ''}.json`, `${JSON.stringify(rec.lastVerify, null, 2)}\n`);
    if (await interrupted(ctx)) return { status: 'interrupted', reason: '中断されました', remaining: gateTasks };
    // 中断後は共有予算が閉じる。Gitを追加で呼ぶ前に、観測済みの中断を処理する。
    const observed = { ...gateObservation(rec.lastVerify), fixes, maxFixes: ctx.runConfig.maxFixes };
    const beforeGit = decideAfterGate({ ...observed, stateChanged: false });
    if (beforeGit.kind === 'interrupted') return { status: 'interrupted', reason: beforeGit.reason, remaining: gateTasks };
    const afterVerify = headState(root, env);
    const decision = decideAfterGate({ ...observed, stateChanged: beforeVerify.sha !== afterVerify.sha || beforeVerify.branch !== afterVerify.branch });
    if (decision.kind === 'stop') return stopped(decision.reason);
    if (decision.kind === 'interrupted') return { status: 'interrupted', reason: decision.reason, remaining: gateTasks };
    if (decision.kind === 'passed') break;
    const result = await callEngine(ctx, rec, buildPrompt(root, ctx.changeDir, '完了ゲートに合格するように直す。', rec.lastVerify));
    if (result.kind === 'stop') return { status: result.status, reason: result.reason, remaining: gateTasks };
    const violation = guard(ctx);
    if (violation) return stopped(violation);
    const changes = decideAfterChanges({ phase: 'repair', hasChanges: hasStagedChanges(ctx), text: result.text });
    if (changes.kind === 'stop') {
      const output = join(rec.runDir, `${String(rec.step).padStart(2, '0')}-output.json`);
      return stopped(`直しでエンジンが変更を残さずに終わりました。出力の記録：${output}。権限や環境を見直してから実行し直してください。`);
    }
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): 完了ゲートの直し（${fixes + 1} 回目）`]);
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
export async function recordAndOpenPr(ctx: RunContext, rec: Recorder): Promise<number> {
  const { root, env, changeId, branch } = ctx;
  // 中断が届いていたら、証拠の記録・push・PR の作成に進まない。証拠はコミットしてから止まるので、再実行で使える（REQ-208）
  const stopIfInterrupted = async () => ((await interrupted(ctx)) ? rec.finish('interrupted', '中断されました', []) : undefined);
  const first = await stopIfInterrupted();
  if (first !== undefined) return first;
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
    // 記録するのはローカルの完了（scope:local）。最終 CI の合格ではない（REQ-100・REQ-315）
    const recorded = runRecord({
      root, changeId, scope: 'local', stdout: ctx.stdout, progress: ctx.progress, now: ctx.now, timeoutMs: left,
      onVerify: (result) => { rec.lastVerify = result; },
    });
    if (recorded !== 0) {
      const timedOut = hasReason(rec.lastVerify, TIMED_OUT);
      return rec.finish('stopped', timedOut ? '実行時間の上限に達しました' : '証拠の記録で完了ゲートに不合格になりました', []);
    }
    git(root, env, ['add', '--', `.loomake/evidence/${changeId}`]);
    git(root, env, ['commit', '-q', '-m', `evidence(${changeId}): 証拠を記録する`]);
    evidence = git(root, env, ['diff', '--name-only', '-z', 'HEAD~1', 'HEAD']).split('\0').filter(Boolean)[0];
  }
  rec.save('pr-body.md', prBody(root, ctx.changeDir, evidence));
  const beforePush = await stopIfInterrupted();
  if (beforePush !== undefined) return beforePush;
  try {
    git(root, env, ['push', '-q', '-u', 'origin', branch]);
    const beforePr = await stopIfInterrupted();
    if (beforePr !== undefined) return beforePr;
    const existing = findOpenPr(root, env, { base, head: branch });
    if (existing) return rec.finish('completed', `既存のPRを確認しました：${existing}`, []);
    // 既存の PR の検索も同期的に動くので、そのあいだに届いた中断を、PR を作る前に確かめる
    const beforeCreate = await stopIfInterrupted();
    if (beforeCreate !== undefined) return beforeCreate;
    const url = createPr(root, env, { base, head: branch, title: changeId, bodyFile: join(rec.runDir, 'pr-body.md') });
    return rec.finish('completed', `PR を作りました：${url}`, []);
  } catch (e) {
    return rec.finish(interruptedOperation(e) ? 'interrupted' : 'stopped', `証拠のコミットを保っていますが、PRの公開を完了できませんでした：${(e as Error).message}`, []);
  }
}
