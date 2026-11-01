import type { BaselinePin } from './baseline-record.js';

export const C001_VERIFICATION_FILE = 'openspec/changes/verify-v2-c001/verification.yaml';
export const C001_INITIAL_BASELINE_PIN: Readonly<BaselinePin> = Object.freeze({
  sha256: 'sha256:b0db0a585ca07991dec271e216f6cbb3a394022a6d0a5202720de6a5f615cac2',
  counts: Object.freeze({ rows: 47, owners: 49, scenarioMap: 158, currentNull: 7, moved: 8, renamed: 2,
    superseded: 0, open: 21, supersessions: 5, supersessionRefs: 5, supplements: 15, adoption: 97,
    testRefs: 565, uniqueTestRefs: 409, cross: 16 }),
});
