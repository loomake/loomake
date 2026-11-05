import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { loadQualitySchema } from '@loomake/core';
import { createInputReader, loadConfig, readQualityFile, runVerify, sha256Hex, RuntimeFailure, UsageError,
  type QualityCommandOutcome, type StaticMetricsReceipt } from '@loomake/kit';
import { acquireEvalLock, appendQualityRows, assertEvalOwner, EVAL_LOCK, readQualitySnapshot, readQualityStorage,
  releaseOwnEvalLock, replaceQualityIndex, sameQualitySnapshot, type OwnedEvalLock } from './quality-files.js';
import { buildQualityEvaluation, type EvaluationBasis, type EvaluationTarget } from './quality-model.js';
import { nextQualityAttempt, runPairKey, sameEvaluationConditions, type FailedAttempt, type QualityFailure, type RequestEvent } from './quality-ledger.js';
import { qualityGit, qualityWorktreeClean } from './quality-worktree.js';
import { clearQualityOutputs, collectQualityPayload, COVERAGE_REPORT, qualityCommands, qualityExecutionFailure,
  qualityProducer, staticEvaluationObservations, testRunIncomplete } from './quality-execution.js';

export type EvalOptions = {
  root: string; stdout: (text: string) => void; progress?: (text: string) => void; signal?: AbortSignal;
  /** Internal clock and command deadline for deterministic integration tests; no CLI options. */
  now?: () => Date; timeoutMs?: number;
};

/** C2b adds its ledger lock here; every C2a write already checks the execution token. */
function withLedgerWrite<T>(lock: OwnedEvalLock, action: () => T): T { assertEvalOwner(lock); return action(); }
function writeEvents(lock: OwnedEvalLock, rows: RequestEvent[]): void {
  if (rows.length) withLedgerWrite(lock, () => appendQualityRows(lock, 'requests', rows));
}

function recoverRequests(lock: OwnedEvalLock, target: EvaluationTarget, basis: EvaluationBasis, at: string): void {
  const { ledgers } = readQualityStorage(lock.root);
  const events: RequestEvent[] = [];
  for (const state of ledgers.states.values()) {
    const base = { version: 1 as const, requestId: state.accepted.requestId, at };
    if (state.state === 'running' && state.started) {
      const pair = { runId: state.started.runId, attempt: state.started.attempt };
      if (ledgers.history.some((row) => runPairKey(row) === runPairKey(pair))) {
        events.push({ ...base, event: 'evaluated', ...pair }); continue;
      }
      if (!ledgers.attempts.some((row) => runPairKey(row) === runPairKey(pair))) {
        const crashed: FailedAttempt = { version: 1, ...pair, requestId: base.requestId, target: state.accepted.target, basis: state.accepted.basis,
          startedAt: state.started.at, endedAt: null, detectedAt: at, result: 'failed', failure: 'crashed',
          summary: `reports/quality/requests.jsonl#${base.requestId}` };
        withLedgerWrite(lock, () => appendQualityRows(lock, 'attempts', [crashed]));
      }
      events.push({ ...base, event: 'abandoned', phase: 'running', detectedBy: lock.token.requestId });
    } else if (state.state === 'waiting') events.push({ ...base, event: 'abandoned', phase: 'waiting', detectedBy: lock.token.requestId });
    else if (state.state !== 'reevaluation-pending') continue;
    if (!sameEvaluationConditions(state.accepted, { target, basis })) events.push({ ...base, event: 'unrecoverable',
      reason: state.accepted.target.commit !== target.commit ? 'head-changed' : 'basis-changed' });
  }
  writeEvents(lock, events);
  const storage = readQualityStorage(lock.root);
  const last = storage.ledgers.history.at(-1);
  if (storage.repairIndex && last) withLedgerWrite(lock, () => replaceQualityIndex(lock, last));
}

/** Manual evaluation: numeric quality failures are data, transport or persistence failures are exits. */
export async function runEval(options: EvalOptions): Promise<number> {
  const root = resolve(options.root), now = options.now ?? (() => new Date());
  const config = loadConfig(root);
  const loaded = readQualityFile({ root, gate: 'done', schema: (await loadQualitySchema()).qualitySchema });
  if (loaded.status !== 'loaded') throw new UsageError(loaded.status === 'error' ? loaded.error.message : 'quality.yaml がありません');
  const reader = createInputReader();
  const qualityHash = sha256Hex(reader.read(join(root, 'quality.yaml')));
  const target: EvaluationTarget = { commit: qualityGit(root, ['rev-parse', 'HEAD']).trim(),
    committedAt: new Date(qualityGit(root, ['show', '-s', '--format=%cI', 'HEAD']).trim()).toISOString() };
  const basis: EvaluationBasis = { qualitySha256: qualityHash, qualityVersion: 2, model: loaded.quality.model };
  const at = now().toISOString();
  const lock = acquireEvalLock(root, { runId: randomUUID(), requestId: randomUUID(), pid: process.pid, createdAt: at });
  if (!lock) { options.progress?.(`実行中の評価があります（${EVAL_LOCK}）。要求は受け付けていません。止まった実行の残りなら確かめてから消してください`); return 3; }
  try {
    recoverRequests(lock, target, basis, at);
    const { ledgers } = readQualityStorage(root);
    const attempt = nextQualityAttempt(ledgers.history, ledgers.attempts, target.commit);
    const pair = { runId: lock.token.runId, attempt }, requestId = lock.token.requestId;
    const accepted: RequestEvent = { version: 1, event: 'accepted', requestId, at, source: 'manual-cli', pid: process.pid, target: { commit: target.commit },
      basis: { qualitySha256: qualityHash } };
    writeEvents(lock, [accepted, { version: 1, event: 'started', requestId, at, ...pair }]);
    let endedAt = at;
    const fail = (failure: QualityFailure, exit: number, cancelled = false): number => {
      const row: FailedAttempt = { version: 1, ...pair, requestId, target: { commit: target.commit }, basis: { qualitySha256: qualityHash },
        startedAt: at, endedAt, detectedAt: now().toISOString(), result: 'failed', failure, summary: `reports/quality/requests.jsonl#${requestId}` };
      withLedgerWrite(lock, () => appendQualityRows(lock, 'attempts', [row]));
      writeEvents(lock, [cancelled ? { version: 1, event: 'cancelled', requestId, at: row.detectedAt, phase: 'running', signal: 'abort' }
        : { version: 1, event: 'failed', requestId, at: row.detectedAt, ...pair, failure }]);
      options.progress?.(`品質評価を保存しませんでした（${failure}）。失敗試行を記録しました`); return exit;
    };
    if (!qualityWorktreeClean(lock, readQualitySnapshot(root))) return fail('dirty', 1);
    try { clearQualityOutputs(root, config.tests.report); } catch { return fail('save', 2); }
    const snapshot = readQualitySnapshot(root), beforeProducer = qualityProducer(root);
    const outcomes: QualityCommandOutcome[] = [];
    const startedAt = now().getTime();
    let executionError = false;
    try {
      runVerify({ root, progress: options.progress, onCommand: (outcome) => outcomes.push(outcome), timeoutMs: options.timeoutMs });
    }
    catch { executionError = true; }
    const finishedAt = now().getTime(); endedAt = new Date(finishedAt).toISOString();
    await setImmediate();
    assertEvalOwner(lock);
    if (options.signal?.aborted) return fail('interrupted', 3, true);
    const failed = qualityExecutionFailure(config, outcomes);
    if (executionError || failed) return fail(failed ?? 'launch', 3);
    let unchanged = false;
    try {
      const after = readQualitySnapshot(root);
      unchanged = qualityGit(root, ['rev-parse', 'HEAD']).trim() === target.commit
        && sha256Hex(createInputReader().read(join(root, 'quality.yaml'))) === qualityHash
        && sameQualitySnapshot(snapshot, after) && qualityWorktreeClean(lock, after);
    } catch (error) { if (error instanceof RuntimeFailure) throw error; }
    if (!unchanged) return fail('changed', 1);
    const producer = qualityProducer(root);
    const report = collectQualityPayload(root, config.tests.report);
    const coverage = collectQualityPayload(root, COVERAGE_REPORT);
    const test = outcomes.find((outcome) => outcome.name === 'test');
    let incomplete = config.commands.test
      ? testRunIncomplete(report, producer, test?.kind === 'exited' ? test.status : 1) : undefined;
    if (JSON.stringify(producer) !== JSON.stringify(beforeProducer)) incomplete = 'producer/版が実行中に変化';
    const commands = qualityCommands(config, outcomes);
    const receipt: StaticMetricsReceipt | null = incomplete ? null : { producer, target: { before: target.commit, after: target.commit },
      basis: { before: qualityHash, after: qualityHash },
      invocation: { startedAt, finishedAt, testCleared: true, coverageCleared: true }, commands, report, coverage };
    const evaluation = buildQualityEvaluation({
      quality: loaded.quality, observations: staticEvaluationObservations(loaded.quality, receipt, incomplete),
      commands, ...pair, evaluatedAt: endedAt, evaluatorVersion: (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version,
      target, basis, request: { id: requestId, requestedAt: at, source: 'manual-cli' } });
    try { withLedgerWrite(lock, () => appendQualityRows(lock, 'history', [evaluation])); }
    catch (error) { if (error instanceof RuntimeFailure) throw error; options.progress?.((error as Error).message); return fail('save', 2); }
    try { withLedgerWrite(lock, () => replaceQualityIndex(lock, evaluation)); }
    catch (error) {
      if (error instanceof RuntimeFailure) throw error;
      options.progress?.('履歴は保存しましたが最新索引を更新できません。原本を保持して再実行し、索引を復旧してください'); return 2;
    }
    const completedAt = now().toISOString();
    const events: RequestEvent[] = [{ version: 1, event: 'evaluated', requestId, at: completedAt, ...pair }];
    for (const state of readQualityStorage(root).ledgers.states.values()) {
      if (state.state === 'reevaluation-pending' && sameEvaluationConditions(state.accepted, { target, basis })) {
        events.push({ version: 1, event: 'reevaluated', requestId: state.accepted.requestId, at: completedAt, ...pair });
      }
    }
    writeEvents(lock, events);
    options.stdout(`品質評価を保存しました：reports/quality/quality-report.json（製品品質 ${evaluation.summary.product.verdict}、利用時品質 ${evaluation.summary.usage.verdict}）`);
    return 0;
  } finally { releaseOwnEvalLock(lock); }
}
