import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTraceSchemas } from '@loomake/core';
import * as kit from '@loomake/kit';
import { buildReport, evidenceProblem, runRecord, runReport } from '@loomake/trace';
import { HISTORY_WARNING } from '../src/projection.js';
import { makeRepo, CHANGE } from '../../runner/test/helpers.js';

vi.setConfig({ testTimeout: 60_000 });

const { evidenceSchema } = await loadTraceSchemas();

function doneRepo() {
  const repo = makeRepo({ tasks: '## 1. 実装\n- [x] 1.1 完了（REQ-012）\n' });
  repo.write('impl.txt', '実装\n'); repo.git('add', 'impl.txt'); repo.git('commit', '-q', '-m', 'implementation');
  return repo;
}
const dir = (root: string) => join(root, '.loomake/evidence', CHANGE);
const files = (root: string) => readdirSync(dir(root)).sort();
const read = (root: string, name: string) => JSON.parse(readFileSync(join(dir(root), name), 'utf8'));

describe('Evidence 2 の記録', () => {
  it('[REQ-315] scope を省くと ci で verify を実行し、2.0.0 の結果をそのまま Evidence 2 に保存して verify と同じ終了コードを返す', () => {
    const repo = doneRepo();
    try {
      const out: string[] = [];
      let seen: unknown;
      const code = runRecord({ root: repo.root, changeId: CHANGE, stdout: (t) => out.push(t), onVerify: (r) => { seen = r; } });
      expect(code).toBe(0);
      const [name] = files(repo.root);
      const evidence = read(repo.root, name);
      expect(evidence.schemaVersion).toBe(2);
      expect(evidence.verify).toEqual(seen);
      expect(evidence.verify).toMatchObject({ schemaVersion: '2.0.0', scope: 'ci', verdict: 'PASS', run: { status: 'completed' } });
      expect(evidenceSchema.safeParse(evidence).success).toBe(true);
      expect(evidenceProblem(evidence, CHANGE)).toBeUndefined();
      expect(out.join('\n')).toContain('verify の結果（合格）を記録しました');
      expect(buildReport(repo.root, CHANGE)?.evidence.ok).toBe(true);
    } finally { repo.cleanup(); }
  });

  it('[REQ-315] 明示した local は local のまま記録し、ローカルの完了を最終 CI の合格に変えない', () => {
    const repo = doneRepo();
    try {
      const out: string[] = [];
      expect(runRecord({ root: repo.root, changeId: CHANGE, scope: 'local', stdout: (t) => out.push(t) })).toBe(0);
      const evidence = read(repo.root, files(repo.root)[0]);
      expect(evidence.verify).toMatchObject({ scope: 'local', summary: { pending: 0, fail: 0 } });
      expect(evidence.verify).not.toHaveProperty('verdict');
      expect(out.join('\n')).toContain('ローカルの項目はすべて完了。CI の最終合格は未確認');
      expect(out.join('\n')).not.toContain('（合格）');
      const report = buildReport(repo.root, CHANGE)!;
      expect(report.evidence.ok).toBe(false);
      expect(report.warnings[0]).toContain('scope: local');
    } finally { repo.cleanup(); }
  });

  it('[REQ-315] change が確定したあとの実行時の失敗は aborted として checks を足さずに記録し、終了コード 3。旧ファイルは上書きしない', () => {
    const repo = doneRepo();
    const spy = vi.spyOn(kit, 'runVerify').mockImplementation(() => { throw new kit.RuntimeFailure('品質コマンドを起動できません'); });
    try {
      const old = join(dir(repo.root), '00000000T000000Z-legacy.json');
      repo.write('.loomake/evidence/c1/00000000T000000Z-legacy.json', '{"keep":true}\n');
      repo.git('add', '-A'); repo.git('commit', '-q', '-m', 'old');
      expect(runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} })).toBe(3);
      const recorded = files(repo.root).filter((f) => !f.includes('legacy'));
      expect(recorded).toHaveLength(1);
      const evidence = read(repo.root, recorded[0]);
      expect(evidence.verify).toEqual({ schemaVersion: '2.0.0', change: CHANGE, run: { status: 'aborted', errors: [expect.objectContaining({ kind: 'runtime', message: '品質コマンドを起動できません' })] } });
      expect(readFileSync(old, 'utf8')).toBe('{"keep":true}\n');
    } finally { spy.mockRestore(); repo.cleanup(); }
  });
});

describe('Evidence 1 と Evidence 2 の読み分け', () => {
  // record で作った Evidence 2 を元に、版や欄を変えた記録を置く
  const withRecorded = (fn: (root: string, evidence: Record<string, unknown>, file: string) => void) => {
    const repo = doneRepo();
    try {
      runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} });
      const file = files(repo.root)[0];
      fn(repo.root, read(repo.root, file), join(dir(repo.root), file));
    } finally { repo.cleanup(); }
  };
  const report = (root: string) => {
    const out: string[] = [];
    try { return { code: runReport({ root, changeId: CHANGE, format: 'json', stdout: (t) => out.push(t) }), text: out.join('\n'), error: '' }; }
    catch (error) { return { code: 2, text: '', error: (error as Error).message }; }
  };

  it('[REQ-073] Evidence 2 を受け付け、Evidence 1 は履歴閲覧専用の警告を付けて読む', () => {
    withRecorded((root, evidence, file) => {
      expect(report(root).code).toBe(0);
      const legacy = { ...evidence, schemaVersion: 1, verify: { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [], coverage: {} } };
      writeFileSync(file, JSON.stringify(legacy));
      const r = report(root);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.text).warnings[0]).toBe(HISTORY_WARNING);
    });
  });

  it('[REQ-073] 未対応の版、版と verify の混在、Evidence 2 の状態別の必須欄がない記録は、ファイルと不正箇所を示して終了コード 2 で拒否する', () => {
    withRecorded((root, evidence, file) => {
      const v1Verify = { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [] };
      const verify = evidence.verify as Record<string, unknown>;
      const cases: [Record<string, unknown>, string][] = [
        [{ ...evidence, schemaVersion: 3 }, 'schemaVersion 3。読めるのは 1 と 2）'],
        [{ ...evidence, verify: v1Verify }, '証拠の版と verify の版が混在しています（証拠の schemaVersion 2 に verify の schemaVersion "1.0.0"。証拠 2 は verify 2.0.0 を含みます）'],
        [{ ...evidence, schemaVersion: 1 }, '証拠の版と verify の版が混在しています（証拠の schemaVersion 1 に verify の schemaVersion "2.0.0"。証拠 1 は verify 1.0.0 を含みます）'],
        [{ ...evidence, verify: { ...verify, checks: undefined } }, 'verify.checks の形が違います（run.status が completed の Evidence 2 では必須です）'],
        [{ ...evidence, verify: { ...verify, run: { status: 'partial', errors: [] }, summary: undefined } }, 'verify.summary の形が違います（run.status が partial の Evidence 2 では必須です）'],
        [{ ...evidence, verify: { ...verify, decision: undefined } }, 'verify.decision の形が違います（run.status が completed の Evidence 2 では必須です）'],
        [{ ...evidence, verify: { ...verify, run: { status: 'done', errors: [] } } }, 'verify.run の形が違います（run.status は completed・partial・aborted のどれかです）'],
      ];
      for (const [value, message] of cases) {
        writeFileSync(file, JSON.stringify(value));
        const r = report(root);
        expect(r.code, message).toBe(2);
        expect(r.error).toContain(`証拠の記録 .loomake/evidence/${CHANGE}/`);
        expect(r.error).toContain(message);
        // 壊れた Evidence 2 を「読めるのは 1」と案内しない
        expect(r.error).not.toContain('読めるのは 1）');
        expect(evidenceProblem(value, CHANGE)).toEqual(expect.any(String));
      }
    });
  });
});

describe('記録と report の往復', () => {
  it('[REQ-073][REQ-315] trace record が書いた Evidence 2 を、trace report が読んで JSON のレポートを出す（終了コード 0）', async () => {
    const { main } = await import('../../cli/src/main.js');
    const repo = doneRepo();
    try {
      const out: string[] = [];
      const io = { cwd: repo.root, stdout: (t: string) => out.push(t), stderr: () => {} };
      expect(await main(['trace', 'record', '--change', CHANGE], io)).toBe(0);
      expect(read(repo.root, files(repo.root)[0]).schemaVersion).toBe(2);
      out.length = 0;
      expect(await main(['trace', 'report', '--change', CHANGE, '--format', 'json'], io)).toBe(0);
      const report = JSON.parse(out.join('\n'));
      expect(report).toMatchObject({ schemaVersion: 2, change: CHANGE, evidence: { ok: true, documents: true } });
      expect(report.warnings).not.toContain(HISTORY_WARNING);
      expect(report.rows.map((row: { id: string; result: string }) => [row.id, row.result])).toContainEqual(['REQ-012', '合格']);
    } finally { repo.cleanup(); }
  });
});
