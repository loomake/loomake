import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { UsageError } from '@loomake/kit';
import { serializeEvidence } from '../src/serialization.js';
import type { Evidence } from '../src/record.js';
import { traceMd } from '../../kit/test/project.js';

function value(): Evidence {
  const content = traceMd() + '\nあいう\n';
  return { schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), recordedAt: '2026-10-24T00:00:00Z', committedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok: true, results: [], coverage: {} }, documents: [{ path: 'trace.md', content, sha256: createHash('sha256').update(content).digest('hex') }] };
}

describe('保存する証拠の形式とサイズ', () => {
  it('[REQ-174] 検証したJSONを末尾改行とともに返す', () => {
    const input = value();
    const text = serializeEvidence(input);
    expect(JSON.parse(text)).toEqual(input);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('[REQ-174] 整形と改行を含むUTF-8の上限ちょうどを認める', () => {
    const input = value();
    const expected = JSON.stringify(input, null, 2) + '\n';
    const size = Buffer.byteLength(expected);
    expect(serializeEvidence(input, size)).toBe(expected);
    expect(() => serializeEvidence(input, size - 1)).toThrow(/証拠.*上限/);
    expect(size).toBeGreaterThan(expected.length);
    expect(() => serializeEvidence(input, expected.length)).toThrow(UsageError);
  });

  it.each(['sha', 'mode', 'hash', 'version'])('[REQ-174] %sが不正な証拠を生成しない', (kind) => {
    const input = value();
    if (kind === 'sha') input.sha = 'wrong';
    if (kind === 'mode') input.verify.mode = 'quality';
    if (kind === 'hash') input.documents![0].sha256 = 'wrong';
    if (kind === 'version') input.schemaVersion = 0;
    expect(() => serializeEvidence(input)).toThrow(UsageError);
  });

  it('[REQ-174] toJSONによって不正な形に変わる証拠も生成しない', () => {
    const input = value();
    (input.verify as typeof input.verify & { toJSON?: () => unknown }).toJSON = () => ({});
    expect(() => serializeEvidence(input)).toThrow(UsageError);
  });

  it('[REQ-174] JSON文字列を返さない変換もUsageErrorにする', () => {
    const input = value() as Evidence & { toJSON?: () => undefined };
    input.toJSON = () => undefined;
    expect(() => serializeEvidence(input)).toThrow(UsageError);
  });

  it('[REQ-174] JSONに変換できない値もUsageErrorにする', () => {
    const input = value() as Evidence & { self?: unknown };
    input.self = input;
    expect(() => serializeEvidence(input)).toThrow(/JSON.*変換/);
  });

  it.each([0, -1, 1.5, Infinity])('[REQ-174] 不正なサイズ上限 %s を認めない', (limit) => {
    expect(() => serializeEvidence(value(), limit)).toThrow(UsageError);
  });
});
