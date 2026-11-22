import { UsageError } from '@loomake/kit';
import { QUALITY_HASH, QUALITY_SHA, QUALITY_UUID, positiveInteger, qualityEvaluationProblem, qualityIsoDate, qualityObject, type QualityEvaluation } from './quality-model.js';

export const QUALITY_FAILURES = ['dirty', 'changed', 'timeout', 'interrupted', 'launch', 'save', 'crashed'] as const;
export type QualityFailure = typeof QUALITY_FAILURES[number];
export type RequestConditions = { target: { commit: string }; basis: { qualitySha256: string } };
type EventBase = { version: 1; requestId: string; at: string };
type RunPair = { runId: string; attempt: number };
export type AcceptedRequest = EventBase & RequestConditions & { event: 'accepted'; source: 'manual-cli'; pid: number };
export type RequestEvent = (AcceptedRequest
  | (EventBase & RunPair & { event: 'started' | 'evaluated' | 'reevaluated' })
  | (EventBase & RunPair & { event: 'failed'; failure: QualityFailure })
  | (EventBase & { event: 'cancelled'; phase: 'waiting' | 'running'; signal: string })
  | (EventBase & { event: 'abandoned'; phase: 'waiting' | 'running'; detectedBy: string })
  | (EventBase & { event: 'unrecoverable'; reason: 'head-changed' | 'basis-changed' })) & Record<string, unknown>;
export type RequestState = {
  accepted: AcceptedRequest; last: RequestEvent;
  state: 'waiting' | 'running' | 'evaluated' | 'reevaluation-pending' | 'cancelled' | 'unrecoverable';
  started?: RequestEvent & RunPair;
};
export type FailedAttempt = RequestConditions & RunPair & {
  version: 1; requestId: string; startedAt: string; endedAt: string | null; detectedAt: string;
  result: 'failed'; failure: QualityFailure; summary: string;
} & Record<string, unknown>;
export type QualityLedgers = { requests: RequestEvent[]; attempts: FailedAttempt[]; history: QualityEvaluation[]; states: Map<string, RequestState> };
export const runPairKey = (value: RunPair): string => JSON.stringify([value.runId, value.attempt]);
const uuid = (value: unknown): value is string => typeof value === 'string' && QUALITY_UUID.test(value);
const pair = (value: Record<string, unknown>): boolean => uuid(value.runId) && positiveInteger(value.attempt);
const conditions = (value: Record<string, unknown>): boolean => qualityObject(value.target) && typeof value.target.commit === 'string' && QUALITY_SHA.test(value.target.commit)
  && qualityObject(value.basis) && typeof value.basis.qualitySha256 === 'string' && QUALITY_HASH.test(value.basis.qualitySha256);
const failure = (value: unknown): value is QualityFailure => QUALITY_FAILURES.includes(value as QualityFailure);
export const sameEvaluationConditions = (left: RequestConditions, right: RequestConditions): boolean =>
  left.target.commit === right.target.commit && left.basis.qualitySha256 === right.basis.qualitySha256;

export function requestEventProblem(value: unknown): string | undefined {
  if (!qualityObject(value) || value.version !== 1 || !uuid(value.requestId) || !qualityIsoDate(value.at)) return '要求イベントの版・要求ID・日時が不正です';
  switch (value.event) {
    case 'accepted': return conditions(value) && value.source === 'manual-cli' && positiveInteger(value.pid) ? undefined : '受付の対象・基準・起動元が不正です';
    case 'started': case 'evaluated': case 'reevaluated': return pair(value) ? undefined : '要求イベントの実行IDか試行番号が不正です';
    case 'failed': return pair(value) && failure(value.failure) ? undefined : '要求の失敗イベントが不正です';
    case 'cancelled': return (value.phase === 'waiting' || value.phase === 'running') && typeof value.signal === 'string' && value.signal.length > 0 ? undefined : '要求の取消イベントが不正です';
    case 'abandoned': return (value.phase === 'waiting' || value.phase === 'running') && uuid(value.detectedBy) ? undefined : '要求の放棄イベントが不正です';
    case 'unrecoverable': return (value.reason === 'head-changed' || value.reason === 'basis-changed') ? undefined : '要求の回収不能イベントが不正です';
    default: return '要求イベントの種類が不正です';
  }
}

/** 行順から状態を導く。再評価待ちを真の終端と混同せず、入力や以前のイベントを変更しない。 */
export function foldRequests(events: readonly RequestEvent[]): Map<string, RequestState> {
  const states = new Map<string, RequestState>();
  const runs = new Set<string>();
  for (const event of events) {
    const problem = requestEventProblem(event); if (problem) throw new UsageError(problem);
    const previous = states.get(event.requestId);
    if (event.event === 'accepted') {
      if (previous) throw new UsageError('同じ要求IDの受付が重複しています');
      states.set(event.requestId, { accepted: event, last: event, state: 'waiting' }); continue;
    }
    if (!previous) throw new UsageError('受付より前の要求イベントがあります');
    const next: RequestState = { ...previous, last: event };
    if (event.event === 'started') {
      if (previous.state !== 'waiting' || previous.started || runs.has(runPairKey(event))) throw new UsageError('要求の開始が重複するか順序が不正です');
      runs.add(runPairKey(event)); next.started = event; next.state = 'running';
    } else if (event.event === 'evaluated' || event.event === 'failed') {
      if (previous.state !== 'running' || !previous.started || runPairKey(previous.started) !== runPairKey(event)) throw new UsageError('要求の実行結果が開始記録と一致しません');
      next.state = event.event === 'evaluated' ? 'evaluated' : 'reevaluation-pending';
    } else if (event.event === 'cancelled') {
      if (previous.state !== 'running' || event.phase !== 'running') throw new UsageError('C2aの取消は実行中の要求に限ります');
      next.state = 'cancelled';
    } else if (event.event === 'abandoned') {
      if ((previous.state !== 'waiting' && previous.state !== 'running') || event.phase !== previous.state) throw new UsageError('要求の放棄の状態が不正です');
      next.state = 'reevaluation-pending';
    } else if (event.event === 'reevaluated') {
      if (previous.state !== 'reevaluation-pending') throw new UsageError('再評価待ちではない要求を再評価で解消できません');
      next.state = 'evaluated';
    } else {
      if (previous.state !== 'waiting' && previous.state !== 'reevaluation-pending') throw new UsageError('回収不能にできる要求の状態ではありません');
      next.state = 'unrecoverable';
    }
    states.set(event.requestId, next);
  }
  return states;
}

export function failedAttemptProblem(value: unknown): string | undefined {
  if (!qualityObject(value) || value.version !== 1 || !pair(value) || !uuid(value.requestId) || !conditions(value)
    || !qualityIsoDate(value.startedAt) || (value.endedAt !== null && !qualityIsoDate(value.endedAt)) || !qualityIsoDate(value.detectedAt)
    || value.result !== 'failed' || !failure(value.failure) || value.summary !== `reports/quality/requests.jsonl#${value.requestId}`) return '失敗試行の構造が不正です';
  if ((value.failure === 'crashed') !== (value.endedAt === null)) return '失敗試行の終了時刻と分類が一致しません';
  return undefined;
}

/** JSONLの不完全な末尾・空行・JSON不正を拒否し、以前の行を修復しない。 */
export function parseQualityLines<T>(text: string, problem: (value: unknown) => string | undefined): T[] {
  if (!text) return [];
  if (!text.endsWith('\n')) throw new UsageError('評価の台帳が改行で終わっていません。原本を確認してください');
  const rows: T[] = [];
  for (const line of text.slice(0, -1).split('\n')) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new UsageError('評価の台帳に不正なJSONがあります。原本を確認してください'); }
    const issue = problem(value); if (issue) throw new UsageError(issue);
    rows.push(value as T);
  }
  return rows;
}

/** 3帳簿の参照と(runId,attempt)だけの重複を検査する。孤立startedは回収のため受け付ける。 */
export function validateQualityLedgers(input: { requests: string; attempts: string; history: string }): QualityLedgers {
  const requests = parseQualityLines<RequestEvent>(input.requests, requestEventProblem);
  const attempts = parseQualityLines<FailedAttempt>(input.attempts, failedAttemptProblem);
  const history = parseQualityLines<QualityEvaluation>(input.history, qualityEvaluationProblem);
  const states = foldRequests(requests);
  const pairs = new Set<string>();
  const results = new Map<string, QualityEvaluation>();
  for (const [kind, rows] of [['attempt', attempts], ['history', history]] as const) {
    for (const row of rows) {
      const key = runPairKey(row);
      if (pairs.has(key)) throw new UsageError('履歴と失敗試行に同じ実行ID・試行番号の組があります');
      pairs.add(key);
      const requestId = kind === 'attempt' ? (row as FailedAttempt).requestId : (row as QualityEvaluation).request.id;
      const state = states.get(requestId);
      if (!state?.started || runPairKey(state.started) !== key || !sameEvaluationConditions(state.accepted, row)) throw new UsageError('履歴か失敗試行が要求の開始記録と一致しません');
      if (kind === 'history') {
        const report = row as QualityEvaluation;
        if (report.request.requestedAt !== state.accepted.at) throw new UsageError('評価の要求時刻か起動元が受付と一致しません');
        results.set(key, report);
      } else if ((row as FailedAttempt).startedAt !== state.started.at) throw new UsageError('失敗試行の開始時刻が要求と一致しません');
    }
  }
  for (const state of states.values()) {
    const event = state.last;
    if (event.event === 'evaluated' || event.event === 'reevaluated') {
      const report = results.get(runPairKey(event));
      if (!report || !sameEvaluationConditions(state.accepted, report) || (event.event === 'evaluated' && report.request.id !== event.requestId)) throw new UsageError('要求の評価済み参照が履歴と一致しません');
      if (event.event === 'reevaluated' && state.started && event.attempt <= state.started.attempt) throw new UsageError('再評価が失敗試行より後ではありません');
    }
    if (event.event === 'failed' && !attempts.some((attempt) => attempt.requestId === event.requestId && runPairKey(attempt) === runPairKey(event) && attempt.failure === event.failure)) throw new UsageError('要求の失敗に対応する失敗試行がありません');
  }
  return { requests, attempts, history, states };
}

export function nextQualityAttempt(history: readonly QualityEvaluation[], attempts: readonly FailedAttempt[], commit: string): number {
  const previous = [...history, ...attempts].filter((row) => row.target.commit === commit);
  const next = previous.length + 1;
  if (!positiveInteger(next) || previous.some((row) => row.attempt >= next)) throw new UsageError('試行番号と既存の行数が整合しません');
  return next;
}

/** 過去の失敗行は残し、同じ対象・基準の後の成功の存在だけを導く。 */
export function unresolvedQualityAttempts(attempts: readonly FailedAttempt[], history: readonly QualityEvaluation[]): FailedAttempt[] {
  return attempts.filter((attempt) => !history.some((row) => sameEvaluationConditions(attempt, row) && row.attempt > attempt.attempt));
}
