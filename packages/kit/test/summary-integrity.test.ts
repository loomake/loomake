import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { checkFixedSummary, sha256Hex } from '@loomake/kit';
import type { FixedSummaryCheck, FixedSummaryProblemCode, SummaryTrustAnchor } from '@loomake/kit';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const prefix = 'packages/kit/test/fixtures/summary-integrity/';
const fixture = (name: string) => execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', `HEAD:${prefix}${name}`],
  { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

let original: string, selfHash: string, releaseText: string, anchor: Readonly<SummaryTrustAnchor>;
beforeAll(() => {
  original = fixture('summary.json');
  selfHash = fixture('summary.json.sha256');
  releaseText = fixture('release-record.json');
  const release = JSON.parse(releaseText) as {
    summaries: { sha256: string }[];
    ci: { runId: string; runAttempt: string; sha: string };
  };
  anchor = Object.freeze({ summarySha256: release.summaries[0].sha256, ...release.ci });
});

function reject(value: FixedSummaryCheck, codes: FixedSummaryProblemCode[]): void {
  expect(value).toMatchObject({ reusable: false, result: 'FAIL', returnToHuman: true });
  expect(value.reasons.map(reason => reason.code)).toEqual(codes);
  expect(value.reasons.length).toBeGreaterThan(0);
  for (const reason of value.reasons) expect(reason.message).toMatch(/[ぁ-んァ-ヶ一-龠]/);
}

describe('外部に固定した値で要約の改変を検出する（A16）', () => {
  it('[REQ-443] 固定リリース記録の値と同じ原本は公開APIで再利用できる', () => {
    expectTypeOf(checkFixedSummary).parameters.toEqualTypeOf<[unknown, unknown]>();
    expectTypeOf(checkFixedSummary).returns.toEqualTypeOf<FixedSummaryCheck>();
    expect(selfHash.trim()).toBe(anchor.summarySha256);
    expect(sha256Hex(original)).toBe(anchor.summarySha256);
    expect(Object.isFrozen(anchor)).toBe(true);
    expect(checkFixedSummary(original, anchor)).toEqual({ reusable: true, result: 'PASS', returnToHuman: false, reasons: [] });
  });

  it('[REQ-443] 要約の1文字だけの改変を拒否する', () => {
    const copy = original.replace('原本', '改本');
    expect(copy).not.toBe(original);
    expect(copy.length).toBe(original.length);
    reject(checkFixedSummary(copy, anchor), ['SUMMARY_HASH_MISMATCH']);
  });

  it('[REQ-443] 要約と付随する自己ハッシュを同時に改変しても固定値で拒否する', () => {
    const changed = original.replace('原本', '改本');
    const changedSelfHash = sha256Hex(changed);
    expect(changedSelfHash).toBe(sha256Hex(changed));
    expect(changedSelfHash).not.toBe(anchor.summarySha256);
    const attackerCopy = { summary: changed, selfHash: changedSelfHash };
    reject(checkFixedSummary(attackerCopy.summary, anchor), ['SUMMARY_HASH_MISMATCH']);

    const withEmbeddedHash = JSON.stringify({ ...JSON.parse(changed), selfHash: changedSelfHash });
    reject(checkFixedSummary(withEmbeddedHash, anchor), ['SUMMARY_HASH_MISMATCH']);
  });

  it('[REQ-443] 本文の改行と空白を正規化せずに照合する', () => {
    for (const copy of [original.replaceAll('\n', '\r\n'), `${original} `]) {
      reject(checkFixedSummary(copy, anchor), ['SUMMARY_HASH_MISMATCH']);
    }
  });

  it.each([
    ['high-start', '\uD800'], ['high-end', '\uDBFF'],
    ['low-start', '\uDC00'], ['low-end', '\uDFFF'],
  ])('[REQ-443][REQ-445] %sの孤立サロゲートは同じUTF8ハッシュでも拒否する', (_label, surrogate) => {
    const wellFormed = original.replace('原本', '\uFFFD');
    const trusted = Object.freeze({ ...anchor, summarySha256: sha256Hex(wellFormed) });
    const changed = wellFormed.replace('\uFFFD', surrogate);
    expect(changed).not.toBe(wellFormed);
    expect(sha256Hex(changed)).toBe(trusted.summarySha256);
    expect(checkFixedSummary(wellFormed, trusted)).toEqual({ reusable: true, result: 'PASS', returnToHuman: false, reasons: [] });
    reject(checkFixedSummary(changed, trusted), ['SUMMARY_UNREADABLE']);
  });

  it('[REQ-443][REQ-445] 正しいサロゲートペアを正規化せず照合できる', () => {
    const wellFormed = original.replace('原本', '\uD83D\uDE00');
    const trusted = Object.freeze({ ...anchor, summarySha256: sha256Hex(wellFormed) });
    expect(checkFixedSummary(wellFormed, trusted)).toEqual({ reusable: true, result: 'PASS', returnToHuman: false, reasons: [] });
  });

  it('[REQ-443][REQ-444] 信頼値と要約が対応すれば64桁のSHAも完全一致で扱う', () => {
    const sha = 'a1'.repeat(32);
    const text = JSON.stringify({ sha, ci: { runId: anchor.runId, runAttempt: anchor.runAttempt } });
    expect(checkFixedSummary(text, { ...anchor, sha, summarySha256: sha256Hex(text) }).result).toBe('PASS');
  });

  it.each([
    ['runId', '42000000001', 'RUN_ID_MISMATCH'],
    ['runAttempt', '2', 'RUN_ATTEMPT_MISMATCH'],
    ['sha', 'f'.repeat(40), 'TARGET_SHA_MISMATCH'],
  ] as const)('[REQ-444] %sだけが異なる要約を項目別に拒否する', (field, value, code) => {
    const copy = JSON.parse(original);
    if (field === 'sha') copy.sha = value;
    else copy.ci[field] = value;
    const text = JSON.stringify(copy);
    reject(checkFixedSummary(text, anchor), ['SUMMARY_HASH_MISMATCH', code]);
  });

  it('[REQ-444] ハッシュが一致しても独立したCI識別子の不一致を拒否する', () => {
    const mismatched = { ...anchor, runId: '42000000001', runAttempt: '2', sha: 'f'.repeat(40) };
    reject(checkFixedSummary(original, mismatched), ['RUN_ID_MISMATCH', 'RUN_ATTEMPT_MISMATCH', 'TARGET_SHA_MISMATCH']);
  });

  it('[REQ-444] 実行IDの前後空白とSHAの大文字を同一視しない', () => {
    const copy = JSON.parse(original);
    copy.ci.runId = ` ${anchor.runId} `;
    copy.sha = anchor.sha.toUpperCase();
    reject(checkFixedSummary(JSON.stringify(copy), anchor), ['SUMMARY_HASH_MISMATCH', 'RUN_ID_MISMATCH', 'TARGET_SHA_MISMATCH']);
  });

  it('[REQ-443][REQ-444][REQ-445] 全ケースのfixtureと入力の信頼値を変更しない', () => {
    const before = JSON.stringify(anchor);
    checkFixedSummary(original.replace('原本', '改本'), anchor);
    checkFixedSummary(null, anchor);
    expect(JSON.stringify(anchor)).toBe(before);
    expect(fixture('summary.json')).toBe(original);
    expect(fixture('summary.json.sha256')).toBe(selfHash);
    expect(fixture('release-record.json')).toBe(releaseText);
  });

  it('[REQ-445] 信頼値の不足や形式の誤りは例外にせず拒否する', () => {
    const invalid: unknown[] = [undefined, null, [], 'anchor', {},
      { ...anchor, summarySha256: undefined }, { ...anchor, summarySha256: anchor.summarySha256.toUpperCase() },
      { ...anchor, runId: '' }, { ...anchor, runId: 42000000000 },
      { ...anchor, runAttempt: '0' }, { ...anchor, runAttempt: '01' }, { ...anchor, runAttempt: 1 },
      { ...anchor, sha: anchor.sha.slice(0, 7) }, { ...anchor, sha: anchor.sha.toUpperCase() }];
    for (const value of invalid) reject(checkFixedSummary(original, value), ['TRUST_MISSING']);
  });

  it('[REQ-445] 固定値の数値文字列とハッシュに末尾改行を受け付けない', () => {
    for (const field of ['summarySha256', 'runAttempt', 'sha'] as const) {
      for (const suffix of ['\n', '\r', '\u2028', '\u2029']) {
        reject(checkFixedSummary(original, { ...anchor, [field]: anchor[field] + suffix }), ['TRUST_MISSING']);
      }
    }
  });

  it('[REQ-445] 信頼値が読取時に例外を投げても拒否を返す', () => {
    const value = { get summarySha256(): string { throw new Error('fixture'); } };
    reject(checkFixedSummary(original, value), ['TRUST_MISSING']);
  });

  it('[REQ-445] 文字列でない要約を例外にせず拒否する', () => {
    for (const value of [undefined, null, {}, [], 1, false]) {
      reject(checkFixedSummary(value, anchor), ['SUMMARY_UNREADABLE']);
    }
  });

  it('[REQ-445] 壊れたJSONと照合する欄の欠落を拒否する', () => {
    for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ sha: anchor.sha }),
      JSON.stringify({ sha: anchor.sha, ci: { runId: anchor.runId, runAttempt: '01' } }),
      JSON.stringify({ sha: anchor.sha, ci: { runId: '', runAttempt: '1' } }),
      JSON.stringify({ sha: anchor.sha.slice(0, 7), ci: { runId: anchor.runId, runAttempt: '1' } })]) {
      reject(checkFixedSummary(text, anchor), ['SUMMARY_HASH_MISMATCH', 'SUMMARY_UNREADABLE']);
    }
  });
});
