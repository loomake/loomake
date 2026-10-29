import { describe, expect, expectTypeOf, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { EVIDENCE_SCHEMA_VERSION as CORE_EVIDENCE_VERSION, REPORT_SCHEMA_VERSION as CORE_REPORT_VERSION, loadTraceSchemas, type Evidence as CoreEvidence, type EvidenceDocument as CoreDocument, type Report as CoreReport, type ReportRow as CoreRow } from '@loomake/core';
import { EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION, buildReport, runReport, evidenceProblem, readDocuments, type Evidence, type EvidenceDocument, type Report, type ReportRow } from '../src/index.js';
import { serializeEvidence } from '../src/serialization.js';
import { evidenceValue } from '../../core/test/fixtures/trace-contract-values.js';
import { withProject } from '../../kit/test/project.js';

const { evidenceSchema, reportSchema } = await loadTraceSchemas();

describe('trace の公開元と同期境界', () => {
  it('[REQ-303] 従来の公開元が core と同じ型と版を公開する', () => {
    expectTypeOf<Evidence>().toEqualTypeOf<CoreEvidence>();
    expectTypeOf<EvidenceDocument>().toEqualTypeOf<CoreDocument>();
    expectTypeOf<Report>().toEqualTypeOf<CoreReport>();
    expectTypeOf<ReportRow>().toEqualTypeOf<CoreRow>();
    expectTypeOf<ReturnType<typeof buildReport>>().toEqualTypeOf<Report | undefined>();
    expectTypeOf<ReturnType<typeof serializeEvidence>>().toEqualTypeOf<string>();
    expect([EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION]).toEqual([CORE_EVIDENCE_VERSION, CORE_REPORT_VERSION]);
    expect([EVIDENCE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION]).toEqual([1, 2]);
  });

  it('[REQ-303] 構造スキーマが受ける不適合な証拠を従来の意味検証が拒否する', () => {
    const base = evidenceValue();
    const document = { path: 'trace.md', content: '', sha256: createHash('sha256').update('').digest('hex') };
    const inputs = [
      { ...base, schemaVersion: 2 }, { ...base, sha: 'wrong' }, { ...base, committedAt: '' }, { ...base, recordedAt: 'wrong' }, { ...base, change: 'other' },
      { ...base, verify: { ...base.verify, change: 'other' } }, { ...base, verify: { ...base.verify, mode: 'quality' } },
      { ...base, documents: [{ path: 'trace.md', content: '', sha256: 'wrong' }] },
      { ...base, documents: [{ path: '', content: '', sha256: '' }] },
      { ...base, documents: [document, document] },
    ];
    for (const value of inputs) {
      expect(evidenceSchema.safeParse(value).success, JSON.stringify(value)).toBe(true);
      const problem = evidenceProblem(value, 'c1');
      expect(problem).toEqual(expect.any(String));
      expect(problem).not.toBeInstanceOf(Promise);
      expect(() => serializeEvidence(value as Evidence)).toThrow();
      if (value.documents?.length === 2) expect(problem).toContain('重複');
    }
  });

  it('[REQ-303] 保存とレポート生成は同期のまま JSON 整形・末尾改行・省略を保持する', () => {
    withProject({}, (root) => {
      const base = evidenceValue();
      const value = { ...base, extra: { future: true }, verify: { ...base.verify, extra: 1 }, documents: readDocuments(join(root, 'openspec/changes/c1')).map((d) => ({ ...d, extra: 'saved' })) };
      const json = serializeEvidence(value);
      expect(json).toBe(JSON.stringify(value, null, 2) + '\n');
      const dir = join(root, '.loomake/evidence/c1');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, '20261024T000000Z-aaaaaaaaaaaa.json');
      writeFileSync(file, json);
      const built = buildReport(root, 'c1')!;
      expect(built).not.toBeInstanceOf(Promise);
      expect(reportSchema.parse(built)).toEqual(built);
      expect(built.schemaVersion).toBe(2);
      expect(built.rows).toEqual([{ id: 'REQ-012', source: '要件書 §1', state: '反映済', summary: '要約', requirements: ['検査用の振る舞い'], tests: ['tests/a.test.ts'], result: '合格' }]);
      const output: string[] = [];
      expect(runReport({ root, changeId: 'c1', format: 'json', stdout: (s) => output.push(s) })).toBe(0);
      expect(output).toEqual([JSON.stringify(built, null, 2) + '\n']);
      const legacy = serializeEvidence(base);
      expect(JSON.parse(legacy)).not.toHaveProperty('documents');
      writeFileSync(file, legacy);
      const old = buildReport(root, 'c1')!;
      expect(old.evidence.documents).toBe(false);
      expect(old.rows[0].result).toBe('合格（仕様との対応は未確認）');
    });
  });
});
