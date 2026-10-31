import { describe, it, expect, expectTypeOf } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  loadTraceSchemas, EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION,
  type Evidence, type EvidenceV2, type LegacyEvidence,
} from '../src/index.js';
import { evidenceValue, reportValue } from './fixtures/trace-contract-values.js';
import { abortedValue, ciValue, localValue } from './fixtures/verify-v2-values.js';

const { evidenceSchema, legacyEvidenceSchema, evidenceV2Schema, reportSchema } = await loadTraceSchemas();
const v2 = (verify: unknown = ciValue()) => ({ ...evidenceValue(), schemaVersion: 2, verify }) as EvidenceV2;

describe('Evidence 2 と履歴の Evidence 1', () => {
  it('[REQ-302] documents のある・ない Evidence 2 と履歴 Evidence 1 を、版ごとのスキーマで解析して入力を保持する', () => {
    const document = { path: 'trace.md', content: 'x', sha256: createHash('sha256').update('x').digest('hex') };
    for (const verify of [ciValue(), localValue(), abortedValue()]) {
      for (const value of [v2(verify), { ...v2(verify), documents: [document] }]) {
        const parsed = evidenceV2Schema.parse(value);
        expect(parsed).toEqual(value);
        expect(evidenceSchema.parse(value)).toEqual(value);
        expect('documents' in parsed).toBe('documents' in value);
      }
    }
    for (const value of [evidenceValue(), { ...evidenceValue(), documents: [document] }]) {
      expect(legacyEvidenceSchema.parse(value)).toEqual(value);
      expect(evidenceSchema.safeParse(value).success).toBe(false);
    }
    expect(reportSchema.parse(reportValue())).toEqual(reportValue());
  });

  it('[REQ-302] 履歴の構造は任意の number の版と文字列の日時・SHA を受け付け、Evidence 2 は版と埋め込みの verify で区別する', () => {
    for (const schemaVersion of [0, 1, 9.5]) expect(legacyEvidenceSchema.safeParse({ ...evidenceValue(), schemaVersion, sha: 'x', recordedAt: 'y' }).success).toBe(true);
    for (const bad of [{ ...evidenceValue(), schemaVersion: '1' }, { ...evidenceValue(), documents: null }, { ...evidenceValue(), sha: 1 }]) {
      expect(legacyEvidenceSchema.safeParse(bad).success).toBe(false);
    }
    expect(evidenceV2Schema.safeParse({ ...v2(), schemaVersion: 1 }).success).toBe(false);
    expect(evidenceV2Schema.safeParse({ ...v2(), verify: evidenceValue().verify }).success).toBe(false);
    expect(legacyEvidenceSchema.safeParse(v2()).success).toBe(false);
    expect(evidenceV2Schema.safeParse({ ...v2(), verify: { ...ciValue(), verdict: undefined } }).success).toBe(false);
  });

  it('[REQ-302][REQ-307] 各階層の未知のフィールドを保持する', () => {
    const value = { ...v2({ ...ciValue(), extra: 1, checks: [{ ...ciValue().checks[0], note: 'n' }], run: { status: 'completed', errors: [], host: 'h' } }), extra: { a: [1] } };
    expect(evidenceV2Schema.parse(value)).toEqual(value);
    const legacy = { ...evidenceValue(), extra: true, verify: { ...evidenceValue().verify, results: [{ check: 'x', status: 'pass', detail: '', hint: 'h' }] } };
    expect(legacyEvidenceSchema.parse(legacy)).toEqual(legacy);
  });

  it('[REQ-303][REQ-305][REQ-315] 版の定数と型は core から公開し、いまの書き出しは Evidence 2・Report 2', () => {
    expect([EVIDENCE_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION, REPORT_SCHEMA_VERSION]).toEqual([2, 1, 2, 2]);
    expectTypeOf<LegacyEvidence>().toEqualTypeOf<z.output<typeof legacyEvidenceSchema>>();
    expectTypeOf<EvidenceV2>().toEqualTypeOf<z.output<typeof evidenceV2Schema>>();
    expectTypeOf<Evidence>().toEqualTypeOf<z.output<typeof evidenceSchema>>();
    expectTypeOf<EvidenceV2['schemaVersion']>().toEqualTypeOf<2>();
  });

  it('[REQ-304] 公開した 1.0.0 のスキーマ履歴はバイト単位で変わらない', () => {
    const file = join(import.meta.dirname, 'fixtures', 'schema-history', '1.0.0.json');
    // Windows の checkout では改行が CRLF になりうるので、改行をそろえてから比べる
    expect(createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex')).toBe(HISTORY_1_0_0_SHA256);
  });
});

// main f26823f の packages/core/test/fixtures/schema-history/1.0.0.json の SHA-256
const HISTORY_1_0_0_SHA256 = 'bd73807efc4989c56b6f122233a4796f4c83cad8dc1261f07e20be96e7bfaa0a';
