import { describe, expect, it } from 'vitest';
import { UsageError } from '@loomake/kit';
import { parseRunConfig } from '../src/config.js';

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
