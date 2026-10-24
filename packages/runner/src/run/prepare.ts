// run を始める前の確認と、run の設定の読み込み
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseTasks } from '@loomake/core';
import { UsageError, assertChangeId, formatVerifyResult, loadConfig, runVerify, createInputReader } from '@loomake/kit';
import { DEFAULT_ALLOWED_DOMAINS, assertEngineAvailable } from '../engine.js';
import { ghLoggedIn } from '../pr.js';
import { branchExists, dirtyFiles, git, isIgnored } from '../git.js';
import { parseRunConfig, type RunConfig } from '../config.js';
import { checkLogHistory } from '../logs.js';
import { DEFAULT_LOG_LIMITS } from '../log-policy.js';
import { GATE_MARK, isGateTask, isLegacyGateTask, taskLabel } from './tasks.js';
import { buildPrompt, toPosix } from './prompt.js';
import type { RunContext, RunOptions } from './types.js';

/** loomake.config.json の run の設定。既定は直し 5 回・60 分 */
export function loadRunConfig(root: string): RunConfig {
  // JSON として読めない設定は、verify と同じ日本語の設定エラーにする（REQ-193）
  loadConfig(root);
  const p = join(root, 'loomake.config.json');
  const raw = existsSync(p) ? (JSON.parse(createInputReader().read(p)) as { run?: Record<string, unknown> }).run : undefined;
  return parseRunConfig(raw);
}

export const logLimits = (config: RunConfig) => ({ ...DEFAULT_LOG_LIMITS, maxRunBytes: config.maxLogBytes, maxHistoryBytes: config.maxHistoryBytes });

/** コンテナの中かどうか */
export function inContainer(env: NodeJS.ProcessEnv, fileExists: (p: string) => boolean): boolean {
  return fileExists('/.dockerenv') || fileExists('/run/.containerenv') || ['REMOTE_CONTAINERS', 'CODESPACES', 'DEVCONTAINER'].some((k) => env[k]);
}

export const baseKey = (ctx: RunContext) => `branch.${ctx.branch}.loomake-base`;

/** 事前の確認（REQ-093〜REQ-096・REQ-122）。始めないときは終了コードを返す */
export async function prepare(options: RunOptions): Promise<RunContext | number> {
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
  // テストのレポートがコミットに入ると、完了ゲートのあと作業ツリーが変わったままになる
  if (!isIgnored(root, env, config.tests.report)) {
    stdout(`テストのレポート（${config.tests.report}）が .gitignore で除外されていないので、実装を始めませんでした。.gitignore に足してコミットしてから、もう一度実行してください。`);
    return 1;
  }
  // change のブランチ（REQ-096）。あれば先に切り替え、そのブランチの内容で検査してタスクを読む
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

  // PRを作れない環境では、エンジンや実装ブランチを作る前に止まる（REQ-116）。
  if (!ghLoggedIn(root, env)) {
    switchBack();
    stdout('gh CLI がないか、ログインしていないので、実装を始めませんでした。PR を作るために、gh auth login でログインしてください。');
    return 1;
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
  return {
    options, root, changeId, changeDir, env, now, stdout, progress, config, runConfig,
    branch, startBranch, hasBranch, tasksPath, tasksRel, engineTasks, gateTasks,
  };
}
