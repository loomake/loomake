import { UsageError } from '@loomake/kit';

export type RunConfig = { maxFixes: number; timeoutMinutes: number };

/** runの設定を検証する。ファイルや環境を読まず、未知の入力を確定した設定へ変換する。 */
export function parseRunConfig(raw: unknown): RunConfig {
  const config: RunConfig = { maxFixes: 5, timeoutMinutes: 60 };
  if (raw === undefined) return config;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new UsageError('loomake.config.json の run はオブジェクトにしてください');
  }
  for (const key of ['maxFixes', 'timeoutMinutes'] as const) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || !(v > 0) || (key === 'maxFixes' && !Number.isSafeInteger(v))) {
      throw new UsageError(`loomake.config.json の run.${key} は${key === 'maxFixes' ? '正の安全な整数' : '正の有限数'}にしてください`);
    }
    config[key] = v;
  }
  return config;
}
