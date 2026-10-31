import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQualitySchema, type VerifyRunError } from '@loomake/core';
import { createInputReader, readQualityFile, verifyExitCode, MINIMAL_QUALITY_YAML, QUALITY_FILE, type InputReader, type QualityReadResult } from '../src/index.js';

const { qualitySchema } = await loadQualitySchema();

function withRoot(content: string | undefined, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-quality-'));
  try {
    if (content !== undefined) writeFileSync(join(root, QUALITY_FILE), content);
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const read = (root: string, gate: 'spec-only' | 'done' = 'done', reader?: InputReader) => readQualityFile({ root, gate, schema: qualitySchema, reader });
const errorOf = (result: QualityReadResult): VerifyRunError => {
  expect(result.status).toBe('error');
  return (result as Extract<QualityReadResult, { status: 'error' }>).error;
};
// 読み取りの失敗を、終了コードの選び方（REQ-309）に通したときの値
const exitOf = (error: VerifyRunError) => verifyExitCode({ schemaVersion: '2.0.0', change: 'c1', run: { status: 'aborted', errors: [error] } });

describe('quality.yaml の最小読取', () => {
  it('[REQ-310] version と model だけの最小の quality.yaml に既定値を補い、未知のキーを残す', () => {
    withRoot(MINIMAL_QUALITY_YAML, (root) => {
      const result = read(root);
      expect(result).toEqual({ status: 'loaded', quality: expect.objectContaining({ version: 2, model: 'iso-iec-25010-2011', objectives: {}, product: {} }) });
      const quality = (result as Extract<QualityReadResult, { status: 'loaded' }>).quality;
      expect(quality.evidence).toEqual({ artifact_retention: '90d', long_term_store: 'github-release', long_term_retention: '5y', access: 'project-members', delete_policy: 'owner-approval' });
    });
    withRoot(`${MINIMAL_QUALITY_YAML}future:\n  note: x\nproduct:\n  PQ-900:\n    characteristic: functional_suitability\n    custom: 1\n    evidence:\n      - source: ci.test_report\n        metric: required_subjects_with_failed_tests\n        target: "== 0"\n`, (root) => {
      const quality = (read(root) as Extract<QualityReadResult, { status: 'loaded' }>).quality as Record<string, unknown> & { product: Record<string, Record<string, unknown>> };
      expect(quality.future).toEqual({ note: 'x' });
      expect(quality.product['PQ-900'].custom).toBe(1);
      expect(quality.product['PQ-900'].indicators).toEqual([]);
    });
  });

  it('[REQ-310] YAML の構文・型・版・対象外の必須値の誤りは config で、終了コード 2 になる', () => {
    const cases = [
      'version: 2\nmodel: [unclosed\n',
      'version: 2\nmodel: a\nmodel: b\n',
      'version: 3\nmodel: x\n',
      'version: "2"\nmodel: x\n',
      'version: 2\n',
      '',
      'version: 2\nmodel: x\nproduct:\n  PQ-001:\n    characteristic: c\n    applicability: not_applicable\n',
      'version: 2\nmodel: x\nproduct:\n  PQ-001:\n    characteristic: c\n    evidence:\n      - source: s\n        metric: m\n        target: "about 3"\n',
    ];
    for (const content of cases) {
      withRoot(content, (root) => {
        for (const gate of ['spec-only', 'done'] as const) {
          const error = errorOf(read(root, gate));
          expect(error.kind, content).toBe('config');
          expect(error.target).toBe('quality.yaml');
          expect(error.message).toMatch(/quality\.yaml/);
          expect(error.next.length).toBeGreaterThan(0);
          expect(exitOf(error)).toBe(2);
        }
      });
    }
    withRoot('version: 3\nmodel: x\n', (root) => expect(errorOf(read(root)).message).toContain('version 3 には対応していません'));
    withRoot('version: 2\nmodel: [x\n', (root) => expect(errorOf(read(root)).next).toContain('YAML'));
  });

  it('[REQ-310] 完了ゲートでの不在は runtime、権限不足は permission で、終了コード 3 になり、次の操作を示す', () => {
    withRoot(undefined, (root) => {
      const error = errorOf(read(root, 'done'));
      expect(error).toMatchObject({ kind: 'runtime', target: 'quality.yaml' });
      expect(error.next).toContain('最小の quality.yaml');
      expect(exitOf(error)).toBe(3);
    });
    withRoot(MINIMAL_QUALITY_YAML, (root) => {
      const denied: InputReader = { ...createInputReader(), read: () => { throw new Error(`入力を読み取れません：EACCES: permission denied, open '${join(root, QUALITY_FILE)}'`); } };
      for (const gate of ['spec-only', 'done'] as const) {
        const error = errorOf(read(root, gate, denied));
        expect(error.kind).toBe('permission');
        expect(error.next).toContain('権限');
        expect(exitOf(error)).toBe(3);
      }
    });
  });

  it('[REQ-310] 予算を超えるファイルは読まず、runtime にする', () => {
    withRoot('version: 2\nmodel: x\n' + '#'.repeat(200) + '\n', (root) => {
      const error = errorOf(read(root, 'done', createInputReader({ maxFileBytes: 64 })));
      expect(error.kind).toBe('runtime');
      expect(error.message).toContain('64');
    });
  });

  it('[REQ-310] 入れ子のエイリアスが展開の上限を超えても例外を投げず、spec-only・done とも config にする', () => {
    const ten = (name: string) => `[${Array.from({ length: 10 }, () => `*${name}`).join(', ')}]`;
    const content = `version: 2\nmodel: x\na: &a [${Array.from({ length: 10 }, () => 'x').join(', ')}]\nb: &b ${ten('a')}\nc: &c ${ten('b')}\nd: ${ten('c')}\n`;
    withRoot(content, (root) => {
      for (const gate of ['spec-only', 'done'] as const) {
        let result: QualityReadResult | undefined;
        expect(() => { result = read(root, gate); }).not.toThrow();
        const error = errorOf(result!);
        expect(error.kind).toBe('config');
        expect(exitOf(error)).toBe(2);
      }
    });
  });

  it('[REQ-310] version を文字列で書いたときは、数値で書くよう型の違いを示す', () => {
    withRoot('version: "2"\nmodel: x\n', (root) => {
      const error = errorOf(read(root));
      expect(error.kind).toBe('config');
      expect(error.message).toContain('version は数値で書いてください（"2" ではなく 2）');
    });
  });

  it('[REQ-310] spec-only では quality.yaml の不在を許し、品質の構造検査を対象外にする', () => {
    withRoot(undefined, (root) => {
      expect(read(root, 'spec-only')).toEqual({ status: 'absent' });
    });
  });
});
