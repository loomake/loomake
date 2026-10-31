import { describe, it, expect, expectTypeOf } from 'vitest';
import { EVIDENCE_V2_SCHEMA_VERSION as CORE_V2, LEGACY_EVIDENCE_SCHEMA_VERSION as CORE_LEGACY, type EvidenceV2 as CoreEvidenceV2, type LegacyEvidence as CoreLegacyEvidence } from '@loomake/core';
import { EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, type EvidenceV2, type LegacyEvidence } from '../src/index.js';

describe('trace の公開元の新旧の証拠の型', () => {
  it('[REQ-303] 従来の公開元から新旧の型と版を再エクスポートし、いまの書き出しの版は 1 のまま', () => {
    expectTypeOf<EvidenceV2>().toEqualTypeOf<CoreEvidenceV2>();
    expectTypeOf<LegacyEvidence>().toEqualTypeOf<CoreLegacyEvidence>();
    expect([LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION]).toEqual([CORE_LEGACY, CORE_V2]);
    expect([EVIDENCE_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION]).toEqual([1, 1, 2]);
  });
});
