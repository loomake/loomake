import { describe, expect, it } from 'vitest';
import { checkBodyReceipt, checkFixedSummary } from '../src/index.js';
import { hash, receiptFixture } from '../../../tests/fixtures/body-index/fixture.js';

describe('固定要約と索引の純粋な7項目照合', () => {
  it('[REQ-471] 本体あり・なしを区別し全入力を変更せず7項目を結び付ける', () => {
    const { receipt: r, summaryBytes: s, body } = receiptFixture();
    const before = [JSON.stringify(r), Buffer.from(s), Buffer.from(body)];
    expect(checkBodyReceipt(s, r).matches).toBe(true); expect(checkBodyReceipt(s, r, body).matches).toBe(true);
    expect(checkBodyReceipt(s, r).reason).toContain('未確認');
    expect([JSON.stringify(r), s, body]).toEqual(before);
  });
  it('[REQ-471] raw要約の1byte・サイズ・hash・版・UTF8・照合欄の不正を拒否する', () => {
    const { receipt: r, summaryBytes: s, summary } = receiptFixture();
    const changed = Buffer.from(s); changed[changed.length - 1] = 32;
    expect(checkBodyReceipt(changed, r).matches).toBe(false);
    for (const ref of [{ ...r.summary, bytes: r.summary.bytes + 1 }, { ...r.summary, sha256: 'f'.repeat(64) }]) expect(checkBodyReceipt(s, { ...r, summary: ref }).matches).toBe(false);
    for (const value of [{ ...summary, summaryVersion: 2 }, { ...summary, ci: null }, { ...summary, artifacts: {} }, { ...summary, sha: 1 }, null, []]) {
      const bytes = Buffer.from(JSON.stringify(value));
      expect(checkBodyReceipt(bytes, { ...r, summary: { ...r.summary, sha256: hash(bytes), bytes: bytes.length } }).matches).toBe(false);
    }
    for (const bytes of [Buffer.from([0x80]), Buffer.from([0xe3, 0x81]), Buffer.from('{')]) expect(checkBodyReceipt(bytes, { ...r, summary: { ...r.summary, sha256: hash(bytes), bytes: bytes.length } }).matches).toBe(false);
  });
  it('[REQ-471] workflow headが一致しても実checkoutが違えば拒否し文字を正規化しない', () => {
    const { receipt: r, summaryBytes: s } = receiptFixture();
    expect(checkBodyReceipt(s, { ...r, execution: { ...r.execution, workflowHeadSha: r.summary.sha, checkoutSha: 'f'.repeat(40) } }).matches).toBe(false);
    expect(checkBodyReceipt(s, { ...r, execution: { ...r.execution, checkoutSha: r.summary.sha.toUpperCase() } }).matches).toBe(false);
    expect(checkBodyReceipt(s, { ...r, summary: { ...r.summary, change: 'other' } }).matches).toBe(false);
  });
  it.each(['locator', 'execution', 'summary'] as const)('[REQ-471] %sのrunとattemptの不一致をそれぞれ拒否する', (section) => {
    const { receipt: r, summaryBytes: s } = receiptFixture();
    for (const key of ['runId', 'runAttempt']) {
      const part = section === 'summary' ? { ...r.summary, ci: { ...r.summary.ci, [key]: '2' } } : { ...r[section], [key]: '2' };
      expect(checkBodyReceipt(s, { ...r, [section]: part }).matches).toBe(false);
    }
  });
  it('[REQ-471] 一致する本体参照0件・複数とZIP digestの不一致を拒否する', () => {
    const { receipt: r, summaryBytes: s, summary } = receiptFixture();
    for (const artifacts of [[], [summary.artifacts[0], summary.artifacts[0]]]) {
      const bytes = Buffer.from(JSON.stringify({ ...summary, artifacts }));
      expect(checkBodyReceipt(bytes, { ...r, summary: { ...r.summary, sha256: hash(bytes), bytes: bytes.length } }).matches).toBe(false);
    }
    expect(checkBodyReceipt(s, { ...r, archive: { ...r.archive, apiDigest: 'sha256:' + 'd'.repeat(64) } }).matches).toBe(false);
    for (const body of [{ ...r.body, sha256: 'f'.repeat(64) }, { ...r.body, bytes: r.body.bytes + 1 }]) expect(checkBodyReceipt(s, { ...r, body }).matches).toBe(false);
  });
  it('[REQ-471] Uint8Arrayのoffsetとlengthを尊重し1byte違いを拒否する', () => {
    const { receipt: r, summaryBytes: s, body } = receiptFixture();
    const padded = Buffer.concat([Buffer.from('prefix'), body, Buffer.from('suffix')]);
    const view = new Uint8Array(padded.buffer, padded.byteOffset + 6, body.length);
    const paddedSummary = Buffer.concat([Buffer.from('x'), s, Buffer.from('y')]);
    const summaryView = new Uint8Array(paddedSummary.buffer, paddedSummary.byteOffset + 1, s.length);
    expect(checkBodyReceipt(summaryView, r, view).matches).toBe(true);
    expect(checkBodyReceipt(s, r, new Uint8Array(padded.buffer, padded.byteOffset + 5, body.length)).matches).toBe(false);
    expect(checkBodyReceipt(s, r, view.subarray(1)).matches).toBe(false);
    const changed = Buffer.from(body); changed[0] ^= 1; expect(checkBodyReceipt(s, r, changed).matches).toBe(false);
  });
  it('[REQ-471] receiptの自己hashを外部anchorの代わりにしない', () => {
    const { receipt: r, summaryBytes: s } = receiptFixture();
    const anchor = { summarySha256: hash(s), runId: r.summary.ci.runId, runAttempt: r.summary.ci.runAttempt, sha: r.summary.sha };
    expect(checkFixedSummary(s.toString('utf8'), anchor).result).toBe('PASS');
    const changed = Buffer.from(s.toString('utf8').replace('未確認です', '未検証です'));
    const updated = { ...r, summary: { ...r.summary, sha256: hash(changed), bytes: changed.length } };
    expect(checkBodyReceipt(changed, updated).matches).toBe(true);
    expect(checkFixedSummary(changed.toString('utf8'), anchor).result).toBe('FAIL');
  });
});
