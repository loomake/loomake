import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { profileEvent } from '../../../scripts/test-phase-profile.mjs';
import { holderWaitTime, withProcessBudget } from '../../kit/src/runtime/process.js';
import { makeRepo, noChange, CHANGE, fakeCli } from './helpers.js';
import { CLOCK_SLACK_MS, OPERATION_MS, STALL_MS, STOP_GRACE_MS, diagnosticContext, diagnosticEvent, expectStalled, expectStoppedSoon, run, summary } from './external-budget-helpers.js';

// 診断envがあるときだけ許可欄を記録する。元の関数を同じ引数で一度だけ呼ぶ。
vi.mock('node:child_process', async (original) => {
  const cp = await original<typeof import('node:child_process')>();
  const { observeSpawnSync } = await import('./process-diagnostics.js');
  return { ...cp, spawnSync: observeSpawnSync(cp) };
});
vi.mock('../../kit/src/runtime/process.js', async (original) => {
  const real = await original<typeof import('../../kit/src/runtime/process.js')>();
  const { observeRunExternal } = await import('./process-diagnostics.js');
  return { ...real, runExternal: observeRunExternal(real) };
});

// external-budget.test.ts から、実時間の期限まで待つ試験を分けた（共有期限・エンジンの予算・フックの待ち）。
// 待ちが長い試験を別ファイルにして、CI のシャードで他のファイルの試験と並べて動かせるようにする
// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

describe('runから外部操作までの期限', () => {
  it('[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する', async () => {
    // 準備の gh auth status を PREP_DELAY_MS だけ遅らせ、エンジンに予算を最初から与え直すと上限を超えるようにする。
    // 予算は、Windows の遅い準備（約 1.4 秒）と遅らせた分を足してもエンジンを呼べる長さにする。
    // 猶予は元の試験（予算 1200ms・上限 2500ms）と同じ 1300ms にし、遅らせる時間をそれより長くする。
    // Windows では、期限で git を止めるのに taskkill を使うので、止まるまでに 2 秒近くかかることがある（PR #43 の run 40612195551 で 1983ms）。
    // そこで Windows では猶予を 3000ms にし、遅らせる時間をそれより長い 4000ms にして、準備の分を引き忘れたら上限を超えることを保つ
    const BUDGET_MS = 8000;
    const PREP_DELAY_MS = process.platform === 'win32' ? 4000 : 2000;
    const ENGINE_GRACE_MS = process.platform === 'win32' ? 3000 : 1300;
    const repo = makeRepo();
    try {
      repo.plan([{ sleepMs: 30_000, write: { 'late.txt': '遅い変更' } }]);
      const cli = fakeCli(repo, 'gh', { when: "args[0]==='auth'", delayMs: PREP_DELAY_MS });
      const start = Date.now();
      const waitedBefore = holderWaitTime();
      const result = await withProcessBudget({ timeoutMs: BUDGET_MS }, () => run(repo));
      // Windows の保持役の準備を待った時間は予算に含めない（REQ-257）ので、経過時間からも除く
      const elapsed = Date.now() - start - (holderWaitTime() - waitedBefore);
      const context = diagnosticContext(repo, { elapsed, stdout: result.stdout }, cli);
      // 準備を遅らせ、転送が成功し、エンジンまで届いた
      const events = cli.events();
      const delayed = events.findIndex((e) => e.event === 'delay-start' && e.args[0] === 'auth');
      expect(delayed, context).toBeGreaterThanOrEqual(0);
      expect(events.slice(delayed).find((e) => e.event === 'forward-end'), context).toMatchObject({ status: 0 });
      expect(events.filter((e) => e.event === 'forward-end' && e.error), context).toEqual([]);
      expect(repo.calls(), context).toHaveLength(1);
      expect(result.code, context).toBe(1);
      expect(result.stdout, context).toContain('実行時間の上限');
      // 予算まで待ち、予算に猶予を足した時間のうちに止まった。準備の分を予算から引いていなければ、PREP_DELAY_MS の分だけ上限を超える
      expect(elapsed, context).toBeGreaterThanOrEqual(BUDGET_MS - CLOCK_SLACK_MS);
      expect(elapsed, context).toBeLessThan(BUDGET_MS + ENGINE_GRACE_MS);
      expect(existsSync(join(repo.root, 'late.txt'))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally { repo.cleanup(); }
  });
  // authは事前確認を通した後、実装の完了後に行う公開前の確認だけを止める。
  it.each(['push', 'auth', 'list', 'create'] as const)('[REQ-182][REQ-297] %sの期限後に先へ進まず、再実行で重複させない', async (stage) => {
    const caseId = stage === 'push' || stage === 'create' ? `deadline-${stage}` : undefined;
    const profile = (event: string, details: object = {}) => profileEvent(caseId, event, details);
    profile('test-start');
    let outcome = 'failed';
    try {
      const started = Date.now();
      const repo = makeRepo();
      diagnosticEvent(repo, 'fixture-ready', { elapsedMs: Date.now() - started, stage });
      try {
        repo.plan([{ write: { 'impl.txt': '実装' } }, noChange]);
        const command = stage === 'push' ? 'git' : 'gh';
        const condition = stage === 'push' ? "args[0]==='push'" : stage === 'auth' ? "args[0]==='auth' && fs.existsSync('impl.txt')" : `args[0]==='pr' && args[1]===${JSON.stringify(stage)}`;
        // push と PR の作成は 1 操作の期限では止めず、run の残り時間で止める（relax-commit-push-budget）。
        // そこで、この 2 つは run 全体の予算より長く止め、全体の期限で止まることを確かめる
        const untilDeadline = stage === 'push' || stage === 'create';
        // 共有の期限は、負荷の高い CI でも証拠の記録（verify を含む）が終わって push・create の停止に届き、そこから 1 操作の期限より長く待てる長さにする。
        // 短いと、証拠の記録の中で期限に当たって同じ「実行時間の上限」で止まり、確かめたい停止に届かない。
        // 止まった印から 1 操作の期限（5 秒）より長く待てるよう、macOS の CI で push に届いた時刻（約 7.4 秒）に余裕を足して 20 秒にする。
        // Windows は外部操作の起動が遅く、偽の git を通すと node の起動も増えるので、さらに長くする（windows-fake-clis）
        const SHARED_DEADLINE_MS = process.platform === 'win32' ? 40_000 : 20_000;
        const UNTIL_DEADLINE_OPERATION_MS = 5_000;
        // auth・list は 1 操作の期限で止める。止まる手前の通常の git・gh が負荷で 500ms を超えると、狙った段階の前で止まる
        // （macOS の CI で、印の検査が見つけた）。そこで 1 操作の期限を 2 秒にし、止まった印から期限 + 猶予のうちに止まることを確かめる
        const STAGE_OPERATION_MS = 2_000;
        // 1 操作の期限には監視役と偽の CLI の起動時間も入るので、止まった印からの時間は期限より短くなりうる（main の PR #23 から引き継ぐ）
        const OPERATION_SLACK_MS = 1_000;
        const cli = fakeCli(repo, command, { when: condition, forwardFirst: stage === 'create', stallMs: untilDeadline ? SHARED_DEADLINE_MS + 30_000 : STALL_MS });
        diagnosticEvent(repo, 'run-start', { stage });
        // untilDeadline の 2 つは、止まる手前の通常の git・gh が負荷で遅れても 1 操作の期限に当たらないよう余裕を持たせ、
        // 止まったのが共有の期限であることは所要時間の下限で確かめる。
        const runStarted = Date.now();
        const waitedBefore = holderWaitTime();
        const clockStart = caseId && process.env.LOOMAKE_TEST_BUDGET_CLOCK === '1'
          ? { wall: performance.now(), holder: holderWaitTime() } : undefined;
        profile('run-start', { at: runStarted });
        // auth・list は 1 操作の期限で止まることを確かめる。run の予算は狙った段階に届くための長さで、Windows では外部操作ごとに保持役へ保持を頼む分だけ
        // 遅くなり、20 秒では list に届く前に尽きることがあった（run 40634806172 の再実行）。そこで Windows では 35 秒にする
        const stageBudgetMs = process.platform === 'win32' ? 35_000 : 20_000;
        const result = await withProcessBudget(untilDeadline ? { timeoutMs: SHARED_DEADLINE_MS, maxOperationMs: UNTIL_DEADLINE_OPERATION_MS } : { timeoutMs: stageBudgetMs, maxOperationMs: STAGE_OPERATION_MS }, () => run(repo));
        const endedAt = Date.now();
        const budgetClock = clockStart ? {
          at: endedAt, wallElapsedMs: performance.now() - clockStart.wall,
          holderWaitMs: holderWaitTime() - clockStart.holder,
          budgetMs: SHARED_DEADLINE_MS, graceMs: STOP_GRACE_MS,
        } : undefined;
        profile('run-end', { at: endedAt });
        if (budgetClock) profile('budget-clock', budgetClock);
        // 保持役の準備待ちは共有予算に含めないため、判定の経過時間からも除く（REQ-257）。
        const runElapsed = endedAt - runStarted - (holderWaitTime() - waitedBefore);
        diagnosticEvent(repo, 'run-end', { stage, code: result.code, elapsedMs: Date.now() - started });
        const context = diagnosticContext(repo, { stage, code: result.code, elapsedMs: Date.now() - started, stdout: result.stdout }, cli);
        // 期限の検査の前に、狙った段階（push・2 回目の auth・PR の検索・作成）で止まったことを確かめる
        const operation = { push: ['push'], auth: ['auth', 'status'], list: ['pr', 'list'], create: ['pr', 'create'] }[stage];
        const stall = expectStalled(cli, (args) => operation.every((value, i) => args[i] === value), context);
        profile('stall-start', { at: stall.at });
        expect(result.code, context).toBe(1);
        if (untilDeadline) {
          // 1 操作の期限より長く待ち、共有の期限まで待って、共有の期限に猶予を足した時間のうちに止まった
          expect(endedAt - stall.at, context).toBeGreaterThan(UNTIL_DEADLINE_OPERATION_MS);
          expect(runElapsed, context).toBeGreaterThanOrEqual(SHARED_DEADLINE_MS - 500);
          expect(runElapsed, context).toBeLessThan(SHARED_DEADLINE_MS + STOP_GRACE_MS);
        } else {
          // 共有の期限ではなく 1 操作の期限まで待ってから止まった
          expect(endedAt - stall.at, context).toBeGreaterThanOrEqual(STAGE_OPERATION_MS - OPERATION_SLACK_MS);
          expectStoppedSoon(stall, endedAt, STAGE_OPERATION_MS, context);
        }
        expect(result.stdout, context).toContain('実行時間の上限');
        expect(summary(repo).status, context).toBe('stopped');
        expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('実装');
        expect(repo.prs(), context).toHaveLength(stage === 'create' ? 1 : 0);
        const evidenceDir = join(repo.root, '.loomake/evidence', CHANGE);
        if (stage !== 'auth') expect(readdirSync(evidenceDir)).toHaveLength(1);
        if (stage === 'push') expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
        // 元のコマンドへ戻し、通常の再試行で同じ証拠・PRを再利用する。
        cli.restore();
        profile('retry-start');
        const retry = await run(repo);
        profile('retry-end');
        expect(retry.code, retry.stdout).toBe(0);
        expect(repo.prs()).toHaveLength(1);
        expect(readdirSync(evidenceDir)).toHaveLength(1);
        expect(repo.calls()).toHaveLength(2);
      } finally {
        profile('cleanup-start');
        repo.cleanup();
        profile('cleanup-end');
      }
      outcome = 'passed';
    } finally {
      profile('test-outcome', { outcome });
      profile('test-end');
    }
  }, process.platform === 'win32' ? 120_000 : 60_000);
});

describe('フックを動かす git の操作の期限', () => {
  it('[REQ-182] 1 操作の期限より遅い pre-commit・pre-push のフックがあっても、run の残り時間の中でコミット・push・PR の作成まで進む', async () => {
    // Windows では外部操作ごとに保持役へ保持を頼むので、通常の git も 500ms を超えることがある（run 40630863426）。
    // そこで Windows では 1 操作の期限を 2 秒、フックを 3 秒、run の予算を 40 秒にし、フックが 1 操作の期限より遅いことは保つ
    const win = process.platform === 'win32';
    const operationMs = win ? 2_000 : OPERATION_MS;
    const hookSeconds = win ? 3 : 1;
    const repo = makeRepo();
    try {
      for (const name of ['pre-commit', 'pre-push']) {
        const hook = join(repo.root, '.git', 'hooks', name);
        writeFileSync(hook, `#!/bin/sh\nsleep ${hookSeconds}\n`);
        chmodSync(hook, 0o755);
      }
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const r = await withProcessBudget({ timeoutMs: win ? 40_000 : 20_000, maxOperationMs: operationMs }, () => run(repo));
      expect(r.code, r.stdout).toBe(0);
      expect(summary(repo)).toMatchObject({ status: 'completed', remainingTasks: [] });
      expect(repo.prs()).toHaveLength(1);
    } finally { repo.cleanup(); }
  }, 60_000);
});
