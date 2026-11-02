import { parseSpec } from '@loomake/core';
import { canonicalJson } from './canonical.js';
import { buildSpecManifest } from './spec-manifest.js';

export const ORIGINAL_C001_REF = 'bb88fe238ab0254e34d25dd8caeb19e8d0155cc4' as const;
export type ContractKey = `${string}/${'added' | 'modified'}/REQ-${string}`;
export type OriginalContract = {
  key: ContractKey;
  original: {
    ref: typeof ORIGINAL_C001_REF; path: string; line: number; name: string;
    sources: string[]; scenarios: string[]; block: string;
  };
};
export type OriginalContractIndex = {
  ref: typeof ORIGINAL_C001_REF;
  counts: { contracts: number; scenarios: number; uniqueSources: number };
  contracts: OriginalContract[];
  sha256: string;
};

// core の非公開 helper を import せず、parseSpec と同じ fence 規則で名前を読む。
// 各 block の Scenario 件数も parseSpec と照合し、解釈の相違を成功にしない。
function scenarioLines(lines: string[]): { line: number; name: string }[] {
  let fence: string | null = null;
  const found: { line: number; name: string }[] = [];
  lines.forEach((line, i) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return;
    }
    if (marker) { fence = marker[1]; return; }
    if (/^#### Scenario:/.test(line)) found.push({ line: i + 1, name: line.slice('#### Scenario:'.length).trim() });
  });
  return found;
}

/** caller が A に固定した原文書（出典 bb88）を照合し、対象側の台帳とは独立に原47契約を復元する。 */
export function reconstructOriginalContracts(files: readonly { file: string; text: string }[], sha256Hex: (text: string) => string):
  { index: OriginalContractIndex | null; problems: string[] } {
  const parsed = buildSpecManifest('verify-v2-c001', files, sha256Hex);
  if (!parsed.manifest) return { index: null, problems: parsed.problems };
  const manifest = parsed.manifest;
  const textByFile = new Map(files.map((file) => [file.file, file.text]));
  const contracts: OriginalContract[] = [];
  const problems: string[] = [];
  for (const file of manifest.files) {
    const text = textByFile.get(file.file);
    if (text === undefined) { problems.push(`原仕様がありません：${file.file}`); continue; }
    const requirements = parseSpec(file.file, text).value;
    const names = scenarioLines(text.replace(/\r\n?/g, '\n').split('\n'));
    for (let i = 0; i < requirements.length; i++) {
      const requirement = requirements[i];
      const { op, sources, line, name } = requirement;
      if ((op !== 'ADDED' && op !== 'MODIFIED') || sources.length !== 1) {
        problems.push(`原契約の種類か Source が不正です：${file.file}:${line}`); continue;
      }
      const nextLine = requirements[i + 1]?.line ?? Infinity;
      const scenarios = names.filter((scenario) => scenario.line >= line && scenario.line < nextLine).map((scenario) => scenario.name);
      if (scenarios.length !== requirement.scenarios || scenarios.some((scenario) => scenario.length === 0)
        || new Set(scenarios).size !== scenarios.length) {
        problems.push(`原 Scenario の名前と件数が一致しません：${file.file}:${line}`); continue;
      }
      const block = manifest.blocks.find((block) => block.file === file.file && block.startLine === line);
      if (!block) { problems.push(`原契約の本文を照合できません：${file.file}:${line}`); continue; }
      const capability = file.file.slice('openspec/changes/verify-v2-c001/specs/'.length, -'/spec.md'.length);
      contracts.push({ key: `${capability}/${op === 'ADDED' ? 'added' : 'modified'}/${sources[0]}` as ContractKey,
        original: { ref: ORIGINAL_C001_REF, path: file.file, line, name, sources: [...sources], scenarios, block: `sha256:${block.sha256}` } });
    }
  }
  contracts.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const counts = { contracts: contracts.length, scenarios: contracts.reduce((sum, row) => sum + row.original.scenarios.length, 0),
    uniqueSources: new Set(contracts.flatMap((row) => row.original.sources)).size };
  if (new Set(contracts.map((row) => row.key)).size !== contracts.length) problems.push('原契約の identity が重複しています');
  if (counts.contracts !== 47 || counts.scenarios !== 158 || counts.uniqueSources !== 46) {
    problems.push(`原契約の件数が一致しません：${counts.contracts}契約・${counts.scenarios} Scenario・${counts.uniqueSources} Source`);
  }
  if (problems.length) return { index: null, problems };
  const body = { ref: ORIGINAL_C001_REF, counts, contracts };
  return { index: { ...body, sha256: `sha256:${sha256Hex(canonicalJson(body))}` }, problems };
}
