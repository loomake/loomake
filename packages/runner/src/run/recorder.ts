// 実行の記録（summary.json・stop.json）と、終わったときの表示
import { holderWaitTime, isAbortedResult, isVerifyResultV2, verifyExitCode } from '@loomake/kit';
import { maskSecrets } from '../mask.js';
import { createLogStore } from '../logs.js';
import { LogQuotaError } from '../log-policy.js';
import { logLimits } from './prepare.js';
import { taskLabel } from './tasks.js';
import { RUNS_DIR, type Recorder, type RunContext, type RunSummary } from './types.js';

const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');

/** 実行の記録を作る。.gitignore で記録を git の追跡から外す */
export function startRecording(ctx: RunContext): Recorder {
  const { root, changeId, stdout } = ctx;
  const startedAt = ctx.now();
  const store = createLogStore(root, `${stamp(startedAt)}-${changeId}`, logLimits(ctx.runConfig));
  const { runDir, runId } = store;
  const base = startedAt.getTime() + ctx.runConfig.timeoutMinutes * 60_000;
  const waitedAtStart = holderWaitTime();
  const rec: Recorder = {
    runDir,
    // Windows の保持役の準備を待った時間は、run の共有予算に含めない（REQ-257）
    get deadline() { return base + holderWaitTime() - waitedAtStart; },
    done: [],
    lastVerify: null,
    step: 0,
    save: (name, text) => store.save(name, text),
    finish: (status, reason, remaining) => {
      const { lastVerify } = rec;
      // RunSummary の外形は変えない。2.0.0 では ok を scope:local の完了とし、mode は完了ゲート（REQ-205）
      const v2 = lastVerify && isVerifyResultV2(lastVerify) ? lastVerify : undefined;
      const localDone = Boolean(v2 && !isAbortedResult(v2) && v2.scope === 'local' && verifyExitCode(v2) === 0);
      const verified = lastVerify && (v2 ? { ok: localDone, mode: 'done' } : { ok: (lastVerify as { ok: boolean }).ok, mode: (lastVerify as { mode: string }).mode });
      const summary: RunSummary = {
        change: changeId,
        status,
        reason,
        doneTasks: rec.done,
        remainingTasks: remaining.map(taskLabel),
        lastVerify: verified,
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
          `最後の検査結果：${!verified ? 'なし' : !verified.ok ? '不合格' : v2 ? 'ローカルの項目はすべて完了（CI の最終合格は未確認）' : '合格'}`,
          ...(recordingError ? [`記録を保存できません：${recordingError}`] : []),
          saved === 'summary.json' ? `記録：${RUNS_DIR}/${runId}/` : saved === 'stop.json' ? `停止情報：${RUNS_DIR}/${runId}/stop.json` : `保存先を確認してください：${RUNS_DIR}/${runId}/`,
        ].join('\n'),
      );
      return status === 'completed' && !recordingError ? 0 : 1;
    },
  };
  return rec;
}
