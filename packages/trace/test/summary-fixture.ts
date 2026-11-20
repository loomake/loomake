import type { EvidenceSummary } from '@loomake/core';

export function summaryFixture(): EvidenceSummary {
  return {
    schemaVersion: 2, change: 'sample', sha: 'a'.repeat(40), committedAt: '2026-11-05T00:00:00Z', recordedAt: '2026-11-05T00:00:01Z',
    verify: { schemaVersion: '2.0.0', change: 'sample', run: { status: 'completed', errors: [] }, scope: 'local', checks: [], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 0, pending: 0 }, decision: { required: false, reasons: [] } },
    summaryVersion: 1, role: 'development', ci: null,
    execution: { id: '00112233-4455-4677-8899-aabbccddeeff', origin: 'local', evaluator: { name: '@loomake/trace', version: '0.0.0' }, basisSha256: 'b'.repeat(64),
      environment: { node: 'v24', platform: 'linux', arch: 'x64' }, commands: { source: 'defaults', sha256: null, nameRefs: null }, producer: null,
      startedAt: '2026-11-05T00:00:00Z', finishedAt: '2026-11-05T00:00:01Z', verification: 'executed' },
    artifacts: [], request: null, observation: null,
    gaps: ['ci', 'execution.producer', 'execution.commands.sha256', 'execution.commands.nameRefs', 'request', 'observation', 'artifacts'].map((field) => ({ field, kind: 'unverified', reason: '未確認です' })),
  };
}
