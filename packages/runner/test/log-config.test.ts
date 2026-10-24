import { describe, expect, it } from 'vitest';
import { UsageError } from '@loomake/kit';
import { parseRunConfig } from '../src/config.js';
import { SUMMARY_RESERVE_BYTES } from '../src/log-policy.js';

describe('実行記録の予算設定', () => {
  it('[REQ-177] 既定は1回128MiB・履歴512MiB', () => {
    expect(parseRunConfig(undefined)).toMatchObject({ maxLogBytes: 128 * 1024 * 1024, maxHistoryBytes: 512 * 1024 * 1024 });
  });
  for (const key of ['maxLogBytes', 'maxHistoryBytes']) {
    it.each([0, -1, 1.5, NaN, Infinity, null, 65536])(`[REQ-177] ${key}の不正な値 %s を拒否する`, (value) => {
      expect(() => parseRunConfig({ [key]: value })).toThrow(UsageError);
    });
  }
  it('[REQ-177] 予約より大きい安全な整数を受け付ける', () => {
    expect(parseRunConfig({ maxLogBytes: 100000, maxHistoryBytes: 200000 })).toMatchObject({ maxLogBytes: 100000, maxHistoryBytes: 200000 });
  });
});

describe('出力と記録の既定の上限の整合', () => {
  it('[REQ-151][REQ-210] 既定では、出力の上限 ×（1 + 直しの上限）が、記録の上限から停止情報の予約を引いた量に収まる', () => {
    const config = parseRunConfig(undefined);
    expect(config.maxOutputBytes).toBe(16 * 1024 * 1024);
    expect(config.maxOutputBytes * (1 + config.maxFixes)).toBeLessThanOrEqual(config.maxLogBytes - SUMMARY_RESERVE_BYTES);
  });
});
