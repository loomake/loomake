import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { checkInitialBaselineStructure } from '../packages/kit/src/verify/trusted/baseline.js';
import type { ApprovedBaseline, BaselineOwner } from '../packages/kit/src/verify/trusted/baseline-types.js';
import { C001_OWNER_SOURCE_EXCEPTIONS, C001_VERIFICATION_FILE } from '../packages/kit/src/verify/trusted/c001-baseline.js';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { checkC001OwnerSources } from '../packages/kit/src/verify/trusted/owner-sources.js';

const { parse } = createRequire(new URL('../packages/kit/package.json', import.meta.url))('yaml') as {
  parse(text: string, options: { maxAliasCount: number }): { expected_spec: ApprovedBaseline };
};
let baseline: ApprovedBaseline, context: Parameters<typeof checkInitialBaselineStructure>[1];
const row = (b: ApprovedBaseline, key: string) => b.rows.find(r => r.key === key)!;
const run100 = 'run/modified/REQ-100', run093 = 'run/modified/REQ-093';
beforeAll(() => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const original = verifyOriginalSnapshot(readGitDocuments(process.cwd(), head, ORIGINAL_C001_SNAPSHOT_DIR), sha256Hex);
  expect(original.problems).toEqual([]);
  baseline = parse(readGitDocuments(process.cwd(), head, C001_VERIFICATION_FILE)[0].text, { maxAliasCount: 100 }).expected_spec;
  const files = [...new Set(baseline.rows.flatMap(r => r.owners.map(o => o.file)))];
  const anchor = files.map(file => ({ file, text: new TextDecoder('utf-8', { fatal: true }).decode(
    execFileSync('git', ['--no-replace-objects', 'show', `${head}:${file}`])) }));
  context = { original: original.documents!, anchor, sha256Hex };
});
function retarget(b: ApprovedBaseline, key: string, owner: BaselineOwner) {
  const r = row(b, key); r.owners = [owner];
  for (const mapping of r.scenarioMap) {
    mapping.status = 'moved'; mapping.current = { file: owner.file, name: owner.name, scenario: owner.scenarios[0] };
  }
}
function reject(b: ApprovedBaseline, reason: RegExp, c = context) {
  expect(checkInitialBaselineStructure(b, c).problems).toEqual([]);
  const result = checkC001OwnerSources(b, c);
  expect(result.bindings).toBeNull(); expect(result.adoptionsVerified).toBe(false);
  expect(result.problems.join(' ')).toMatch(reason); return result;
}
const frozen = (v: unknown): boolean => v === null || typeof v !== 'object'
  || (Object.isFrozen(v) && Object.values(v).every(frozen));

describe('C001所有先のSource照合（来歴・主体・実行は未検証）', () => {
  it('[REQ-388] T-C3A-01 実記録49所有と固定Q-S1-14を入力不変で照合する', () => {
    const before = JSON.stringify({ baseline, context }), result = checkC001OwnerSources(baseline, context);
    expect(result.problems).toEqual([]); expect(result.bindings).toHaveLength(49);
    expect(result.adoptionsVerified).toBe(false); expect(frozen(result.bindings)).toBe(true);
    expect(result.bindings!.every(b => b.capability === b.key.split('/').slice(0, -2).join('/'))).toBe(true);
    const exceptional = result.bindings!.filter(b => b.exception !== null);
    expect(exceptional).toHaveLength(1);
    expect(exceptional[0]).toMatchObject({ key: run100, sources: ['REQ-331'], exception: { change: 'trusted-original-baseline', id: 'Q-S1-14' } });
    expect(frozen(C001_OWNER_SOURCE_EXCEPTIONS)).toBe(true);
    expect(C001_OWNER_SOURCE_EXCEPTIONS[0]).toMatchObject({ key: run100, ...row(baseline, run100).owners[1], sources: ['REQ-331'] });
    expect(JSON.stringify({ baseline, context })).toBe(before); expect(Object.isFrozen(baseline)).toBe(false);
  });
  it.each(['active-other', 'archive-other', 'archive-same'])(
    '[REQ-388] T-C3A-02 capabilityとarchiveの論理pathを照合する %s', variant => {
      const b = structuredClone(baseline), owner = structuredClone(row(b, run093).owners[0]);
      const text = context.anchor.find(d => d.file === owner.file)!.text;
      if (variant !== 'active-other') { owner.kind = 'archived'; owner.file = owner.file.replace('changes/', 'changes/archive/2026-11-02-'); }
      if (variant !== 'archive-same') owner.file = owner.file.replace('/specs/run/', '/specs/other/');
      retarget(b, run093, owner); const c = { ...context, anchor: [...context.anchor, { file: owner.file, text }] };
      if (variant === 'archive-same') {
        expect(checkInitialBaselineStructure(b, c).problems).toEqual([]);
        expect(checkC001OwnerSources(b, c).problems).toEqual([]);
      } else reject(b, /capability.*run\/modified\/REQ-093.*other/, c);
    });
  it('[REQ-388] T-C3A-03 原Sourceを持たない行へ例外を転用できない', () => {
    const b = structuredClone(baseline); retarget(b, run093, structuredClone(row(b, run100).owners[1]));
    const result = reject(b, /原Sourceを持つ所有先がありません/);
    expect(result.problems.join(' ')).toMatch(/固定した根拠がありません/);
  });
  it.each(['missing', 'other-block', 'missing-test'])(
    '[REQ-388] T-C3A-04 固定例外の欠落・別block・ID付き試験の欠落を拒否する %s', variant => {
      const b = structuredClone(baseline), r = row(b, run100);
      if (variant === 'missing') retarget(b, run100, r.owners[0]);
      else if (variant === 'other-block') {
        const owner = structuredClone(row(b, run093).owners[0]);
        r.owners[1] = owner;
        for (const mapping of r.scenarioMap) if (mapping.current?.file === 'openspec/specs/run/spec.md') {
          mapping.status = 'moved'; mapping.current = { file: owner.file, name: owner.name, scenario: owner.scenarios[0] };
        }
      } else r.tests = r.tests.filter(t => !t.name.includes('[REQ-331]'));
      reject(b, variant === 'missing' ? /固定した追加所有先が初回基準にありません/
        : variant === 'other-block' ? /固定した根拠がありません/ : /SourceのID付き試験がありません/);
    });
  it('[REQ-388] T-C3A-05 記録側のQ-S1-14自己申告だけでは追加所有を受理しない', () => {
    const b = structuredClone(baseline), r = row(b, run100);
    r.owners.push(structuredClone(row(b, run093).owners[0]));
    r.adoption.push({ trace: { change: 'trusted-original-baseline', id: 'Q-S1-14' } });
    reject(b, /固定した根拠がありません/);
  });
  it.each(['missing', 'changed', 'null'])(
    '[REQ-388] T-C3A-06 構造照合のproblemsをそのまま引き継ぐ %s', variant => {
      const c = { ...context, anchor: context.anchor.map(d => ({ ...d })) };
      if (variant === 'missing') c.anchor.shift();
      if (variant === 'changed') c.anchor[0].text += 'x';
      const input = variant === 'null' ? null : baseline;
      const expected = checkInitialBaselineStructure(input, c); expect(expected.problems.length).toBeGreaterThan(0);
      const result = checkC001OwnerSources(input, c);
      expect(result).toEqual({ bindings: null, adoptionsVerified: false, problems: expected.problems });
    });
});
