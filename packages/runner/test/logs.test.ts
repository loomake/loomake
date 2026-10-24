import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageError } from '@loomake/kit';
import { admitLog, LogQuotaError } from '../src/log-policy.js';
import { checkLogHistory, createLogStore } from '../src/logs.js';

vi.mock('node:fs', async (original) => { const fs = await original<typeof import('node:fs')>(); return { ...fs, writeFileSync: vi.fn(fs.writeFileSync) }; });
afterEach(() => vi.clearAllMocks());
const limits = { maxRunBytes: 64, maxHistoryBytes: 128, summaryBytes: 32, maxEntries: 16 };
function fixture(action: (root: string) => void) { const root = mkdtempSync(join(tmpdir(), 'loomake-log-')); try { action(root); } finally { rmSync(root, { recursive: true, force: true }); } }

describe('記録予算の純粋な判定', () => {
  it('[REQ-178] 予約分を残した境界を認め、元の使用量を変えない', () => {
    const usage = Object.freeze({ runBytes: 20, historyBytes: 40, entries: 3 });
    expect(admitLog(usage, 12, limits)).toEqual({ runBytes: 32, historyBytes: 52, entries: 4 });
    expect(() => admitLog(usage, 13, limits)).toThrow(LogQuotaError);
    expect(usage).toEqual({ runBytes: 20, historyBytes: 40, entries: 3 });
  });
  it('[REQ-178] 履歴と空ファイルの項目数も予約分を残して制限する', () => {
    expect(() => admitLog({ runBytes: 0, historyBytes: 96, entries: 3 }, 1, limits)).toThrow('履歴');
    expect(() => admitLog({ runBytes: 0, historyBytes: 0, entries: 15 }, 0, limits)).toThrow('項目');
  });
});

describe('管理する記録のI/O', () => {
  it('[REQ-178] UTF-8の保存量とsummaryの予約を分ける', () => fixture((root) => {
    const store = createLogStore(root, 'run', limits);
    store.save('a.log', 'あ'.repeat(10));
    expect(() => store.save('b.log', 'あ')).toThrow(LogQuotaError);
    store.finish('summary.json', '{}');
    expect(readFileSync(join(store.runDir, 'a.log'), 'utf8')).toBe('あ'.repeat(10));
    expect(readdirSync(store.runDir)).toEqual(['a.log', 'summary.json']);
  }));
  it('[REQ-178] 同じ開始名でも以前の記録を上書きしない', () => fixture((root) => {
    const first = createLogStore(root, 'run', limits); first.finish('summary.json', '{}');
    const second = createLogStore(root, 'run', limits);
    expect(second.runDir).not.toBe(first.runDir);
    expect(readFileSync(join(first.runDir, 'summary.json'), 'utf8')).toBe('{}');
  }));
  it('[REQ-178] 履歴は内容を読まずサイズで拒否し削除しない', () => fixture((root) => {
    const runs = join(root, '.loomake/runs'); mkdirSync(runs, { recursive: true });
    writeFileSync(join(runs, '.gitignore'), '*\n'); writeFileSync(join(runs, 'old.log'), ''); truncateSync(join(runs, 'old.log'), 100);
    expect(() => checkLogHistory(root, limits)).toThrow('履歴');
    expect(readdirSync(runs)).toEqual(['.gitignore', 'old.log']);
  }));
  it('[REQ-178] 空の記録も停止情報の1項目を予約する', () => fixture((root) => {
    const store = createLogStore(root, 'run', { ...limits, maxEntries: 4 });
    store.save('empty', '');
    expect(() => store.save('another', '')).toThrow('項目');
    store.finish('summary.json', '{}');
  }));
  it('[REQ-178] パスと予約名をデータとして渡せず既存名も保護する', () => fixture((root) => {
    const store = createLogStore(root, 'run', limits);
    expect(() => store.save('../outside', 'x')).toThrow(UsageError);
    expect(() => store.save('summary.json', 'x')).toThrow(UsageError);
    writeFileSync(join(store.runDir, 'existing'), 'original');
    expect(() => store.save('existing', 'new')).toThrow(UsageError);
    expect(readFileSync(join(store.runDir, 'existing'), 'utf8')).toBe('original');
  }));
  it('[REQ-179] 巨大なsummaryを拒否した後も予約した停止情報は書ける', () => fixture((root) => {
    const store = createLogStore(root, 'run', limits);
    expect(() => store.finish('summary.json', 'x'.repeat(33))).toThrow(LogQuotaError);
    expect(existsSync(join(store.runDir, 'summary.json'))).toBe(false);
    store.finish('stop.json', '{}');
    expect(readdirSync(store.runDir)).toEqual(['stop.json']);
  }));
  it('[REQ-178][REQ-179] I/O失敗後は部分ファイルを片付け不明な使用量で書き続けない', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root) => {
      const store = createLogStore(root, 'run', limits);
      vi.mocked(writeFileSync).mockImplementationOnce((target) => { actual.writeFileSync(target, 'part'); throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); });
      expect(() => store.save('data', 'complete')).toThrow(UsageError);
      expect(readdirSync(store.runDir)).toEqual([]);
      expect(() => store.finish('summary.json', '{}')).toThrow(UsageError);
    });
  });
});
