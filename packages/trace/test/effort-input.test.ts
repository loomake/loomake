import { expect, it } from 'vitest';
import { parseDuration, parseEffortOption, parseCost } from '../src/index.js';
import { effortProblem, serializeEffort } from '../src/effort-input.js';
const base = { schemaVersion: 1, kind: 'loomake-effort', change: 'add-x', sha: 'a'.repeat(40), recordedAt: '2026-11-06T00:00:00.000Z', totalMinutes: 0 };
it('[REQ-466] 時間を整数分へ正確に変換し数値と字句の境界を検査する', () => {
  for (const [text, value] of [['0m', 0], ['0h', 0], ['100000m', 100000], ['1.5h', 90], ['0.05h', 3]] as const) expect(parseDuration(text)).toBe(value);
  for (const text of ['', '01m', '01h', '100001m', '999999m', '0.01h', '9999h', '1e2m', '-1m', '+1m', '１m', ' 9m', '9m ', '9', 'NaN', 'Infinity', '1.000h', '1分']) expect(() => parseDuration(text), text).toThrow();
});
it('[REQ-466] 総計と区分・内数を分け、欠測を0で補わない', () => {
  expect(parseEffortOption('90m')).toEqual({ totalMinutes: 90 });
  expect(parseEffortOption('review=0m')).toEqual({ minutes: { review: 0 } });
  expect(parseEffortOption('instruct=30m,review=20m,rework=0m,run=10m,wait=5m,search=8m')).toEqual({ minutes: { instruct: 30, review: 20, rework: 0, run: 10, wait: 5, search: 8 } });
  for (const text of ['review=1m,review=2m', 'other=1m', '1m,review=1m', 'search=0m', 'review=1m,search=2m', 'review=1m,', 'review=1m=2m']) expect(() => parseEffortOption(text), text).toThrow();
});
it('[REQ-466] USDのcentsとtokensを正確に分け、不正費用を拒否する', () => {
  expect(parseCost('actual-usd:1.25,estimated-usd:0.50,tokens:12000')).toEqual([{ kind: 'actual-usd', cents: 125 }, { kind: 'estimated-usd', cents: 50 }, { kind: 'tokens', count: 12000 }]);
  expect(parseCost('actual-usd:0,tokens:9007199254740991')).toEqual([{ kind: 'actual-usd', cents: 0 }, { kind: 'tokens', count: Number.MAX_SAFE_INTEGER }]);
  expect(parseCost('actual-usd:90071992547409.91')[0]).toEqual({ kind: 'actual-usd', cents: Number.MAX_SAFE_INTEGER });
  for (const text of ['', 'actual-usd:1,actual-usd:2', 'monthly:1', 'actual-usd:-1', 'actual-usd:1e2', 'actual-usd:1.001', 'actual-usd:90071992547409.92', 'tokens:1.0', 'tokens:9007199254740992', 'tokens: 1', 'tokens:1,']) expect(() => parseCost(text), text).toThrow();
});
it('[REQ-466] 最終置換してから構造・Unicode文字・UTF-8 bytesを検査する', () => {
  const token = 'sk-' + 'a'.repeat(20);
  const value = { ...base, note: token };
  expect(serializeEffort(value)).toContain('"note": "***"');
  expect(value.note).toBe(token);
  expect(serializeEffort({ ...base, note: '😀'.repeat(500) })).toContain('😀');
  for (const extra of [{ note: '😀'.repeat(501) }, { note: 'line\nnext' }, { note: '\u0000' }, { note: '\u2028' }, { minutes: { review: 1 } }, { decisions: NaN }, { attempts: -1 }, { cost: [{ kind: 'tokens', count: Infinity }] }, { extra: true }]) expect(effortProblem({ ...base, ...extra })).not.toBeNull();
  expect(effortProblem(base)).toBeNull();
  const size = Buffer.byteLength(serializeEffort(base));
  expect(serializeEffort(base, size)).toBe(JSON.stringify(base, null, 2) + '\n');
  expect(() => serializeEffort(base, size - 1)).toThrow('上限');
  expect(() => serializeEffort({ ...base, change: 'x'.repeat(65536) })).toThrow('上限');
  // change-id の長さには既存契約上の上限がないため、正規の大きい値で64KiB境界を確かめる。
  const prefix = { ...base, change: 'x' };
  const fixed = Buffer.byteLength(serializeEffort(prefix)) - 1;
  expect(Buffer.byteLength(serializeEffort({ ...prefix, change: 'x'.repeat(65536 - fixed) }))).toBe(65536);
  expect(() => serializeEffort({ ...prefix, change: 'x'.repeat(65537 - fixed) })).toThrow('上限');
});
