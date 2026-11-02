import type { BaselinePin } from './baseline-record.js';

export const C001_VERIFICATION_FILE = 'openspec/changes/verify-v2-c001/verification.yaml';
export const C001_INITIAL_BASELINE_PIN: Readonly<BaselinePin> = Object.freeze({
  sha256: 'sha256:b0db0a585ca07991dec271e216f6cbb3a394022a6d0a5202720de6a5f615cac2',
  counts: Object.freeze({ rows: 47, owners: 49, scenarioMap: 158, currentNull: 7, moved: 8, renamed: 2,
    superseded: 0, open: 21, supersessions: 5, supersessionRefs: 5, supplements: 15, adoption: 97,
    testRefs: 565, uniqueTestRefs: 409, cross: 16 }),
});

export const C001_OWNER_SOURCE_EXCEPTIONS = Object.freeze([Object.freeze({
  key: 'run/modified/REQ-100', kind: 'main-unchanged', file: 'openspec/specs/run/spec.md',
  name: '変更を残さない完了ゲートの直し',
  block: 'sha256:7d3f4430865f8e453203eae34858d2f104da2fe33809949b71c755203c79c3e6',
  scenarios: Object.freeze(['直しで何も変えない', '直しで変更が要らないと合図する', '直しの指示', '直しで止まるときの記録の場所']),
  sources: Object.freeze(['REQ-331']),
  // 採用済み判断のラベル。trace行の実在・主体・APIは未検証。
  decision: Object.freeze({ change: 'trusted-original-baseline', id: 'Q-S1-14' }),
})] as const);
