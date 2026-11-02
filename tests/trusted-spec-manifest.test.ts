import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../packages/kit/src/verify/trusted/canonical.js';
import { buildSpecManifest } from '../packages/kit/src/verify/trusted/spec-manifest.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';

const file = 'openspec/changes/sample/specs/verify/spec.md';
const requirement = (name = '許可', id = 'REQ-012') => `### Requirement: ${name}\n規則を守る SHALL。\nSource: ${id}\n#### Scenario: 拒否する\n- **WHEN** 条件\n- **THEN** reject`;
const delta = (body = requirement(), operation = 'MODIFIED') => `## ${operation} Requirements\n${body}`;
const build = (text: string, path = file) => buildSpecManifest('sample', [{ file: path, text }], sha256Hex);
const manifest = (text: string, path = file) => {
  const result = build(text, path);
  expect(result.problems).toEqual([]);
  expect(result.manifest).not.toBeNull();
  return result.manifest!;
};

describe('基準の canonical JSON', () => {
  it('[REQ-376][REQ-371] objectの挿入順だけが違う基準は同じになり、配列の並びは区別する', () => {
    expect(canonicalJson({ z: [{ b: 2, a: '日本語' }], a: null })).toBe('{"a":null,"z":[{"a":"日本語","b":2}]}');
    expect(canonicalJson({ a: null, z: [{ a: '日本語', b: 2 }] })).toBe(canonicalJson({ z: [{ b: 2, a: '日本語' }], a: null }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it.each([undefined, NaN, Infinity, 1n, new Date(0), { a: undefined }, [undefined], Array(1)])(
    '[REQ-376][REQ-371] JSONで情報が落ちる値を基準にしない #%#', (value) => {
      expect(() => canonicalJson(value)).toThrow();
    });

  it('[REQ-376][REQ-371] 循環と実行されるgetterを拒否し、共有されたJSON値は使える', () => {
    const cyclic: { next?: unknown } = {}; cyclic.next = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow('循環');
    let called = false;
    expect(() => canonicalJson({ get value() { called = true; return 1; } })).toThrow('getter');
    expect(called).toBe(false);
    const value = { x: 1 };
    expect(canonicalJson([value, value])).toBe('[{"x":1},{"x":1}]');
    expect(canonicalJson(JSON.parse('{"__proto__":{"x":1}}'))).toBe('{"__proto__":{"x":1}}');
  });
});

describe('差分仕様の完全な範囲', () => {
  it('[REQ-376] ADDEDのRequirementを変更種別と必須Sourceに含める', () => {
    const result = manifest(delta(requirement(), 'ADDED'));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ op: 'ADDED', name: '許可', sources: ['REQ-012'], scenarios: 1 });
    expect(result.requiredSet).toEqual(['REQ-012']);
  });

  it('[REQ-376][REQ-371] 改行なしEOFの最後のTHENだけを変えてもblockとmanifestが変わる', () => {
    const before = manifest(delta());
    const after = manifest(delta().replace('THEN** reject', 'THEN** accept'));
    expect(before.blocks).toHaveLength(1);
    expect(before.blocks[0]).toMatchObject({ op: 'MODIFIED', name: '許可', sources: ['REQ-012'], scenarios: 1, startLine: 2 });
    expect(after.blocks[0].sha256).not.toBe(before.blocks[0].sha256);
    expect(after.hash).not.toBe(before.hash);
    expect(after.requiredSetHash).toBe(before.requiredSetHash);
  });

  it('[REQ-376][REQ-371] CRLF・CR・EOFの空行だけなら同じhashになる', () => {
    const expected = manifest(delta());
    for (const text of [delta() + '\n', delta() + '\n \t\n', delta().replaceAll('\n', '\r\n'), delta().replaceAll('\n', '\r')]) {
      expect(manifest(text)).toEqual(expected);
    }
  });

  it('[REQ-376][REQ-371] fence内の偽見出しを境界にせず、その後のScenario変更を検出する', () => {
    const text = delta(requirement().replace('#### Scenario:', '```md\n# example\n### Requirement: 偽\nSource: REQ-999\n#### Scenario: 偽\n```\n#### Scenario:'));
    const before = manifest(text);
    const after = manifest(text.replace('THEN** reject', 'THEN** accept'));
    expect(before.blocks).toHaveLength(1);
    expect(before.requiredSet).toEqual(['REQ-012']);
    expect(before.blocks[0].scenarios).toBe(1);
    expect(after.blocks[0].sha256).not.toBe(before.blocks[0].sha256);
    expect(manifest(text.replace('# example', '# other')).blocks[0].sha256).not.toBe(before.blocks[0].sha256);
  });

  it('[REQ-376][REQ-371] 空行なしの連続Requirementと末尾RENAMEDを分ける', () => {
    const renamed = '## RENAMED Requirements\n- FROM: `### Requirement: 古い`\n- TO: `### Requirement: 新しい`';
    const text = delta(requirement() + '\n' + requirement('別', 'REQ-013')) + '\n' + renamed;
    const result = manifest(text);
    expect(result.blocks.map((b) => [b.op, b.name, b.from])).toEqual([
      ['MODIFIED', '許可', undefined], ['MODIFIED', '別', undefined], ['RENAMED', '新しい', '古い'],
    ]);
    expect(result.requiredSet).toEqual(['REQ-012', 'REQ-013']);
    expect(manifest(text.replace('新しい`', '変更後`')).blocks[2].sha256).not.toBe(result.blocks[2].sha256);
  });

  it('[REQ-376][REQ-371] EOFのSource変更と見出しだけのblockも取り落とさない', () => {
    const text = delta('### Requirement: 末尾\nSource: REQ-012');
    expect(manifest(text.replace('012', '013')).requiredSet).toEqual(['REQ-013']);
    expect(manifest(text.replace('012', '013')).blocks[0].sha256).not.toBe(manifest(text).blocks[0].sha256);
    expect(manifest(delta('### Requirement: 一行')).blocks[0].sha256).toBe(sha256Hex('### Requirement: 一行'));
  });

  it('[REQ-376][REQ-371] EOFまで続く閉じたfence内の変更も最後のblockに残す', () => {
    const text = delta() + '\n```md\n### Requirement: 偽\nSource: REQ-999\n#### Scenario: 偽\n```';
    const before = manifest(text);
    const after = manifest(text.replace('REQ-999', 'REQ-998'));
    expect(before.blocks).toHaveLength(1);
    expect(after.requiredSet).toEqual(['REQ-012']);
    expect(after.blocks[0].sha256).not.toBe(before.blocks[0].sha256);
  });

  it('[REQ-376][REQ-371] block外の変更もfileとmanifestに含める', () => {
    const before = manifest('# 説明\n' + delta());
    const after = manifest('# 別の説明\n' + delta());
    expect(after.blocks).toEqual(before.blocks);
    expect(after.files).not.toEqual(before.files);
    expect(after.hash).not.toBe(before.hash);
  });

  it('[REQ-376][REQ-371] 閉じないfenceで隠れた要件とSourceの減少をmanifestから照合できる', () => {
    const before = manifest(delta(requirement() + '\n' + requirement('次', 'REQ-013')));
    const after = manifest(delta(requirement() + '\n```md\n' + requirement('次', 'REQ-013')));
    expect(before.requiredSet).toEqual(['REQ-012', 'REQ-013']);
    expect(after.requiredSet).toEqual(['REQ-012']);
    expect(after.blocks).toHaveLength(1);
    expect(after.hash).not.toBe(before.hash);
  });

  it('[REQ-376][REQ-371] REMOVEDはSource必須集合へ足さず、移動前後の同じblockを照合できる', () => {
    const removed = delta(requirement('削除', 'REQ-099'), 'REMOVED');
    const text = delta() + '\n' + removed;
    expect(manifest(text).requiredSet).toEqual(['REQ-012']);
    const before = manifest(delta());
    const after = manifest(delta(), 'openspec/changes/sample/specs/new-place/spec.md');
    expect(before.blocks[0].sha256).toBe(after.blocks[0].sha256);
    expect(before.hash).not.toBe(after.hash);
    expect(buildSpecManifest('sample', [], sha256Hex).manifest?.requiredSet).toEqual([]);
  });

  it('[REQ-376][REQ-371] 入力fileの順序だけで基準が変わらず、pathやRequirementの重複を拒否する', () => {
    const files = [{ file, text: delta() }, { file: file.replace('/verify/', '/other/'), text: delta(requirement('別', 'REQ-013')) }];
    expect(buildSpecManifest('sample', files, sha256Hex)).toEqual(buildSpecManifest('sample', [...files].reverse(), sha256Hex));
    expect(buildSpecManifest('sample', [files[0], files[0]], sha256Hex).manifest).toBeNull();
    expect(build(delta(requirement() + '\n' + requirement())).manifest).toBeNull();
    expect(build('## RENAMED Requirements\nFROM: ### Requirement: 未対応').manifest).toBeNull();
  });

  it.each(['../spec.md', '/tmp/spec.md', file.replace('/verify/', '/../../'), file.replace('sample', 'other'), file.replaceAll('/', '\\')])(
    '[REQ-376][REQ-371] 対象外または危険なpathを正規化して受け入れない %s', (path) => {
      expect(build(delta(), path).manifest).toBeNull();
    });
});
