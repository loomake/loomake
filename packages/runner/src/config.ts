import { UsageError } from '@loomake/kit';
import { DEFAULT_MAX_LOG_BYTES, DEFAULT_MAX_HISTORY_BYTES, SUMMARY_RESERVE_BYTES } from './log-policy.js';

// 完了ゲートの 1 回と直し 5 回の 6 回分（96MiB）が、記録の上限（128MiB）に収まる量（REQ-151・REQ-210）
export const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export const RUN_CONFIG_KEYS = ['maxFixes', 'timeoutMinutes', 'maxOutputBytes', 'maxLogBytes', 'maxHistoryBytes'] as const;

export type RunConfig = { maxFixes: number; timeoutMinutes: number; maxOutputBytes: number; maxLogBytes: number; maxHistoryBytes: number };

/** runの設定を検証する。ファイルや環境を読まず、未知の入力を確定した設定へ変換する。 */
export function parseRunConfig(raw: unknown): RunConfig {
  const config: RunConfig = {
    maxFixes: 5,
    timeoutMinutes: 60,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
    maxLogBytes: DEFAULT_MAX_LOG_BYTES,
    maxHistoryBytes: DEFAULT_MAX_HISTORY_BYTES,
  };
  if (raw === undefined) return config;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new UsageError('loomake.config.json の run はオブジェクトにしてください');
  }
  for (const key of RUN_CONFIG_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || !(v > 0) || (key !== 'timeoutMinutes' && !Number.isSafeInteger(v))) {
      throw new UsageError(`loomake.config.json の run.${key} は${key === 'timeoutMinutes' ? '正の有限数' : '正の安全な整数'}にしてください`);
    }
    if ((key === 'maxLogBytes' || key === 'maxHistoryBytes') && v <= SUMMARY_RESERVE_BYTES) throw new UsageError(`loomake.config.json の run.${key} は停止情報の予約${SUMMARY_RESERVE_BYTES}バイトより大きくしてください`);
    config[key] = v;
  }
  return config;
}
