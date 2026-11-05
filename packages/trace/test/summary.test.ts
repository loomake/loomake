import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { summaryProblem } from '../src/summary.js';
import { evidenceProblem } from '../src/evidence.js';
import { serializeEvidence } from '../src/serialization.js';
import { summaryFixture } from './summary-fixture.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
describe('要約拡張の同期意味検証', () => {
  it('[REQ-460][REQ-461] 新形式を同期で読み書きし未知欄とown __proto__を保持する', () => {
    const e = summaryFixture(); e.future = { nullable: null };
    Object.defineProperty(e, '__proto__', { value: { future: true }, enumerable: true });
    expect(evidenceProblem(e, 'sample')).toBeUndefined();
    const text = serializeEvidence(e); expect(typeof text).toBe('string');
    const parsed = JSON.parse(text); expect(parsed.future).toEqual({ nullable: null });
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true);
    expect(parsed.__proto__).toEqual({ future: true });
    expect(summaryProblem(parsed)).toBeUndefined();
  });
  it('[REQ-460] 目印のない旧Evidence2と未知storageを解釈せず、旧Evidence1も閲覧できる', () => {
    const e = summaryFixture();
    const base = { schemaVersion: e.schemaVersion, change: e.change, sha: e.sha, committedAt: e.committedAt, recordedAt: e.recordedAt, verify: e.verify, storage: { future: null } };
    expect(evidenceProblem(base, 'sample')).toBeUndefined();
    expect(JSON.parse(serializeEvidence(base)).storage).toEqual({ future: null });
    expect(evidenceProblem({ ...base, schemaVersion: 1, verify: { schemaVersion: '1.0.0', mode: 'done', change: 'sample', ok: true, results: [] } }, 'sample')).toBeUndefined();
  });
  it.each([undefined, null, 2, '1', false])('[REQ-460] 自身の目印が不正なら拒否する: %s', (v) => {
    expect(evidenceProblem({ ...summaryFixture(), summaryVersion: v }, 'sample')).toContain('要約拡張の版');
  });
  it('[REQ-460] Evidence1に拡張目印を混ぜることを拒否する', () => {
    expect(evidenceProblem({ ...summaryFixture(), schemaVersion: 1, verify: { schemaVersion: '1.0.0', mode: 'done', change: 'sample', ok: true, results: [] } }, 'sample')).toContain('要約拡張');
  });
  it('[REQ-461] 既知null欄のgap欠落・重複・非nullとの矛盾を拒否し未知のnullable欄を保持する', () => {
    const e = summaryFixture();
    expect(summaryProblem({ ...e, gaps: e.gaps.slice(1) })).toContain('null欄');
    expect(summaryProblem({ ...e, gaps: [...e.gaps, e.gaps[0]] })).toContain('重複');
    expect(summaryProblem({ ...e, ci: { runId: '123', runAttempt: 1, source: 'environment' } })).toContain('値のある欄');
    expect(summaryProblem({ ...e, future: null, gaps: [...e.gaps, { field: 'future', kind: 'unverified', reason: '将来の欄' }] })).toBeUndefined();
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'])('[REQ-461] runAttemptは正のsafe整数だけ: %s', (runAttempt) => {
    const e = summaryFixture(); expect(summaryProblem({ ...e, ci: { runId: '123', runAttempt, source: 'environment' }, gaps: e.gaps.filter((g) => g.field !== 'ci') })).toContain('CI識別');
  });
  it('[REQ-461] 既定値のnullと既知configハッシュ・確認済み名の配列形を区別する', () => {
    const e = summaryFixture(); e.execution.commands = { source: 'loomake.config.json', sha256: 'c'.repeat(64), nameRefs: [{ nameSha256: digest('lint'), knownName: 'lint' }] };
    e.gaps = e.gaps.filter((g) => !g.field.startsWith('execution.commands.'));
    expect(summaryProblem(e)).toBeUndefined();
    expect(summaryProblem({ ...e, execution: { ...e.execution, commands: { ...e.execution.commands, sha256: null } } })).toBeDefined();
    e.execution.commands.nameRefs = [{ nameSha256: digest('other'), knownName: 'lint' }];
    expect(summaryProblem(e)).toContain('コマンド名');
  });
  it('[REQ-460][REQ-462] releaseは取得照合参照を要求し、roleを承認には使わない', () => {
    const e = summaryFixture(); const a = { kind: 'test-report' as const, path: 'report.json', sha256: 'd'.repeat(64), bytes: 1,
      sameRun: { status: 'unverified' as const, reason: '生成元未確認' }, counts: null, location: null,
      availability: 'not-uploaded' as const, expiresAt: null, retrieval: null };
    e.artifacts = [a]; e.gaps = e.gaps.filter((g) => g.field !== 'artifacts');
    for (const key of ['counts', 'location', 'expiresAt', 'retrieval']) e.gaps.push({ field: `artifacts[0].${key}`, kind: 'unverified', reason: '未確認' });
    expect(summaryProblem(e)).toBeUndefined();
    expect(summaryProblem({ ...e, role: 'release' })).toContain('固定用');
    const fetched = { ...a, availability: 'retrieved', location: { type: 'github-actions-artifact', repository: 'owner/repo', runId: '1', runAttempt: 1, artifactName: 'test', entry: 'report.json', createdAt: '2026-11-05T00:00:00Z' }, retrieval: { checkedAt: '2026-11-05T00:00:01Z', access: 'project-members', sha256Matched: true } };
    expect(summaryProblem({ ...e, role: 'release', artifacts: [fetched], gaps: e.gaps.filter((g) => !['artifacts[0].location', 'artifacts[0].retrieval'].includes(g.field)) })).toBeUndefined();
  });
});
