import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseDocument } from 'yaml';
import { join } from 'node:path';
import { loadQualitySchema, type VerifyRunError } from '@loomake/core';
import { createInputReader, evaluateQualityConditions, readQualityFile, verifyExitCode, MINIMAL_QUALITY_YAML, QUALITY_FILE, type InputReader, type QualityReadResult } from '../src/index.js';

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


it('[REQ-398] 不在案内は読取の最小と完了合格の対象・証拠を区別し、runtime/3を保つ', () => {
  withRoot(undefined, (root) => {
    const error = errorOf(read(root));
    expect(error.kind).toBe('runtime');
    expect(exitOf(error)).toBe(3);
    expect(error.next).toContain('最小の quality.yaml');
    expect(error.next).toContain('読取');
    expect(error.next).toContain('品質の対象');
    expect(error.next).toContain('証拠');
  });
});


it('[REQ-398][REQ-310] 2行の公開定数と未知キーの互換、config/2とpermission/3を維持する', () => {
  expect(MINIMAL_QUALITY_YAML).toBe('version: 2\nmodel: iso-iec-25010-2011\n');
  withRoot(`${MINIMAL_QUALITY_YAML}future: preserved\n`, (root) => {
    expect(read(root)).toMatchObject({ status: 'loaded', quality: { future: 'preserved', objectives: {}, product: {} } });
    const denied = { ...createInputReader(), read: () => { throw new Error('EACCES: permission denied'); } };
    const error = errorOf(read(root, 'done', denied));
    expect(error.kind).toBe('permission');
    expect(exitOf(error)).toBe(3);
    expect(error.next).toContain('権限');
  });
  for (const content of ['version: 2\nmodel: [\n', 'version: "2"\nmodel: x\n', 'version: 3\nmodel: x\n']) {
    withRoot(content, (root) => {
      const error = errorOf(read(root));
      expect(error.kind).toBe('config');
      expect(exitOf(error)).toBe(2);
    });
  }
});


describe('Skill の品質 YAML 例', () => {
  const example = () => {
    const format = readFileSync(new URL('../templates/skills/req-to-openspec/references/openspec-format.md', import.meta.url), 'utf8');
    const match = /### 品質 YAML の提案[\s\S]*?```yaml\r?\n([\s\S]*?)\r?\n```/.exec(format);
    expect(match).not.toBeNull();
    return match![1];
  };
  it('[REQ-408] 同じ例をdoneで読み、関連REQと全必須evidenceのtargetを持つ', () => {
    withRoot(example(), (root) => {
      const result = read(root, 'done');
      expect(result.status).toBe('loaded');
      if (result.status !== 'loaded') throw new Error('品質 YAML 例を読み取れません');
      const items = [...Object.values(result.quality.objectives), ...Object.values(result.quality.product)];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.linked_requirements).toEqual(['REQ-313']);
        expect(item.evidence.length).toBeGreaterThan(0);
        for (const evidence of item.evidence) expect(evidence.target).toBeDefined();
      }
    });
  });
  it('[REQ-408] 同じ例は観測零件でも判定対象がありPASSにはならない', () => {
    withRoot(example(), (root) => {
      const result = read(root, 'done');
      expect(result.status).toBe('loaded');
      if (result.status !== 'loaded') throw new Error('品質 YAML 例を読み取れません');
      const checks = evaluateQualityConditions(result.quality, []);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every((check) => check.result === 'INSUFFICIENT_EVIDENCE')).toBe(true);
      expect(checks.filter((check) => check.result === 'PASS')).toEqual([]);
    });
  });
});


it('[REQ-410] 保持例の合意更新だけが変わり、対象外の値・未知キー・コメント・行順は残る', () => {
  const format = readFileSync(new URL('../templates/skills/req-to-openspec/references/openspec-format.md', import.meta.url), 'utf8');
  const section = format.slice(format.indexOf('### 合意した更新と保持の例'));
  const blocks = [...section.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)].slice(0, 2);
  expect(blocks).toHaveLength(2);
  const docs = blocks.map((block) => parseDocument(block[1]));
  for (const doc of docs) expect(doc.errors).toEqual([]);
  type Fragment = { product: Record<string, { linked_requirements: string[]; blocking: boolean; custom: number }> };
  const before = docs[0].toJS() as Fragment;
  const after = docs[1].toJS() as Fragment;
  expect(before.product['PQ-900'].linked_requirements).toEqual(['REQ-313']);
  expect(after.product['PQ-900'].linked_requirements).toEqual(['REQ-313', 'REQ-034']);
  expect(after.product['PQ-900'].custom).toBe(1);
  expect({ ...after.product['PQ-900'], linked_requirements: before.product['PQ-900'].linked_requirements }).toEqual(before.product['PQ-900']);
  const unchanged = blocks.map((block) => block[1].split(/\r?\n/).filter((line) => !line.trimStart().startsWith('linked_requirements:')));
  expect(unchanged[1]).toEqual(unchanged[0]);
  expect(unchanged[0]).toContain('    # 既存のコメント');
});
