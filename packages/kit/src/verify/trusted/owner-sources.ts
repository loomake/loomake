import { checkInitialBaselineStructure, ownerBlock } from './baseline.js';
import { C001_OWNER_SOURCE_EXCEPTIONS } from './c001-baseline.js';
import { canonicalJson } from './canonical.js';
import type { ContractKey } from './original-contracts.js';

export type OwnerSourceBinding = Readonly<{
  key: ContractKey; file: string; name: string; capability: string;
  sources: readonly string[]; exception: Readonly<{ change: string; id: string }> | null;
}>;
/** C001 only. Supplied-document comparison; Git provenance, actors, trace rows and fresh executions remain unverified. */
export function checkC001OwnerSources(input: unknown, context: Parameters<typeof checkInitialBaselineStructure>[1]): {
  bindings: readonly OwnerSourceBinding[] | null; adoptionsVerified: false; problems: string[];
} {
  const rejected = (problems: string[]) => ({ bindings: null, adoptionsVerified: false as const, problems });
  const checked = checkInitialBaselineStructure(input, context);
  if (!checked.baseline) return rejected(checked.problems);
  const texts = new Map(context.anchor.map(d => [d.file, d.text])), used = new Set<number>();
  const bindings: OwnerSourceBinding[] = [], problems: string[] = [];
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  for (const row of checked.baseline.rows) {
    const parts = row.key.split('/'), source = parts.at(-1) ?? ''; const capability = parts.slice(0, -2).join('/');
    let hasOriginal = false;
    for (const owner of row.owners) {
      const text = texts.get(owner.file);
      const actual = text === undefined ? null : ownerBlock(owner, text, context.sha256Hex);
      if (!actual) return rejected([`所有先の本文を再照合できません：${row.key} ${owner.file}`]);
      const actualCapability = /^openspec\/(?:specs|changes\/[^/]+\/specs)\/(.+)\/spec\.md$/.exec(actual.logical)?.[1];
      if (actualCapability !== capability) problems.push(`所有先のcapabilityが原契約と一致しません：${row.key} ${owner.file}`);
      let exception: OwnerSourceBinding['exception'] = null;
      if (actual.sources.includes(source)) hasOriginal = true;
      else {
        const index = C001_OWNER_SOURCE_EXCEPTIONS.findIndex(e => e.key === row.key && e.kind === owner.kind
          && e.file === owner.file && e.name === owner.name && e.block === owner.block
          && same(e.scenarios, actual.scenarios) && same(e.sources, actual.sources));
        if (index < 0) problems.push(`原Sourceを持たない所有先に固定した根拠がありません：${row.key} ${owner.file} ${owner.name}`);
        else {
          used.add(index); exception = C001_OWNER_SOURCE_EXCEPTIONS[index].decision;
          for (const id of actual.sources) if (!row.tests.some(test => test.name.includes(`[${id}]`))) {
            problems.push(`固定した追加所有先のSourceのID付き試験がありません：${row.key} ${id}`);
          }
        }
      }
      bindings.push(Object.freeze({ key: row.key, file: owner.file, name: owner.name, capability,
        sources: Object.freeze([...actual.sources]), exception }));
    }
    if (!hasOriginal) problems.push(`原Sourceを持つ所有先がありません：${row.key}`);
  }
  C001_OWNER_SOURCE_EXCEPTIONS.forEach((e, i) => {
    if (!used.has(i)) problems.push(`固定した追加所有先が初回基準にありません：${e.key} ${e.file}`);
  });
  return problems.length ? rejected(problems) : { bindings: Object.freeze(bindings), adoptionsVerified: false, problems };
}
