import { existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseTasks, type Task, type VerifyResult } from '@loomake/core';
import { runRecord } from '@loomake/trace';
import { remainingProcessTime, withProcessBudget, TIMED_OUT, UsageError, assertChangeId, formatVerifyResult, loadConfig, runVerify, createInputReader, DOCUMENT_LIMITS } from '@loomake/kit';
import { DEFAULT_ALLOWED_DOMAINS, assertEngineAvailable, runClaude, type EngineResult } from './engine.js';
import { GitError, branchExists, dirtyFiles, git, gitConfig, isIgnored } from './git.js';
import { APPROVAL_GUIDE, findEngineMove, findViolations, headState } from './guards.js';
import { createPr, findOpenPr, ghLoggedIn, prBody } from './pr.js';
import { maskSecrets } from './mask.js';
import { reusableEvidence } from './reuse.js';
import { acquireRunLock, RunBusyError } from './lock.js';
import { parseRunConfig, type RunConfig } from './config.js';
import { checkLogHistory, createLogStore } from './logs.js';
import { DEFAULT_LOG_LIMITS, LogQuotaError } from './log-policy.js';

export type RunOptions = {
  /** プロジェクトのルート（loomake.config.json のあるディレクトリ） */
  root: string;
  changeId: string;
  /** 省くと claude-code（add-run-loop の仮定 A-08） */
  engine?: string;
  dryRun?: boolean;
  /** 権限確認なしで動かす。LOOMAKE_SANDBOX=1 のときだけ使える（REQ-121） */
  skipPermissions?: boolean;
  /** 確認を受け付けられるか（標準入力が TTY か） */
  interactive: boolean;
  /** 質問を出し、承諾されたら true を返す */
  confirm: (question: string) => Promise<boolean>;
  stdout: (text: string) => void;
  /** verify の進捗の表示先 */
  progress?: (text: string) => void;
  /** 環境変数。エンジンと git にもそのまま渡す。省くと process.env */
  env?: NodeJS.ProcessEnv;
  /** ファイルがあるか。コンテナの判定に使う。省くと existsSync */
  fileExists?: (path: string) => boolean;
  /** 中断の合図。CLI は SIGINT でこれを送る（REQ-124） */
  signal?: AbortSignal;
  now?: () => Date;
};

/** 止まったときと終えたときに書く記録（REQ-107） */
export type RunSummary = {
  change: string;
  status: 'completed' | 'stopped' | 'interrupted';
  reason: string;
  doneTasks: string[];
  remainingTasks: string[];
  lastVerify: { ok: boolean; mode: string } | null;
};

export const RUNS_DIR = '.loomake/runs';
const QUESTION = /^LOOMAKE-QUESTION:\s*(.*)$/m;

const toPosix = (p: string) => p.split(sep).join('/');
const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
/** 完了ゲートのタスクの印（REQ-100・REQ-136）。行のどこにあってもよい（clarify-run-phases-and-task-kinds の仮定 A-02） */
export const GATE_MARK = '<!-- loomake:gate=done -->';
const GATE_MARK_RE = /\s*<!--\s*loomake:gate=done\s*-->\s*/g;
// エンジンへの指示・コミットのメッセージ・記録には、印を除いた文を使う
const taskLabel = (t: Task) => t.text.replace(GATE_MARK_RE, ' ').trim();
const hasGateMark = (t: Task) => new RegExp(GATE_MARK_RE.source).test(t.text);
// 印のない旧書式：本文に verify と --done を含むタスク（add-run-loop の仮定 A-06、clarify-run-phases-and-task-kinds の仮定 A-01）
const isLegacyGateTask = (t: Task) => !hasGateMark(t) && /verify/.test(t.text) && /--done/.test(t.text);
// 完了ゲートを通すタスクはエンジンに渡さず、合格したときに run が完了にする
const isGateTask = (t: Task) => hasGateMark(t) || isLegacyGateTask(t);

/** loomake.config.json の run の設定。既定は直し 5 回・60 分（add-run-loop の仮定 A-16） */
function loadRunConfig(root: string): RunConfig {
  const p = join(root, 'loomake.config.json');
  const raw = existsSync(p) ? (JSON.parse(createInputReader().read(p)) as { run?: Record<string, unknown> }).run : undefined;
  return parseRunConfig(raw);
}

const logLimits = (config: RunConfig) => ({ ...DEFAULT_LOG_LIMITS, maxRunBytes: config.maxLogBytes, maxHistoryBytes: config.maxHistoryBytes });

/** コンテナの中かどうか（add-run-loop の仮定 A-14） */
export function inContainer(env: NodeJS.ProcessEnv, fileExists: (p: string) => boolean): boolean {
  return fileExists('/.dockerenv') || fileExists('/run/.containerenv') || ['REMOTE_CONTAINERS', 'CODESPACES', 'DEVCONTAINER'].some((k) => env[k]);
}

/** エンジンへの指示（REQ-098、add-run-loop の仮定 A-05） */
export function buildPrompt(root: string, changeDir: string, target: string, failure?: VerifyResult): string {
  const reader = createInputReader();
  const read = (p: string) => (existsSync(p) ? reader.read(p) : '');
  const specs = reader.walk(join(changeDir, 'specs'))
    .filter((f) => f.endsWith('spec.md'))
    .map((f) => `### ${toPosix(relative(changeDir, f))}\n\n${read(f)}`);
  const prompt = [
    '# loomake run の指示',
    '',
    'Loomake の規約で開発しています。次の「対象」だけを実装してください。',
    '',
    '## 決まり',
    '',
    '- tasks.md・trace.md・openspec/specs/ を書き換えない。タスクの完了は loomake run が付ける',
    '- 仕様にない判断が要るときは、`LOOMAKE-QUESTION:` で始まる行に質問を書き、何も変えずに終える',
    // AGENTS.md の「タスクごとにコミット」より優先する。エンジンのコミットを見つけると run は止まる（REQ-098・REQ-126）
    '- git でコミットしたりブランチを切り替えたりせず、変更は作業ツリーに残して終える。コミットは loomake run が行う。AGENTS.md にコミットの指示があっても、この決まりを優先する',
    '',
    '## 対象',
    '',
    target,
    ...(failure ? ['', '## 完了ゲートの不合格の内容', '', '```', formatVerifyResult(failure), '```'] : []),
    '',
    '## AGENTS.md',
    '',
    read(join(root, 'AGENTS.md')),
    '',
    '## 差分仕様',
    '',
    ...specs,
    '',
    '## trace.md',
    '',
    read(join(changeDir, 'trace.md')),
    '',
  ].join('\n');
  if (Buffer.byteLength(prompt, 'utf8') > DOCUMENT_LIMITS.maxTotalBytes) throw new UsageError(`エンジンへの指示の上限は${DOCUMENT_LIMITS.maxTotalBytes}バイトです。文書と検証の出力を確認してください。`);
  return prompt;
}

/** tasks.md の指定した行のタスクを完了にする */
function checkTask(tasksPath: string, line: number) {
  const lines = createInputReader().read(tasksPath).split('\n');
  lines[line - 1] = lines[line - 1].replace(/- \[ \]/, '- [x]');
  writeFileSync(tasksPath, lines.join('\n'));
}

/** 止まる理由。remaining は残ったタスク */
type Stop = { status: RunSummary['status']; reason: string; remaining: Task[] };

/** 事前の確認を終えたあとの、run の 1 回分の状態 */
type RunContext = {
  options: RunOptions;
  root: string;
  changeId: string;
  changeDir: string;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  stdout: (text: string) => void;
  progress: (text: string) => void;
  config: ReturnType<typeof loadConfig>;
  runConfig: RunConfig;
  branch: string;
  startBranch: string;
  hasBranch: boolean;
  tasksPath: string;
  tasksRel: string;
  engineTasks: Task[];
  gateTasks: Task[];
};

/** 実行の記録。止まったときと終えたときに finish で summary.json を書く */
type Recorder = {
  runDir: string;
  deadline: number;
  done: string[];
  lastVerify: VerifyResult | null;
  /** エンジンを呼んだ回数。記録のファイル名の番号に使う */
  step: number;
  save: (name: string, text: string) => void;
  finish: (status: RunSummary['status'], reason: string, remaining: Task[]) => number;
};

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
    // PR の向き先は、run が change のブランチを作ったときのブランチ。git の設定に覚えて再開でも使う（add-run-pr の仮定 A-21、fix-review-findings の仮定 A-06）
    if (!ctx.hasBranch) {
      git(ctx.root, ctx.env, ['switch', '-q', '-c', ctx.branch]);
      git(ctx.root, ctx.env, ['config', baseKey(ctx), ctx.startBranch]);
    }
    const stop = (await runEngineTasks(ctx, rec)) ?? (await runGate(ctx, rec));
    if (stop) return rec.finish(stop.status, stop.reason, stop.remaining);
    return recordAndOpenPr(ctx, rec);
  } catch (e) {
    // 始めたあとの git と証拠の記録の失敗は、実行中の失敗として記録に残して止まる（REQ-137、clarify-run-phases-and-task-kinds の仮定 A-03）
    if (!(e instanceof GitError) && !(e instanceof UsageError)) throw e;
    const { engineTasks, gateTasks } = ctx;
    const remaining = [...engineTasks, ...gateTasks].filter((t) => !rec.done.includes(taskLabel(t)));
    return rec.finish('stopped', e.message, remaining);
  }
}

const baseKey = (ctx: RunContext) => `branch.${ctx.branch}.loomake-base`;

/** 事前の確認（REQ-093〜REQ-096・REQ-122）。始めないときは終了コードを返す */
async function prepare(options: RunOptions): Promise<RunContext | number> {
  const { changeId, stdout, progress = () => {}, env = process.env, fileExists = existsSync, now = () => new Date() } = options;
  const root = resolve(options.root);
  const engine = options.engine ?? 'claude-code';
  const config = loadConfig(root);
  const runConfig = loadRunConfig(root);
  if (!options.dryRun) checkLogHistory(root, logLimits(runConfig));
  assertChangeId(changeId);
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (changeId === 'archive' || !existsSync(join(changeDir, 'tasks.md'))) {
    throw new UsageError(`change「${changeId}」がありません（${config.openspecDir}/changes/${changeId}/tasks.md）`);
  }
  if (options.skipPermissions && env.LOOMAKE_SANDBOX !== '1') {
    throw new UsageError(
      `--skip-permissions は、通信を許可したドメインに絞った環境で LOOMAKE_SANDBOX=1 を設定したときだけ使えます（既定の許可ドメイン：${DEFAULT_ALLOWED_DOMAINS.join('、')}）`,
    );
  }
  assertEngineAvailable(engine, env);

  // 実行前の確認（REQ-093・REQ-094）。未コミットの変更がなければ change のブランチに切り替えられる
  const dirty = dirtyFiles(root, env);
  if (dirty.length) {
    stdout(`作業ツリーに未コミットの変更があるので、実装を始めませんでした。コミットしてから、もう一度実行してください。\n${dirty.map((l) => `  ${l}`).join('\n')}`);
    return 1;
  }
  // テストのレポートがコミットに入ると、完了ゲートのあと作業ツリーが変わったままになる（fix-review-findings-2 の仮定 A-03）
  if (!isIgnored(root, env, config.tests.report)) {
    stdout(`テストのレポート（${config.tests.report}）が .gitignore で除外されていないので、実装を始めませんでした。.gitignore に足してコミットしてから、もう一度実行してください。`);
    return 1;
  }
  // change のブランチ（REQ-096、add-run-loop の仮定 A-04）。あれば先に切り替え、そのブランチの内容で検査してタスクを読む（fix-review-findings の仮定 A-03）
  const branch = `loomake/${changeId}`;
  const startBranch = git(root, env, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const hasBranch = branchExists(root, env, branch);
  const switched = hasBranch && startBranch !== branch;
  if (switched) git(root, env, ['switch', '-q', branch]);
  const switchBack = () => {
    if (switched) git(root, env, ['switch', '-q', startBranch]);
  };
  const specGate = runVerify({ root, changeId, gate: 'spec-only', progress });
  if (!specGate.ok) {
    switchBack();
    stdout(`仕様ゲートに不合格なので、実装を始めませんでした。\n\n${formatVerifyResult(specGate)}`);
    return 1;
  }

  const tasksPath = join(changeDir, 'tasks.md');
  const tasksRel = toPosix(relative(root, tasksPath));
  const tasks = parseTasks('tasks.md', createInputReader().read(tasksPath)).value;
  const pending = tasks.filter((t) => !t.checked);
  const engineTasks = pending.filter((t) => !isGateTask(t));
  const gateTasks = pending.filter(isGateTask);
  const legacy = gateTasks.filter(isLegacyGateTask);
  if (legacy.length) {
    stdout(
      `完了ゲートのタスクを、タスクの文から判定しました：${legacy.map(taskLabel).join('、')}\n` +
        `文を変えても判定が変わらないよう、tasks.md のその行の末尾に ${GATE_MARK} を付けてください。`,
    );
  }

  if (options.dryRun) {
    stdout(['エンジンに渡す予定のタスク：', ...engineTasks.map((t) => `  - [ ] ${taskLabel(t)}`)].join('\n'));
    if (engineTasks[0]) stdout(`\n最初のタスクの指示：\n\n${buildPrompt(root, changeDir, `- [ ] ${taskLabel(engineTasks[0])}`)}`);
    switchBack();
    return 0;
  }

  // コンテナの外では警告して確認する（REQ-122）
  if (!inContainer(env, fileExists)) {
    stdout('警告：コンテナの外で実行しようとしています。loomake run は、devcontainer か、それと同等のコンテナの中で実行してください。');
    if (!options.interactive) {
      switchBack();
      stdout('確認を受け付けられない環境なので、止めました。');
      return 1;
    }
    if (!(await options.confirm('続けますか [y/N] '))) {
      switchBack();
      return 1;
    }
  }
  return { options, root, changeId, changeDir, env, now, stdout, progress, config, runConfig, branch, startBranch, hasBranch, tasksPath, tasksRel, engineTasks, gateTasks };
}

/** 実行の記録を作る。.gitignore で記録を git の追跡から外す（add-run-loop の仮定 A-24） */
function startRecording(ctx: RunContext): Recorder {
  const { root, changeId, stdout } = ctx;
  const startedAt = ctx.now();
  const store = createLogStore(root, `${stamp(startedAt)}-${changeId}`, logLimits(ctx.runConfig));
  const { runDir, runId } = store;
  const rec: Recorder = {
    runDir,
    deadline: startedAt.getTime() + ctx.runConfig.timeoutMinutes * 60_000,
    done: [],
    lastVerify: null,
    step: 0,
    save: store.save,
    finish: (status, reason, remaining) => {
      const { lastVerify } = rec;
      const summary: RunSummary = {
        change: changeId,
        status,
        reason,
        doneTasks: rec.done,
        remainingTasks: remaining.map(taskLabel),
        lastVerify: lastVerify && { ok: lastVerify.ok, mode: lastVerify.mode },
      };
      let recordingError: string | undefined;
      let saved: 'summary.json' | 'stop.json' | undefined = 'summary.json';
      const short = (text: string) => maskSecrets(text).slice(0, 2048);
      try { store.finish('summary.json', `${JSON.stringify(summary, null, 2)}\n`); }
      catch (error) {
        recordingError = short((error as Error).message);
        saved = undefined;
        if (error instanceof LogQuotaError) {
          const stop = { schemaVersion: 1, kind: 'run-stop', change: changeId, operationStatus: status, reason: short(reason), recordingError, doneTaskCount: summary.doneTasks.length, remainingTaskCount: summary.remainingTasks.length, lastVerify: summary.lastVerify };
          try { store.finish('stop.json', JSON.stringify(stop, null, 2) + '\n'); saved = 'stop.json'; }
          catch (failed) { recordingError += `。${short((failed as Error).message)}`; }
        }
      }
      const list = (xs: string[]) => (xs.length ? xs.map((x) => `\n  - ${x}`).join('') : 'なし');
      stdout(
        [
          status === 'completed' && !recordingError ? `loomake run を終えました：${reason}` : `loomake run を止めました：${recordingError ? short(reason) : reason}`,
          `終えたタスク：${recordingError ? `${summary.doneTasks.length} 件（一覧は tasks.md を確認してください）` : list(summary.doneTasks)}`,
          `残ったタスク：${recordingError ? `${summary.remainingTasks.length} 件（一覧は tasks.md を確認してください）` : list(summary.remainingTasks)}`,
          `最後の検査結果：${lastVerify ? (lastVerify.ok ? '合格' : '不合格') : 'なし'}`,
          ...(recordingError ? [`記録を保存できません：${recordingError}`] : []),
          saved === 'summary.json' ? `記録：${RUNS_DIR}/${runId}/` : saved === 'stop.json' ? `停止情報：${RUNS_DIR}/${runId}/stop.json` : `保存先を確認してください：${RUNS_DIR}/${runId}/`,
        ].join('\n'),
      );
      return status === 'completed' && !recordingError ? 0 : 1;
    },
  };
  return rec;
}

/** エンジンの終わり方から、止まる理由を決める */
function engineStop(result: EngineResult): { status: RunSummary['status']; reason: string } | undefined {
  if (result.aborted) return { status: 'interrupted', reason: '中断されました' };
  if (result.outputLimitExceeded) return { status: 'stopped', reason: 'エンジンの出力が上限に達しました' };
  if (result.timedOut) return { status: 'stopped', reason: '実行時間の上限に達しました' };
  const question = result.text.match(QUESTION);
  if (question) return { status: 'stopped', reason: `エンジンが質問しました：${question[1]}` };
  // 失敗したエンジンの変更は完了にしない（fix-review-findings の仮定 A-02）
  if (result.exitCode !== 0) return { status: 'stopped', reason: `エンジンが終了コード ${result.exitCode ?? '（なし）'} で終わりました` };
  return undefined;
}

/** エンジンを 1 回動かす。止まる理由があれば、その状態と文を返す */
async function callEngine(ctx: RunContext, rec: Recorder, prompt: string): Promise<{ status: RunSummary['status']; reason: string } | undefined> {
  const { root, env, options } = ctx;
  rec.step++;
  const n = String(rec.step).padStart(2, '0');
  rec.save(`${n}-prompt.md`, prompt);
  const timeoutMs = Math.min(rec.deadline - ctx.now().getTime(), remainingProcessTime() ?? Infinity);
  if (timeoutMs <= 0) return { status: 'stopped', reason: '実行時間の上限に達しました' };
  const before = headState(root, env);
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
  const stop = engineStop(result);
  // エンジン自身のコミットとブランチの切り替えは不正な直し方の検出を通らないので、終わり方によらず止まる。
  // 理由は HEAD の変化を先に書き、中断なら記録の状態は interrupted のままにする（REQ-126）
  const moved = findEngineMove(root, env, before, ctx.branch);
  if (moved) {
    ctx.stdout(moved.report);
    return { status: stop?.status ?? 'stopped', reason: stop ? `${moved.reason}。${stop.reason}` : moved.reason };
  }
  return stop;
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
async function runEngineTasks(ctx: RunContext, rec: Recorder): Promise<Stop | undefined> {
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
 * run 自身が変えた tasks.md を、不正な直し方として見つけないため（fix-review-findings-2 の仮定 A-01）
 */
async function runGate(ctx: RunContext, rec: Recorder): Promise<Stop | undefined> {
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
    const afterVerify = headState(root, env);
    if (beforeVerify.sha !== afterVerify.sha || beforeVerify.branch !== afterVerify.branch) {
      return stopped('検証のあいだにHEADかブランチが変わりました。変更を取り消していません。Gitの状態を確認してから、もう一度実行してください。');
    }
    if (rec.lastVerify.ok) break;
    if (rec.lastVerify.results.some((r) => r.detail === TIMED_OUT)) return stopped('実行時間の上限に達しました');
    if (fixes >= ctx.runConfig.maxFixes) return stopped(`直しの回数の上限（${ctx.runConfig.maxFixes} 回）に達しました`);
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
function recordAndOpenPr(ctx: RunContext, rec: Recorder): number {
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
