import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runVerify, type QualityCommandOutcome } from '@loomake/kit';
import { appendQualityRows, EVAL_LOCK, QUALITY_FILES } from '../src/quality-files.js';
import { fixture } from './quality-eval-fixtures.js';

vi.mock('@loomake/kit', async (original) => { const actual = await original<typeof import('@loomake/kit')>(); return { ...actual, runVerify: vi.fn(actual.runVerify) }; });
vi.mock('../src/quality-files.js', async (original) => { const actual = await original<typeof import('../src/quality-files.js')>(); return { ...actual, appendQualityRows: vi.fn(actual.appendQualityRows) }; });
vi.mock('node:fs', async (original) => { const actual = await original<typeof import('node:fs')>(); return { ...actual, renameSync: vi.fn(actual.renameSync) }; });
afterEach(() => vi.clearAllMocks());
vi.setConfig({ testTimeout: 15_000 });
describe('実行通知と保存途中の失敗', () => {
  it('[REQ-429][REQ-441] 異常通知・通知欠落では部分reportがあっても履歴なし失敗試行を残す', async () => {
    const actual = await vi.importActual<typeof import('@loomake/kit')>('@loomake/kit');
    const cases: [QualityCommandOutcome | null, string][] = [
      [null, 'launch'], [{ name: 'test', kind: 'error', code: 'ENOENT' }, 'launch'], [{ name: 'test', kind: 'output' }, 'launch'],
      [{ name: 'test', kind: 'timeout' }, 'timeout'], [{ name: 'test', kind: 'signal', signal: 'SIGTERM' }, 'interrupted'], [{ name: 'test', kind: 'interrupted' }, 'interrupted'],
    ];
    for (const [outcome, classification] of cases) {
      const f = fixture();
      vi.mocked(runVerify).mockImplementationOnce((options) => {
        const result = actual.runVerify({ ...options, onCommand: undefined });
        if (outcome) options.onCommand?.(outcome); return result;
      });
      expect(await f.evaluate()).toBe(3); expect(existsSync(join(f.root, '.loomake/test-report.json'))).toBe(true);
      expect(f.storage().ledgers.history).toEqual([]); expect(f.storage().index).toBeNull();
      expect(f.storage().ledgers.attempts[0].failure).toBe(classification); expect(f.storage().ledgers.requests.at(-1)?.event).toBe('failed');
    }
  });
  it('[REQ-429][REQ-441] 実runVerifyの出力超過もlaunchとして保存を止める', async () => {
    const f = fixture("process.stdout.write('x'.repeat(65*1024*1024));"); expect(await f.evaluate()).toBe(3);
    expect(f.storage().ledgers.history).toEqual([]); expect(f.storage().ledgers.attempts[0].failure).toBe('launch');
  });
  it('[REQ-432][REQ-433][REQ-441] history追記失敗はsave試行、索引失敗はhistoryを残し次回復旧', async () => {
    const actual = await vi.importActual<typeof import('../src/quality-files.js')>('../src/quality-files.js');
    const f = fixture();
    vi.mocked(appendQualityRows).mockImplementation((lock, key, rows) => {
      if (key === 'history') throw new Error('fixture write error'); actual.appendQualityRows(lock, key, rows);
    });
    expect(await f.evaluate()).toBe(2); expect(f.storage().ledgers.attempts[0].failure).toBe('save'); expect(f.storage().ledgers.history).toEqual([]);
    vi.mocked(appendQualityRows).mockImplementation(actual.appendQualityRows);
    vi.mocked(renameSync).mockImplementationOnce(() => { throw new Error('fixture rename error'); });
    expect(await f.evaluate()).toBe(2); const saved = readFileSync(join(f.root, QUALITY_FILES.history));
    expect(f.storage().repairIndex).toBe(true); expect(f.storage().ledgers.requests.at(-1)?.event).toBe('started');
    expect(await f.evaluate()).toBe(0); expect(readFileSync(join(f.root, QUALITY_FILES.history)).subarray(0, saved.length)).toEqual(saved);
    expect(f.storage().ledgers.history.map((r) => r.attempt)).toEqual([2, 3]); expect(f.storage().repairIndex).toBe(false);
    expect(existsSync(join(f.root, EVAL_LOCK))).toBe(false);
  });
});
