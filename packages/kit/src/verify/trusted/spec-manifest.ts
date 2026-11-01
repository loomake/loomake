import { parseSpec, type SpecOperation } from '@loomake/core';
import { canonicalJson, isSafeRepoPath } from './canonical.js';

export type SpecBlock = {
  file: string; op: SpecOperation; name: string; from?: string;
  sources: string[]; scenarios: number; startLine: number; sha256: string;
};
export type SpecManifest = {
  version: 1; change: string; files: { file: string; sha256: string }[];
  blocks: SpecBlock[]; requiredSet: string[]; requiredSetHash: string; hash: string;
};
export type MainSpecManifest = {
  version: 1;
  files: SpecManifest['files'];
  blocks: (Omit<SpecBlock, 'op' | 'from'> & { op: null })[];
  hash: string;
};

const trimEnd = (lines: string[]): string => {
  let end = lines.length;
  while (end > 0 && /^\s*$/.test(lines[end - 1])) end--;
  return lines.slice(0, end).join('\n');
};
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

/** 公開 parser と同じ開始行から、Scenario・fence・改行のない EOF までを含める。 */
export function buildSpecManifest(change: string, files: readonly { file: string; text: string }[],
  sha256Hex: (text: string) => string): { manifest: SpecManifest | null; problems: string[] } {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(change)) return { manifest: null, problems: ['change の名前が不正です'] };
  const prefix = `openspec/changes/${change}/specs/`;
  const paths = new Set<string>();
  const summaries: SpecManifest['files'] = [];
  const blocks: SpecBlock[] = [];
  for (const { file, text } of [...files].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)) {
    if (!isSafeRepoPath(file) || !file.startsWith(prefix) || !file.endsWith('/spec.md')) {
      problems.push(`対象 change の差分仕様ではありません：${file}`); continue;
    }
    if (paths.has(file)) { problems.push(`仕様の path が重複しています：${file}`); continue; }
    paths.add(file);
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    summaries.push({ file, sha256: sha256Hex(trimEnd(lines)) });
    const parsed = parseSpec(file, text);
    problems.push(...parsed.errors.map((e) => `${file}:${e.line} ${e.message}`));
    const requirements = [...parsed.value].sort((a, b) => a.line - b.line);
    const identities = new Set<string>();
    for (let i = 0; i < requirements.length; i++) {
      const requirement = requirements[i];
      const { op, name, from, line, scenarios } = requirement;
      const identity = canonicalJson([op, name]);
      if (identities.has(identity)) problems.push(`Requirement が重複しています：${file} ${name}`);
      identities.add(identity);
      if (op === null || requirements[i + 1]?.line === line) {
        problems.push(`差分の種類か開始行が不正です：${file}:${line}`); continue;
      }
      const body = trimEnd(lines.slice(line - 1, requirements[i + 1] ? requirements[i + 1].line - 1 : lines.length));
      const reparsed = parseSpec(file, `## ${op} Requirements\n${body}`);
      const one = reparsed.value[0];
      const sources = uniqueSorted(requirement.sources);
      if (reparsed.errors.length || reparsed.value.length !== 1 || one.name !== name || one.op !== op || one.from !== from
        || one.scenarios !== scenarios || canonicalJson(uniqueSorted(one.sources)) !== canonicalJson(sources)) {
        problems.push(`Requirement の境界が一致しません：${file}:${line}`); continue;
      }
      blocks.push({ file, op, name, ...(from === undefined ? {} : { from }), sources, scenarios, startLine: line, sha256: sha256Hex(body) });
    }
  }
  if (problems.length) return { manifest: null, problems };
  const requiredSet = uniqueSorted(blocks.filter((b) => b.op === 'ADDED' || b.op === 'MODIFIED').flatMap((b) => b.sources));
  const body = { version: 1 as const, change, files: summaries, blocks };
  return { manifest: { ...body, requiredSet, requiredSetHash: sha256Hex(canonicalJson(requiredSet)), hash: sha256Hex(canonicalJson(body)) }, problems };
}

/** unchanged owner を主仕様から照合する。差分 manifest の op 必須条件とは分ける。 */
export function buildMainSpecManifest(files: readonly { file: string; text: string }[],
  sha256Hex: (text: string) => string): { manifest: MainSpecManifest | null; problems: string[] } {
  const problems: string[] = [];
  const paths = new Set<string>();
  const summaries: MainSpecManifest['files'] = [];
  const blocks: MainSpecManifest['blocks'] = [];
  for (const { file, text } of [...files].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)) {
    if (!isSafeRepoPath(file) || !/^openspec\/specs\/(?:[^/]+\/)+spec\.md$/.test(file)) {
      problems.push(`主仕様の path ではありません：${file}`); continue;
    }
    if (paths.has(file)) { problems.push(`主仕様の path が重複しています：${file}`); continue; }
    paths.add(file);
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    summaries.push({ file, sha256: sha256Hex(trimEnd(lines)) });
    const parsed = parseSpec(file, text);
    problems.push(...parsed.errors.map((e) => `${file}:${e.line} ${e.message}`));
    const requirements = [...parsed.value].sort((a, b) => a.line - b.line);
    const names = new Set<string>();
    for (let i = 0; i < requirements.length; i++) {
      const { op, name, from, line, scenarios, sources } = requirements[i];
      if (names.has(name)) problems.push(`主仕様の Requirement が重複しています：${file} ${name}`);
      names.add(name);
      if (op !== null || from !== undefined || requirements[i + 1]?.line === line) {
        problems.push(`主仕様に差分の種類か不正な開始行があります：${file}:${line}`); continue;
      }
      const body = trimEnd(lines.slice(line - 1, requirements[i + 1] ? requirements[i + 1].line - 1 : lines.length));
      const reparsed = parseSpec(file, body);
      const one = reparsed.value[0];
      if (reparsed.errors.length || reparsed.value.length !== 1 || one.name !== name || one.op !== null || one.from !== undefined
        || one.scenarios !== scenarios || canonicalJson(uniqueSorted(one.sources)) !== canonicalJson(uniqueSorted(sources))) {
        problems.push(`主仕様の Requirement の境界が一致しません：${file}:${line}`); continue;
      }
      blocks.push({ file, op: null, name, sources: uniqueSorted(sources), scenarios, startLine: line, sha256: sha256Hex(body) });
    }
  }
  if (problems.length) return { manifest: null, problems };
  const body = { version: 1 as const, files: summaries, blocks };
  return { manifest: { ...body, hash: sha256Hex(canonicalJson(body)) }, problems };
}
