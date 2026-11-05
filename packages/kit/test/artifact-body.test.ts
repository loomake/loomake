import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkArtifactBody, artifactRetention } from '../src/index.js';
const ref = (bytes: Uint8Array) => ({ sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength });
const lifetime = (createdAt: string, expiresAt: string | null) => ({ location: { createdAt }, expiresAt });

describe('本体と実保持期間の照合', () => {
  it.each([Buffer.from('日本語'), Buffer.from([0xef, 0xbb, 0xbf, 0x61]), Buffer.from('\uFFFD'), Buffer.from([0x80]), Buffer.from([0xe3, 0x81]), Buffer.alloc(0)])('[REQ-463] raw bytesを直接照合しUnicode再encodeや変更をしない', (bytes) => {
    const before = Buffer.from(bytes); expect(checkArtifactBody(ref(bytes), bytes).matches).toBe(true); expect(bytes).toEqual(before);
    expect(checkArtifactBody({ ...ref(bytes), bytes: bytes.length + 1 }, bytes).matches).toBe(false);
    expect(checkArtifactBody({ ...ref(bytes), sha256: '0'.repeat(64) }, bytes).matches).toBe(false);
  });
  it('[REQ-463] subarrayのoffset/lengthだけを照合し元bufferの別領域を含めない', () => {
    const bytes = Buffer.from([1, 2, 3, 4]); const view = bytes.subarray(1, 3);
    expect(checkArtifactBody(ref(Buffer.from([2, 3])), view).matches).toBe(true);
    expect(checkArtifactBody(ref(bytes), view).matches).toBe(false);
    expect(bytes).toEqual(Buffer.from([1, 2, 3, 4]));
  });
  it('[REQ-463] 不正な型・非safe件数・1文字差を日本語の不一致として返す', () => {
    for (const bad of [null, {}, { sha256: 'a', bytes: 1 }, { sha256: 'a'.repeat(64), bytes: -1 }, { sha256: 'a'.repeat(64), bytes: Number.MAX_SAFE_INTEGER + 1 }]) expect(checkArtifactBody(bad, Buffer.from('a'))).toMatchObject({ matches: false, reason: expect.any(String) });
    expect(checkArtifactBody(ref(Buffer.from('あ')), Buffer.from('い')).matches).toBe(false);
    expect(checkArtifactBody(ref(Buffer.from('a')), 'a' as unknown as Uint8Array).matches).toBe(false);
  });
  it('[REQ-463] desired90dと実7dを区別し、失効しても当時の充足を変えない', () => {
    const short = lifetime('2026-01-01T00:00:00Z', '2026-01-08T00:00:00Z'); const before = structuredClone(short);
    expect(artifactRetention(short, '90d', '2026-01-07T00:00:00Z')).toMatchObject({ retention: 'insufficient', current: 'available' });
    expect(artifactRetention(short, '7d', '2026-01-08T00:00:00Z')).toMatchObject({ retention: 'satisfied', current: 'expired' });
    expect(artifactRetention(short, '1w', new Date('2027-01-01T00:00:00Z'))).toMatchObject({ retention: 'satisfied', current: 'expired' });
    expect(short).toEqual(before);
  });
  it('[REQ-463] UTC閏日の年加算を移動先月末に丸め境界ちょうどを含める', () => {
    expect(artifactRetention(lifetime('2024-02-29T12:00:00Z', '2025-02-28T12:00:00Z'), '1y', '2025-02-28T11:59:59.999Z')).toMatchObject({ retention: 'satisfied', current: 'available' });
    expect(artifactRetention(lifetime('2024-02-29T12:00:00Z', '2025-02-28T11:59:59.999Z'), '1y', '2025-02-28T12:00:00Z')).toMatchObject({ retention: 'insufficient', current: 'expired' });
    expect(artifactRetention(lifetime('2024-02-29T00:00:00Z', '2028-02-29T00:00:00Z'), '4y', '2027-01-01T00:00:00Z').retention).toBe('satisfied');
  });
  it('[REQ-463] 不足・不正な事実をunverifiedとし方針から実期限を作らない', () => {
    for (const input of [null, {}, lifetime('2026-02-30T00:00:00Z', null), lifetime('bad', 'bad')]) expect(artifactRetention(input, '90d', 'bad')).toMatchObject({ retention: 'unverified', current: 'unverified' });
    const input = lifetime('2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z');
    for (const policy of ['0d', '-1d', '90', '9999999999999999999999y', undefined]) expect(artifactRetention(input, policy, '2026-01-02T00:00:00Z').retention).toBe('unverified');
    expect(artifactRetention(input, '90d', new Date('invalid')).current).toBe('unverified');
  });
});
