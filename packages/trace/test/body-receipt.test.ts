import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, fsyncSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { JSON_LIMITS, UsageError } from '@loomake/kit';
import { appendBodyReceipt, bodyReceiptProblem } from '../src/index.js';
import { receiptFixture, receiptPath } from '../../../tests/fixtures/body-index/fixture.js';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, fsyncSync: vi.fn(fs.fsyncSync), linkSync: vi.fn(fs.linkSync), writeFileSync: vi.fn(fs.writeFileSync) };
});
afterEach(() => vi.clearAllMocks());
function fixture(action: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake body receipt '));
  try { action(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function safeFailure(action: () => unknown) {
  let error: unknown; try { action(); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(UsageError); expect((error as Error).cause).toBeUndefined();
  expect((error as Error).message).toBe('本体参照receiptを追加できません。入力と保存先を確認してください。');
}
describe('immutable receiptの同期検証と公開', () => {
  it('[REQ-470] 必須構造・実在UTC・正safe試行番号・40/64桁SHAを同期検証する', () => {
    const r = receiptFixture().receipt;
    expect(bodyReceiptProblem(r)).toBeUndefined();
    expect(bodyReceiptProblem({ ...r, execution: { ...r.execution, checkoutSha: 'f'.repeat(64) } })).toBeUndefined();
    for (const value of [null, {}, { ...r, indexVersion: 2 }, { ...r, body: { ...r.body, bytes: Number.MAX_SAFE_INTEGER + 1 } },
      { ...r, artifact: { ...r.artifact, createdAt: '2026-02-30T00:00:00Z' } },
      { ...r, retrieval: { ...r.retrieval, retrievedAt: '2026-11-06T01:02:03+00:00' } }]) expect(bodyReceiptProblem(value)).toBeDefined();
    for (const runAttempt of [0, 1, '0', '01', '1e2', ' 1', '9007199254740992']) expect(bodyReceiptProblem({ ...r, locator: { ...r.locator, runAttempt } })).toBeDefined();
  });
  it('[REQ-470] 全必須欄の欠落・型とCI/ハッシュ/版の異常を拒否して一時出力も作らない', () => fixture((root) => {
    const r = receiptFixture().receipt;
    for (const [section, value] of Object.entries(r)) {
      const missing = { ...r }; delete missing[section]; expect(bodyReceiptProblem(missing)).toBeDefined();
      expect(bodyReceiptProblem({ ...r, [section]: null })).toBeDefined();
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) for (const key of Object.keys(value)) {
        const part: Record<string, unknown> = { ...value }; delete part[key];
        const bad = { ...r, [section]: part }; expect(bodyReceiptProblem(bad)).toBeDefined();
        safeFailure(() => appendBodyReceipt(root, bad));
      }
    }
    expect(readdirSync(root)).toEqual([]);
  }));
  it('[REQ-470] 既知gapの過不足・重複・nonnull矛盾と日本語文字の構造条件を検査する', () => {
    const r = receiptFixture().receipt, g = r.gaps[0];
    for (const gaps of [[], [g, g], [{ ...g, kind: 'not_applicable' }], [{ ...g, reason: '' }], [{ ...g, reason: 'unknown' }], [{ ...g, field: 'execution.workflowHeadSha' }]]) expect(bodyReceiptProblem({ ...r, gaps })).toBeDefined();
    const e = { ...r.execution, workflowHeadSha: null };
    expect(bodyReceiptProblem({ ...r, execution: e })).toBeDefined();
    expect(bodyReceiptProblem({ ...r, execution: e, gaps: [...r.gaps, { field: 'execution.workflowHeadSha', kind: 'unverified', reason: '未確認' }] })).toBeUndefined();
    expect(bodyReceiptProblem({ ...r, gaps: [...r.gaps, { field: 'future', kind: 'not_applicable', reason: '対象外' }] })).toBeUndefined();
  });
  it('[REQ-470] 非秘密の未知欄・own keyを入力不変で保存し日時の小数をUTC秒名にする', () => fixture((root) => {
    const r = receiptFixture().receipt;
    Object.defineProperty(r, '__proto__', { value: { future: true }, enumerable: true });
    r.future = { constructor: 'value', prototype: null }; const original = JSON.stringify(r);
    expect(appendBodyReceipt(root, r)).toBe(true);
    const file = join(root, receiptPath(r)), saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(r, null, 2) + '\n');
    expect(Object.hasOwn(saved, '__proto__')).toBe(true); expect(saved.__proto__).toEqual({ future: true });
    expect(saved.future).toEqual(r.future); expect(JSON.stringify(r)).toBe(original);
    expect(({} as Record<string, unknown>).future).toBeUndefined();
    expect(bodyReceiptProblem(saved)).toBeUndefined();
  }));
  it('[REQ-470] 共有maskが変える値・own keyとgetter/toJSON・循環・非JSONを安全に拒否する', () => fixture((root) => {
    const synthetic = 'ghp_' + 'A'.repeat(24);
    for (const future of [synthetic, { [synthetic]: 'value' }, { toJSON: () => { throw new Error('executed'); } }, undefined, Infinity]) {
      safeFailure(() => appendBodyReceipt(root, { ...receiptFixture().receipt, future }));
    }
    let calls = 0; const r = receiptFixture().receipt;
    Object.defineProperty(r, 'future', { get: () => { calls++; return 'raw'; }, enumerable: true });
    safeFailure(() => appendBodyReceipt(root, r)); expect(calls).toBe(0);
    const cycle = receiptFixture().receipt; cycle.future = cycle;
    safeFailure(() => appendBodyReceipt(root, cycle)); expect(readdirSync(root)).toEqual([]);
  }));
  it.each(['/absolute', '../escape', 'a/../b', './a', 'a//b', 'C:/drive', 'a\\b', 'a/'])('[REQ-470] 非正規の相対参照を拒否する: %s', (path) => {
    const r = receiptFixture().receipt;
    expect(bodyReceiptProblem({ ...r, locator: { ...r.locator, entry: path } })).toBeDefined();
    expect(bodyReceiptProblem({ ...r, summary: { ...r.summary, path } })).toBeDefined();
  });
  it('[REQ-470] 同名の原子的競合で一方だけ公開し異名は両方残す', () => fixture((root) => {
    const r = receiptFixture().receipt;
    expect(appendBodyReceipt(root, r)).toBe(true); const original = readFileSync(join(root, receiptPath(r)));
    expect(appendBodyReceipt(root, { ...r, future: 'other' })).toBe(false);
    expect(readFileSync(join(root, receiptPath(r)))).toEqual(original);
    const next = { ...r, retrieval: { ...r.retrieval, retrievedAt: '2026-11-06T01:02:04Z' } };
    expect(appendBodyReceipt(root, next)).toBe(true);
    expect(readdirSync(dirname(join(root, receiptPath(r))))).toHaveLength(2);
  }));
  it('[REQ-470] 64MiBちょうどの整形JSONを受理する', () => fixture((root) => {
    const r = { ...receiptFixture().receipt, padding: '' };
    r.padding = 'x'.repeat(JSON_LIMITS.maxFileBytes - Buffer.byteLength(JSON.stringify(r, null, 2) + '\n'));
    expect(appendBodyReceipt(root, r)).toBe(true);
    expect(readFileSync(join(root, receiptPath(r))).length).toBe(JSON_LIMITS.maxFileBytes);
  }));
  it('[REQ-470] 末尾改行込み64MiBを1byte超えたら公開前に拒否する', () => fixture((root) => {
    const r = { ...receiptFixture().receipt, padding: '' };
    r.padding = 'x'.repeat(JSON_LIMITS.maxFileBytes + 1 - Buffer.byteLength(JSON.stringify(r, null, 2) + '\n'));
    safeFailure(() => appendBodyReceipt(root, r)); expect(readdirSync(root)).toEqual([]);
  }));
  it.each(['write', 'fsync', 'link'])('[REQ-470] %s失敗でも不完全な最終JSONを残さず代替書込みしない', async (stage) => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    fixture((root) => {
      const fail = () => { throw new Error('sensitive input'); };
      if (stage === 'write') vi.mocked(writeFileSync).mockImplementationOnce((path) => { actual.writeFileSync(path, 'partial'); fail(); });
      if (stage === 'fsync') vi.mocked(fsyncSync).mockImplementationOnce(fail);
      if (stage === 'link') vi.mocked(linkSync).mockImplementationOnce(fail);
      const r = receiptFixture().receipt; safeFailure(() => appendBodyReceipt(root, r));
      expect(readdirSync(dirname(join(root, receiptPath(r))))).toEqual([]);
    });
  });
  it('[REQ-470] 保存先の親リンクをたどらない', () => fixture((root) => {
    const outside = join(root, 'outside'); mkdirSync(outside);
    symlinkSync(outside, join(root, '.loomake'), process.platform === 'win32' ? 'junction' : 'dir');
    safeFailure(() => appendBodyReceipt(root, receiptFixture().receipt)); expect(readdirSync(outside)).toEqual([]);
    expect(existsSync(join(root, '.loomake/evidence'))).toBe(false);
  }));
});

it('[REQ-470] 公開の直前に別writerが同名を取得した競合でも一方だけ残す', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  fixture((root) => {
    const r = receiptFixture().receipt, other = { ...r, future: 'concurrent' }; let second: boolean | undefined;
    vi.mocked(linkSync).mockImplementationOnce((source, target) => {
      second = appendBodyReceipt(root, other); actual.linkSync(source, target);
    });
    expect(appendBodyReceipt(root, r)).toBe(false); expect(second).toBe(true);
    expect(JSON.parse(readFileSync(join(root, receiptPath(r)), 'utf8')).future).toBe('concurrent');
    expect(readdirSync(dirname(join(root, receiptPath(r))))).toEqual([receiptPath(r).split('/').at(-1)]);
  });
});
