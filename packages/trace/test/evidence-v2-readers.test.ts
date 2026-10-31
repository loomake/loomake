import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReport, evidenceProblem, runRecord } from '@loomake/trace';
import { makeRepo, CHANGE } from '../../runner/test/helpers.js';

vi.setConfig({ testTimeout: 60_000 });

const checks = [{ id: 'command: test', result: 'PASS', reason: '', evidence: [] }];
const summary = { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1 };
const ciPass = { schemaVersion: '2.0.0', change: CHANGE, run: { status: 'completed', errors: [] }, scope: 'ci', checks, summary, decision: { required: false, reasons: [] }, verdict: 'PASS', coverage: { 'REQ-012': ['tests/x.test.ts'] } };
// local は verdict を持たない
const localDone: Record<string, unknown> = { ...ciPass, scope: 'local', summary: { ...summary, pending: 0 } };
delete localDone.verdict;

// いまの書き出し（Evidence 1）で記録し、その記録を Evidence 2 に置き換えて読む
function withRecorded(fn: (root: string, evidence: Record<string, unknown>, file: string) => void) {
  const repo = makeRepo({ tasks: '## 1. 実装\n- [x] 1.1 完了（REQ-012）\n' });
  try {
    repo.write('impl.txt', '実装\n'); repo.git('add', 'impl.txt'); repo.git('commit', '-q', '-m', 'implementation');
    expect(runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} })).toBe(0);
    const dir = join(repo.root, '.loomake/evidence', CHANGE);
    const file = join(dir, readdirSync(dir)[0]);
    fn(repo.root, JSON.parse(readFileSync(file, 'utf8')), file);
  } finally { repo.cleanup(); }
}

describe('Evidence 2 を読む', () => {
  it('正しい Evidence 2 を受け付け、版と埋め込みの verify の版の混在と、状態別の必須欄の欠けを拒否する', () => {
    withRecorded((_root, evidence) => {
      // 書き出しを Evidence 2 に切り替えた（verify-v2-wiring、REQ-315）
      expect(evidence.schemaVersion).toBe(2);
      const legacyVerify = { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [] };
      const v2 = { ...evidence, schemaVersion: 2, verify: ciPass };
      expect(evidenceProblem(v2, CHANGE)).toBeUndefined();
      expect(evidenceProblem({ ...v2, verify: localDone }, CHANGE)).toBeUndefined();
      expect(evidenceProblem({ ...v2, verify: legacyVerify }, CHANGE)).toEqual(expect.any(String));
      expect(evidenceProblem({ ...evidence, schemaVersion: 1, verify: ciPass }, CHANGE)).toEqual(expect.any(String));
      for (const verify of [{ ...ciPass, checks: undefined }, { ...ciPass, run: { status: 'partial', errors: [] } }, { ...localDone, verdict: 'PASS' }, { schemaVersion: '2.0.0', change: CHANGE, run: { status: 'aborted', errors: [] } }]) {
        expect(evidenceProblem({ ...v2, verify }, CHANGE), JSON.stringify(verify)).toEqual(expect.any(String));
      }
    });
  });

  it('report は Evidence 2 の ci・PASS を合格と、local の完了を合格でないと表示する', () => {
    withRecorded((root, evidence, file) => {
      writeFileSync(file, JSON.stringify({ ...evidence, schemaVersion: 2, verify: ciPass }));
      expect(buildReport(root, CHANGE)?.evidence.ok).toBe(true);
      writeFileSync(file, JSON.stringify({ ...evidence, schemaVersion: 2, verify: localDone }));
      const report = buildReport(root, CHANGE)!;
      expect(report.evidence.ok).toBe(false);
      expect(report.warnings[0]).toContain('scope: local');
    });
  });
});
