import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noChange } from './helpers.js';
import { killOwnedProcess, processState } from './process-state.js';
import { run, tasksMd, withRepo } from './run-helpers.js';

// run.test.ts から、run の実行時間の上限（timeoutMinutes）まで実時間で待つ REQ-105 の試験を分けた。
// 待ちが長い試験を別ファイルにして、CI のシャードで他のファイルの試験と並べて動かせるようにする
// git・node・verify のコマンドを何度も起動するので、Windows では 1 件に 10 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

// 回収前のゾンビと終了途中の子は、利用者のコードを実行できないので「止まった」とみなす（process-state.ts）
function assertStoppedProcess(pidFile: string) {
  expect(existsSync(pidFile)).toBe(true);
  const pid = Number(readFileSync(pidFile, 'utf8'));
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  expect(processState(pid)).not.toBe('running');
}

function cleanupTestProcess(pidFile: string) {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0) return;
  killOwnedProcess(pid);
}

describe('完了ゲートと直し', () => {
  it('[REQ-105] 実行時間が上限に達したら、エンジンを止めて止まる', () =>
    withRepo(
      async (repo) => {
        const pidFile = join(repo.base, 'engine.pid');
        repo.plan([{ sleepMs: 60_000, pidFile }]);
        const start = Date.now();
        try {
          const r = await run(repo);
          expect(r.code).toBe(1);
          expect(r.stdout).toContain('実行時間の上限に達しました');
          expect(Date.now() - start).toBeLessThan(30_000);
          // 確かめたいのは、動いているエンジンを期限で止めること。準備で期限を使い切ってエンジンを起動せずに止まった場合と区別する
          expect(repo.calls(), r.stdout).toHaveLength(1);
          assertStoppedProcess(pidFile);
        } finally { cleanupTestProcess(pidFile); }
      },
      // 負荷の高い CI でも、準備（仕様ゲートと git）のあとにエンジンが起動してから期限に当たる長さにする
      { run: { timeoutMinutes: 0.1 } },
    ));

  it('[REQ-105] 完了ゲートのテストが終わらないまま上限に達したら、テストを止めて止まる', () =>
    withRepo(
      async (repo) => {
        const pidFile = join(repo.base, 'quality.pid');
        repo.write('write-report.mjs', `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`);
        repo.git('commit', '-q', '-am', '終わらないテスト');
        repo.plan([noChange, noChange]);
        const start = Date.now();
        try {
          const r = await run(repo);
          expect(r.code).toBe(1);
          expect(r.stdout).toContain('実行時間の上限に達しました');
          expect(repo.calls()).toHaveLength(2);
          expect(Date.now() - start).toBeLessThan(30_000);
          expect(tasksMd(repo)).toContain('- [ ] 3.1');
          assertStoppedProcess(pidFile);
        } finally { cleanupTestProcess(pidFile); }
      },
      // 期限は run の開始時に決まるので、準備（仕様ゲート・git・エンジン 2 回・verify）が終わって品質コマンドが起動したあとに期限が来る長さにする。
      // Windows の CI では node と git の起動が遅く、6 秒では品質コマンドが PID を書く前に期限が来た（run 40182208306）。手元の Linux は 1 コアに負荷をかけても 2 秒以内
      { run: { timeoutMinutes: process.platform === 'win32' ? 0.3 : 0.1 } },
    ));
});
