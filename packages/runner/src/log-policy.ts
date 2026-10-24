import { UsageError, DOCUMENT_LIMITS } from '@loomake/kit';
export const DEFAULT_MAX_LOG_BYTES = 128 * 1024 * 1024;
export const DEFAULT_MAX_HISTORY_BYTES = 512 * 1024 * 1024;
export const SUMMARY_RESERVE_BYTES = 64 * 1024;
export type LogLimits = { maxRunBytes: number; maxHistoryBytes: number; summaryBytes: number; maxEntries: number };
export type LogUsage = { runBytes: number; historyBytes: number; entries: number };
export const DEFAULT_LOG_LIMITS: Readonly<LogLimits> = Object.freeze({
  maxRunBytes: DEFAULT_MAX_LOG_BYTES,
  maxHistoryBytes: DEFAULT_MAX_HISTORY_BYTES,
  summaryBytes: SUMMARY_RESERVE_BYTES,
  maxEntries: DOCUMENT_LIMITS.maxEntries,
});
export class LogQuotaError extends UsageError {}
export function validateLogLimits(limits: LogLimits) {
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value <= 0) || limits.maxRunBytes <= limits.summaryBytes || limits.maxHistoryBytes <= limits.summaryBytes) throw new UsageError('実行記録の予算は、停止情報の予約より大きい安全な整数にしてください');
}
/** データ保存後も停止情報の容量と1項目を残す。I/Oと入力の変更を行わない。 */
export function admitLog(usage: Readonly<LogUsage>, bytes: number, limits: LogLimits): LogUsage {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new UsageError('記録のバイト数が不正です');
  if (bytes > limits.maxRunBytes - limits.summaryBytes - usage.runBytes) throw new LogQuotaError(`実行記録の上限は${limits.maxRunBytes}バイトです（停止情報の予約${limits.summaryBytes}バイトを含む）`);
  if (bytes > limits.maxHistoryBytes - limits.summaryBytes - usage.historyBytes) throw new LogQuotaError(`実行履歴の上限は${limits.maxHistoryBytes}バイトです（停止情報の予約を含む）。保存方針と退避先を確認してください`);
  if (usage.entries + 2 > limits.maxEntries) throw new LogQuotaError(`実行履歴の項目数の上限は${limits.maxEntries}です（停止情報の1項目を含む）`);
  return { runBytes: usage.runBytes + bytes, historyBytes: usage.historyBytes + bytes, entries: usage.entries + 1 };
}
