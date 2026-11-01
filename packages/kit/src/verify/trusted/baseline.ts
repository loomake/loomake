import { parseSpec } from '@loomake/core';
import { canonicalJson, isSafeRepoPath } from './canonical.js';
import { decodeInitialBaseline } from './baseline-shape.js';
import type { ApprovedBaseline, BaselineOwner, BaselineRow, TestRef } from './baseline-types.js';
import { reconstructOriginalContracts } from './original-contracts.js';
import { reconstructOriginalScope } from './original-cross-conditions.js';
import { buildMainSpecManifest, buildSpecManifest } from './spec-manifest.js';

type Document = { file: string; text: string };
type OwnerBlock = { file: string; name: string; block: string; scenarios: string[] };
type Hash = (text: string) => string;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const identity = (ref: TestRef) => canonicalJson([ref.file, ref.name]);
const unique = (values: string[]) => new Set(values).size === values.length;

function ownerBlock(owner: BaselineOwner, text: string, hash: Hash): OwnerBlock | null {
  const { file, kind, change } = owner;
  let logical = file, name = change;
  if (kind === 'main-unchanged') {
    if (change !== undefined) return null;
  } else if (kind === 'archived') {
    const match = /^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-([a-z0-9]+(?:-[a-z0-9]+)*)\/specs\/(.+\/spec\.md)$/.exec(file);
    if (!match || (change !== undefined && change !== match[1])) return null;
    name = match[1]; logical = `openspec/changes/${name}/specs/${match[2]}`;
  } else if (change === undefined) return null;
  if (kind !== 'main-unchanged' && name === undefined) return null;
  const result = name === undefined
    ? buildMainSpecManifest([{ file, text }], hash)
    : buildSpecManifest(name, [{ file: logical, text }], hash);
  if (!result.manifest) return null;
  const matches = result.manifest.blocks.filter((block) => block.name === owner.name);
  if (matches.length !== 1) return null;
  const block = matches[0];
  if (kind !== 'main-unchanged' && block.op !== 'ADDED' && block.op !== 'MODIFIED') return null;
  const parsed = parseSpec(logical, text).value;
  const end = parsed.find((requirement) => requirement.line > block.startLine)?.line ?? Infinity;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const scenarios: string[] = [];
  let fence: string | null = null;
  for (let i = block.startLine; i < Math.min(end - 1, lines.length); i++) {
    const marker = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
    } else if (marker) fence = marker[1];
    else if (/^#### Scenario:/.test(lines[i])) scenarios.push(lines[i].slice('#### Scenario:'.length).trim());
  }
  if (scenarios.length !== block.scenarios || !unique(scenarios) || scenarios.some((scenario) => !scenario)) return null;
  return { file, name: block.name, block: `sha256:${block.sha256}`, scenarios };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Structure and owner binding only. Actor authority and fresh test evidence are checked by later stages. */
export function checkInitialBaselineStructure(input: unknown, context: {
  original: readonly Document[]; anchor: readonly Document[]; sha256Hex: Hash;
}): { baseline: ApprovedBaseline | null; sha256: string | null; adoptionsVerified: false; problems: string[] } {
  const rejected = (problems: string[]) => ({ baseline: null, sha256: null, adoptionsVerified: false as const, problems });
  const decoded = decodeInitialBaseline(input);
  if (!decoded.baseline) return rejected(decoded.problems);
  const original = reconstructOriginalContracts(context.original, context.sha256Hex);
  const scope = reconstructOriginalScope(context.original, context.sha256Hex);
  const index = original.index, originalScope = scope.scope;
  if (!index || !originalScope) return rejected([...original.problems, ...scope.problems]);
  const baseline = decoded.baseline;
  const problems: string[] = [];
  if (baseline.originalIndexSha256 !== index.sha256) problems.push('初回基準の原契約 index が一致しません');
  if (!same(baseline.counts, originalScope.counts)) problems.push('初回基準の固定件数が一致しません');
  const rows = new Map(baseline.rows.map((row) => [row.key, row]));
  if (baseline.rows.length !== index.contracts.length || rows.size !== baseline.rows.length
    || baseline.rows.some((row) => !index.contracts.some((contract) => contract.key === row.key))) {
    problems.push('初回基準の47 identityに欠落・追加・重複があります');
  }
  const texts = new Map<string, string>();
  for (const document of context.anchor) {
    if (!isSafeRepoPath(document.file) || texts.has(document.file)) problems.push('基準側の仕様 path が不正か重複しています');
    texts.set(document.file, document.text);
  }
  const resolved = new Map<BaselineRow['key'], OwnerBlock[]>();
  for (const contract of index.contracts) {
    const row = rows.get(contract.key);
    if (!row) continue;
    const { ref, path, line, name, scenarios } = contract.original;
    if (!same(row.original, { ref, path, line, name, scenarios })) problems.push(`原契約の記録が変わっています：${row.key}`);
    if (!row.adoption.length || !unique(row.adoption.map(canonicalJson))) problems.push(`所有内容の採否が空か重複しています：${row.key}`);
    if (!row.tests.length || !unique(row.tests.map(identity))
      || !contract.original.sources.every((source) => row.tests.some((test) => test.name.includes(`[${source}]`)))) {
      problems.push(`要件ID付きの試験が無いか試験参照が重複しています：${row.key}`);
    }
    if (!row.owners.length || !unique(row.owners.map((owner) => canonicalJson([owner.kind, owner.change ?? null, owner.file, owner.name])))) {
      problems.push(`所有先が空か重複しています：${row.key}`);
    }
    const blocks: OwnerBlock[] = [];
    for (const owner of row.owners) {
      const text = texts.get(owner.file);
      const actual = text === undefined ? null : ownerBlock(owner, text, context.sha256Hex);
      if (!actual || actual.block !== owner.block || !same(actual.scenarios, owner.scenarios)) {
        problems.push(`所有先の本文・Scenario・種類が一致しません：${row.key} ${owner.file}`);
      } else blocks.push(actual);
    }
    resolved.set(row.key, blocks);
    const mappings = row.scenarioMap.map((mapping) => mapping.original);
    if (!unique(mappings) || !same([...mappings].sort(), [...scenarios].sort())) problems.push(`原Scenarioの対応に欠落・追加・重複があります：${row.key}`);
    for (const mapping of row.scenarioMap) {
      if (mapping.status === 'superseded' && !mapping.by?.length) problems.push(`置換したScenarioの採否がありません：${row.key} ${mapping.original}`);
      if (mapping.current === null && mapping.status !== 'superseded' && !(mapping.status === 'kept' && row.open?.length)) {
        problems.push(`現Scenario・置換の採否・保持する未対応のいずれもありません：${row.key} ${mapping.original}`);
      }
      if (mapping.status === 'kept' && mapping.current && mapping.current.scenario !== mapping.original) {
        problems.push(`保持したScenarioの名前が一致しません：${row.key} ${mapping.original}`);
      }
    }
    if (row.supersessions?.some((entry) => !entry.by.length)) problems.push(`置換した句の採否がありません：${row.key}`);
    if (row.open && !unique(row.open.map(canonicalJson))) problems.push(`未対応の句が重複しています：${row.key}`);
  }
  for (const row of baseline.rows) {
    if (row.supplements && !unique(row.supplements.map(canonicalJson))) problems.push(`補完参照が重複しています：${row.key}`);
    const available = [...(resolved.get(row.key) ?? [])];
    for (const supplement of row.supplements ?? []) {
      const matches = (resolved.get(supplement.key) ?? []).filter((owner) => owner.scenarios.includes(supplement.scenario));
      if (!matches.length) problems.push(`補完する契約かScenarioがありません：${row.key} ${supplement.key}`);
      available.push(...matches.map((owner) => ({ ...owner, scenarios: [supplement.scenario] })));
    }
    for (const mapping of row.scenarioMap) {
      const current = mapping.current;
      if (current && !available.some((owner) => owner.file === current.file && owner.name === current.name && owner.scenarios.includes(current.scenario))) {
        problems.push(`Scenarioの対応先を所有先・補完から照合できません：${row.key} ${mapping.original}`);
      }
    }
  }
  for (const key of ['verify/modified/REQ-038', 'verify/modified/REQ-042'] as const) {
    if (!rows.get(key)?.open?.length) problems.push(`初回基準に公開側の未対応が残されていません：${key}`);
  }
  const unchanged = rows.get('verify/modified/REQ-042')?.owners;
  if (unchanged?.length !== 1 || unchanged[0].kind !== 'main-unchanged'
    || unchanged[0].file !== 'openspec/specs/verify/spec.md') problems.push('REQ-042のunchanged所有先が保持されていません');
  const dual = rows.get('reference-docs/modified/REQ-324')?.owners;
  if (dual?.length !== 2 || !same(dual.map((owner) => owner.change).sort(), ['verify-v2-evidence', 'verify-v2-scope'])) {
    problems.push('REQ-324のscope・evidenceの両所有先が保持されていません');
  }
  const numbers = baseline.cross.map((condition) => condition.no);
  if (numbers.length !== originalScope.cross.length || !unique(numbers.map(String))) problems.push('16横断条件に欠落・追加・重複があります');
  for (const expected of originalScope.cross) {
    const actual = baseline.cross.find((condition) => condition.no === expected.no);
    if (!actual || !same({ no: actual.no, title: actual.title, group: actual.group, rows: actual.rows }, expected)) {
      problems.push(`原横断条件の記録が変わっています：${expected.no}`);
    }
    if (!actual?.tests.length || !unique(actual.tests.map(identity))) problems.push(`横断条件の試験が無いか重複しています：${expected.no}`);
  }
  if (problems.length) return rejected(problems);
  return { baseline: freeze(baseline), sha256: `sha256:${context.sha256Hex(canonicalJson(baseline))}`, adoptionsVerified: false, problems };
}
