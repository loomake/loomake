import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildMainSpecManifest, buildSpecManifest } from '../packages/kit/src/verify/trusted/spec-manifest.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';

const file = 'openspec/specs/verify/spec.md';
const requirement = (name = '省略', source = 'REQ-042') => `### Requirement: ${name}\ncommands だけを実行する SHALL。\nSource: ${source}\n#### Scenario: commands のみ\n- **WHEN** 省略する\n- **THEN** commands のみ`;
const build = (text: string, path = file) => buildMainSpecManifest([{ file: path, text }], sha256Hex);
const manifest = (text: string) => {
  const result = build(text);
  expect(result.problems).toEqual([]);
  expect(result.manifest).not.toBeNull();
  return result.manifest!;
};

describe('unchanged owner の主仕様照合', () => {
  it('[REQ-376][REQ-371] 実際のREQ-042を独立計算した本文hashで保持し、差分のop必須条件も保つ', () => {
    const text = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
    const result = manifest(text);
    const owners = result.blocks.filter((block) => block.sources.includes('REQ-042'));
    expect(owners).toHaveLength(1);
    expect(owners[0]).toEqual({ file, op: null, name: 'change の省略', sources: ['REQ-042'], scenarios: 1,
      startLine: 184, sha256: '9480c8bd5583d1b0a7699ed7e9c4accaf9bedfce2c41ace7465c3ed7fbda4b61' });
    expect(buildSpecManifest('sample', [{ file: 'openspec/changes/sample/specs/verify/spec.md', text: requirement() }], sha256Hex).manifest).toBeNull();
  });

  it('[REQ-376][REQ-371] 改行のないEOFとScenario本文の変更をhashに含む', () => {
    const before = manifest(requirement());
    const after = manifest(requirement().replace('THEN** commands のみ', 'THEN** commands 以外'));
    expect(before.blocks[0].sha256).toBe(sha256Hex(requirement()));
    expect(after.blocks[0].sha256).not.toBe(before.blocks[0].sha256);
    expect(after.hash).not.toBe(before.hash);
    expect(after.blocks[0].sources).toEqual(before.blocks[0].sources);
  });

  it('[REQ-376][REQ-371] CRLF・CRと末尾空白行だけなら同じ主仕様になる', () => {
    const expected = manifest(requirement());
    for (const text of [requirement() + '\n', requirement() + '\n \t\n', requirement().replaceAll('\n', '\r\n'), requirement().replaceAll('\n', '\r')]) {
      expect(manifest(text)).toEqual(expected);
    }
  });

  it('[REQ-376][REQ-371] fence内の偽見出しを無視し、その本文の変更は検出する', () => {
    const text = requirement() + '\n~~~md\n### Requirement: 偽\nSource: REQ-999\n#### Scenario: 偽\n~~~';
    const before = manifest(text);
    expect(before.blocks).toHaveLength(1);
    expect(before.blocks[0]).toMatchObject({ sources: ['REQ-042'], scenarios: 1 });
    expect(manifest(text.replace('REQ-999', 'REQ-998')).blocks[0].sha256).not.toBe(before.blocks[0].sha256);
  });

  it('[REQ-376][REQ-371] 連続するRequirementを分離し、前置きの変更もfileに含む', () => {
    const text = '# 説明\n' + requirement() + '\n\n' + requirement('別', 'REQ-055');
    const before = manifest(text);
    expect(before.blocks.map((block) => [block.name, block.startLine])).toEqual([['省略', 2], ['別', 9]]);
    expect(before.blocks[0].sha256).toBe(sha256Hex(requirement()));
    const after = manifest(text.replace('# 説明', '# 別の説明'));
    expect(after.blocks).toEqual(before.blocks);
    expect(after.files).not.toEqual(before.files);
    expect(after.hash).not.toBe(before.hash);
  });

  it('[REQ-376][REQ-371] 複数ファイルの入力順に依存せず、重複pathと同名ownerを拒否する', () => {
    const files = [{ file, text: requirement() }, { file: 'openspec/specs/other/spec.md', text: requirement('別', 'REQ-055') }];
    expect(buildMainSpecManifest(files, sha256Hex)).toEqual(buildMainSpecManifest([...files].reverse(), sha256Hex));
    expect(buildMainSpecManifest([files[0], files[0]], sha256Hex).manifest).toBeNull();
    expect(build(requirement() + '\n' + requirement('省略', 'REQ-055')).manifest).toBeNull();
  });

  it.each(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'])(
    '[REQ-376][REQ-371] 主仕様に差分operationを持ち込まない %s', (op) => {
      const body = op === 'RENAMED' ? '- FROM: `### Requirement: 前`\n- TO: `### Requirement: 後`' : requirement();
      expect(build(`## ${op} Requirements\n${body}`).manifest).toBeNull();
    });

  it.each(['../spec.md', '/tmp/spec.md', 'openspec/specs/spec.md', 'openspec/specs/../../spec.md', 'openspec/changes/sample/specs/verify/spec.md', 'openspec/specs/verify/spec.md.txt', 'openspec\\specs\\verify\\spec.md'])(
    '[REQ-376][REQ-371] 主仕様以外または危険なpathを受理しない %s', (path) => {
      expect(build(requirement(), path).manifest).toBeNull();
    });
});
