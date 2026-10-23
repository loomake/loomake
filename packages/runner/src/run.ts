import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseTasks, type Task, type VerifyResult } from '@loomake/core';
import { runRecord } from '@loomake/trace';
import { TIMED_OUT, UsageError, assertChangeId, formatVerifyResult, loadConfig, runVerify } from '@loomake/kit';
import { DEFAULT_ALLOWED_DOMAINS, assertEngineAvailable, runClaude, type EngineResult } from './engine.js';
import { branchExists, dirtyFiles, git, gitConfig, isIgnored } from './git.js';
import { APPROVAL_GUIDE, findViolations } from './guards.js';
import { createPr, ghLoggedIn, prBody } from './pr.js';
import { maskSecrets } from './mask.js';

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

type RunConfig = { maxFixes: number; timeoutMinutes: number };

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
const taskLabel = (t: Task) => t.text;
// 完了ゲートを通すタスクはエンジンに渡さず、合格したときに run が完了にする（add-run-loop の仮定 A-06）
const isGateTask = (t: Task) => /verify/.test(t.text) && /--done/.test(t.text);

/** loomake.config.json の run の設定。既定は直し 5 回・60 分（add-run-loop の仮定 A-16） */
function loadRunConfig(root: string): RunConfig {
  const p = join(root, 'loomake.config.json');
  const raw = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as { run?: Record<string, unknown> }).run : undefined;
  const config: RunConfig = { maxFixes: 5, timeoutMinutes: 60 };
  if (raw === undefined) return config;
  for (const key of ['maxFixes', 'timeoutMinutes'] as const) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !(v > 0)) throw new UsageError(`loomake.config.json の run.${key} は正の数にしてください`);
    config[key] = v;
  }
  return config;
}

/** コンテナの中かどうか（add-run-loop の仮定 A-14） */
export function inContainer(env: NodeJS.ProcessEnv, fileExists: (p: string) => boolean): boolean {
  return fileExists('/.dockerenv') || fileExists('/run/.containerenv') || ['REMOTE_CONTAINERS', 'CODESPACES', 'DEVCONTAINER'].some((k) => env[k]);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** エンジンへの指示（REQ-098、add-run-loop の仮定 A-05） */
export function buildPrompt(root: string, changeDir: string, target: string, failure?: VerifyResult): string {
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const specs = walk(join(changeDir, 'specs'))
    .filter((f) => f.endsWith('spec.md'))
    .map((f) => `### ${toPosix(relative(changeDir, f))}\n\n${read(f)}`);
  return [
    '# loomake run の指示',
    '',
    'Loomake の規約で開発しています。次の「対象」だけを実装してください。',
    '',
    '## 決まり',
    '',
    '- tasks.md・trace.md・openspec/specs/ を書き換えない。タスクの完了は loomake run が付ける',
    '- 仕様にない判断が要るときは、`LOOMAKE-QUESTION:` で始まる行に質問を書き、何も変えずに終える',
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
}

/** tasks.md の指定した行のタスクを完了にする */
function checkTask(tasksPath: string, line: number) {
  const lines = readFileSync(tasksPath, 'utf8').split('\n');
  lines[line - 1] = lines[line - 1].replace(/- \[ \]/, '- [x]');
  writeFileSync(tasksPath, lines.join('\n'));
}

/** change の tasks.md を実装させ、完了ゲートが通るまで直させる。終了コード（終えた 0・止まった 1）を返す */
export async function runRun(options: RunOptions): Promise<number> {
  const { changeId, stdout, progress = () => {}, env = process.env, fileExists = existsSync, now = () => new Date() } = options;
  const root = resolve(options.root);
  const engine = options.engine ?? 'claude-code';
  const config = loadConfig(root);
  const runConfig = loadRunConfig(root);
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
  const tasks = parseTasks('tasks.md', readFileSync(tasksPath, 'utf8')).value;
  const pending = tasks.filter((t) => !t.checked);
  const engineTasks = pending.filter((t) => !isGateTask(t));
  const gateTasks = pending.filter(isGateTask);

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

  // 実行の記録。.gitignore で記録を git の追跡から外す（add-run-loop の仮定 A-24）
  const startedAt = now();
  const runsDir = join(root, RUNS_DIR);
  mkdirSync(runsDir, { recursive: true });
  if (!existsSync(join(runsDir, '.gitignore'))) writeFileSync(join(runsDir, '.gitignore'), '*\n');
  const runId = `${stamp(startedAt)}-${changeId}`;
  const runDir = join(runsDir, runId);
  mkdirSync(runDir, { recursive: true });
  let step = 0;
  const save = (name: string, text: string) => writeFileSync(join(runDir, name), maskSecrets(text));
  const deadline = startedAt.getTime() + runConfig.timeoutMinutes * 60_000;

  const done: string[] = [];
  let lastVerify: VerifyResult | null = null;
  const finish = (status: RunSummary['status'], reason: string, remaining: Task[]): number => {
    const summary: RunSummary = {
      change: changeId,
      status,
      reason,
      doneTasks: done,
      remainingTasks: remaining.map(taskLabel),
      lastVerify: lastVerify && { ok: lastVerify.ok, mode: lastVerify.mode },
    };
    save('summary.json', `${JSON.stringify(summary, null, 2)}\n`);
    const list = (xs: string[]) => (xs.length ? xs.map((x) => `\n  - ${x}`).join('') : 'なし');
    stdout(
      [
        status === 'completed' ? `loomake run を終えました：${reason}` : `loomake run を止めました：${reason}`,
        `終えたタスク：${list(summary.doneTasks)}`,
        `残ったタスク：${list(summary.remainingTasks)}`,
        `最後の検査結果：${lastVerify ? (lastVerify.ok ? '合格' : '不合格') : 'なし'}`,
        `記録：${RUNS_DIR}/${runId}/`,
      ].join('\n'),
    );
    return status === 'completed' ? 0 : 1;
  };

  // エンジンを 1 回動かす。止まる理由があれば、その文を返す
  const callEngine = async (prompt: string): Promise<{ stop?: { status: RunSummary['status']; reason: string }; result?: EngineResult }> => {
    step++;
    const n = String(step).padStart(2, '0');
    save(`${n}-prompt.md`, prompt);
    const timeoutMs = deadline - now().getTime();
    if (timeoutMs <= 0) return { stop: { status: 'stopped', reason: '実行時間の上限に達しました' } };
    const result = await runClaude({
      cwd: root,
      env,
      prompt,
      commands: Object.values(config.commands).filter((c): c is string => Boolean(c)),
      skipPermissions: Boolean(options.skipPermissions),
      timeoutMs,
      signal: options.signal,
    });
    save(`${n}-output.json`, result.raw);
    if (result.aborted) return { stop: { status: 'interrupted', reason: '中断されました' } };
    if (result.timedOut) return { stop: { status: 'stopped', reason: '実行時間の上限に達しました' } };
    const question = result.text.match(QUESTION);
    if (question) return { stop: { status: 'stopped', reason: `エンジンが質問しました：${question[1]}` } };
    // 失敗したエンジンの変更は完了にしない（fix-review-findings の仮定 A-02）
    if (result.exitCode !== 0) return { stop: { status: 'stopped', reason: `エンジンが終了コード ${result.exitCode ?? '（なし）'} で終わりました` } };
    return { result };
  };

  // コミットする前に不正な直し方を探し、見つけたら変更を作業ツリーに残して止まる理由を返す（REQ-109〜REQ-112）
  const guard = (): string | undefined => {
    const { findings, diff } = findViolations(root, env, config.openspecDir);
    if (!findings.length) return undefined;
    git(root, env, ['reset', '-q']);
    stdout(['不正な直し方を見つけました。', ...findings.map((f) => `  - ${f.file}：${f.reason}`), '', diff, APPROVAL_GUIDE].join('\n'));
    return `不正な直し方を見つけました（${findings.map((f) => f.file).join('、')}）`;
  };

  // PR の向き先は、run が change のブランチを作ったときのブランチ。git の設定に覚えて再開でも使う（add-run-pr の仮定 A-21、fix-review-findings の仮定 A-06）
  const baseKey = `branch.${branch}.loomake-base`;
  if (!hasBranch) {
    git(root, env, ['switch', '-q', '-c', branch]);
    git(root, env, ['config', baseKey, startBranch]);
  }

  // タスクを上から 1 つずつ渡し、終えるたびにコミットする（REQ-097・REQ-099）
  for (let i = 0; i < engineTasks.length; i++) {
    const task = engineTasks[i];
    const remaining = [...engineTasks.slice(i), ...gateTasks];
    if (options.signal?.aborted) return finish('interrupted', '中断されました', remaining);
    const { stop } = await callEngine(buildPrompt(root, changeDir, `- [ ] ${taskLabel(task)}`));
    if (stop) return finish(stop.status, stop.reason, remaining);
    const violation = guard();
    if (violation) return finish('stopped', violation, remaining);
    checkTask(tasksPath, task.line);
    git(root, env, ['add', '-A']);
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): ${taskLabel(task)}`]);
    done.push(taskLabel(task));
  }

  // 完了ゲートと直し（REQ-100・REQ-104）。ゲートのタスクは検査のあいだだけ完了にし、エンジンを呼ぶ前に戻す。
  // run 自身が変えた tasks.md を、不正な直し方として見つけないため（fix-review-findings-2 の仮定 A-01）
  const restoreGateTasks = () => {
    if (gateTasks.length) git(root, env, ['checkout', '-q', '--', tasksRel]);
  };
  for (let fixes = 0; ; fixes++) {
    if (options.signal?.aborted) return finish('interrupted', '中断されました', gateTasks);
    for (const t of gateTasks) checkTask(tasksPath, t.line);
    // 完了ゲートの品質コマンドにも、実行時間の残りを上限として渡す（REQ-105、fix-review-findings-2 の仮定 A-02）
    const left = deadline - now().getTime();
    if (left <= 0) {
      restoreGateTasks();
      return finish('stopped', '実行時間の上限に達しました', gateTasks);
    }
    lastVerify = runVerify({ root, changeId, gate: 'done', progress, timeoutMs: left });
    save(`${String(step).padStart(2, '0')}-verify${fixes ? `-${fixes}` : ''}.json`, `${JSON.stringify(lastVerify, null, 2)}\n`);
    if (lastVerify.ok) break;
    restoreGateTasks();
    if (lastVerify.results.some((r) => r.detail === TIMED_OUT)) return finish('stopped', '実行時間の上限に達しました', gateTasks);
    if (fixes >= runConfig.maxFixes) return finish('stopped', `直しの回数の上限（${runConfig.maxFixes} 回）に達しました`, gateTasks);
    const { stop } = await callEngine(buildPrompt(root, changeDir, '完了ゲートに合格するように直す。', lastVerify));
    if (stop) return finish(stop.status, stop.reason, gateTasks);
    const violation = guard();
    if (violation) return finish('stopped', violation, gateTasks);
    git(root, env, ['add', '-A']);
    if (git(root, env, ['diff', '--cached', '--name-only']).trim()) {
      git(root, env, ['commit', '-q', '-m', `run(${changeId}): 完了ゲートの直し（${fixes + 1} 回目）`]);
    }
  }
  if (gateTasks.length) {
    git(root, env, ['add', '--', tasksRel]);
    git(root, env, ['commit', '-q', '-m', `run(${changeId}): 完了ゲートに合格`]);
    done.push(...gateTasks.map(taskLabel));
  }

  // 証拠を記録してから PR を作る（REQ-114〜REQ-116）。gh が使えなければ、記録の前に止まる
  if (!ghLoggedIn(root, env)) {
    return finish('stopped', '完了ゲートに合格しましたが、gh CLI がないか、ログインしていないので PR を作れません。gh auth login でログインしてください', []);
  }
  const base = gitConfig(root, env, baseKey) || startBranch;
  if (base === branch) {
    return finish('stopped', `完了ゲートに合格しましたが、PR の向き先が分かりません。git config ${baseKey} <向き先のブランチ> で設定してから、もう一度実行してください`, []);
  }
  const recorded = runRecord({ root, changeId, stdout, progress, now });
  if (recorded !== 0) return finish('stopped', '証拠の記録で完了ゲートに不合格になりました', []);
  git(root, env, ['add', '--', `.loomake/evidence/${changeId}`]);
  git(root, env, ['commit', '-q', '-m', `evidence(${changeId}): 証拠を記録する`]);
  const evidence = git(root, env, ['diff', '--name-only', 'HEAD~1', 'HEAD']).trim().split('\n')[0];
  save('pr-body.md', prBody(root, changeDir, evidence));
  try {
    git(root, env, ['push', '-q', '-u', 'origin', branch]);
    const url = createPr(root, env, { base, head: branch, title: changeId, bodyFile: join(runDir, 'pr-body.md') });
    return finish('completed', `PR を作りました：${url}`, []);
  } catch (e) {
    return finish('stopped', `証拠を記録してコミットしましたが、PR を作れませんでした：${(e as Error).message}`, []);
  }
}
