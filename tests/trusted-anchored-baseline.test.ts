import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { DOCUMENT_LIMITS } from '../packages/kit/src/runtime/input.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { checkAnchoredC001Record, checkAnchoredInitialBaseline } from '../packages/kit/src/verify/trusted/anchored-baseline.js';
import { checkInitialBaselineStructure } from '../packages/kit/src/verify/trusted/baseline.js';
import { checkBaselineRecord } from '../packages/kit/src/verify/trusted/baseline-record.js';
import type { ApprovedBaseline } from '../packages/kit/src/verify/trusted/baseline-types.js';
import { C001_INITIAL_BASELINE_PIN as pin, C001_VERIFICATION_FILE } from '../packages/kit/src/verify/trusted/c001-baseline.js';
import type { GitDocument } from '../packages/kit/src/verify/trusted/git-objects.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { reconstructOriginalContracts } from '../packages/kit/src/verify/trusted/original-contracts.js';

const { parseDocument } = createRequire(new URL('../packages/kit/package.json', import.meta.url))('yaml') as {
  parseDocument(text: string): { toJS(options: { maxAliasCount: number }): { expected_spec: ApprovedBaseline } };
};
let raw: GitDocument[], text: string, baseline: ApprovedBaseline;
let context: Parameters<typeof checkInitialBaselineStructure>[1];
beforeAll(() => {
  const git = (args: string[], input?: string) => execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', ...args],
    { input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: DOCUMENT_LIMITS.maxTotalBytes });
  const decode = (bytes: Buffer) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const head = decode(git(['rev-parse', 'HEAD'])).trim(); expect(head).toMatch(/^[a-f0-9]{40}$/);
  const record = decode(git(['cat-file', 'blob', `${head}:${C001_VERIFICATION_FILE}`]));
  baseline = parseDocument(record).toJS({ maxAliasCount: 100 }).expected_spec;
  const owners = [...new Set(baseline.rows.flatMap(row => row.owners.map(owner => owner.file)))];
  const paths = [ORIGINAL_C001_SNAPSHOT_DIR, C001_VERIFICATION_FILE, ...owners];
  const listing = decode(git(['ls-tree', '-rz', '--full-tree', head, '--', ...paths]));
  expect(listing.endsWith('\0')).toBe(true);
  const rows = listing.slice(0, -1).split('\0').map(row => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row); expect(match).not.toBeNull();
    const [, mode, oid, file] = match!;
    expect(paths.some(path => file === path || file.startsWith(`${path}/`))).toBe(true);
    expect(file.split('/').length - 1).toBeLessThanOrEqual(DOCUMENT_LIMITS.maxDepth);
    return { file, oid, mode: mode as GitDocument['mode'] };
  });
  expect(rows.length).toBeLessThanOrEqual(DOCUMENT_LIMITS.maxEntries);
  expect(new Set(rows.map(row => row.file)).size).toBe(rows.length);
  const output = git(['cat-file', '--batch'], rows.map(row => row.oid).join('\n') + '\n');
  let offset = 0, total = 0;
  const documents = rows.map(row => {
    const newline = output.indexOf(10, offset); expect(newline).toBeGreaterThanOrEqual(offset);
    const header = /^([a-f0-9]{40}) blob (\d+)$/.exec(output.subarray(offset, newline).toString('ascii'));
    expect(header).not.toBeNull(); expect(header![1]).toBe(row.oid);
    const size = Number(header![2]), start = newline + 1, end = start + size;
    expect(Number.isSafeInteger(size)).toBe(true); expect(size).toBeLessThanOrEqual(DOCUMENT_LIMITS.maxFileBytes);
    total += size; expect(total).toBeLessThanOrEqual(DOCUMENT_LIMITS.maxTotalBytes);
    expect(end).toBeLessThan(output.length); expect(output[end]).toBe(10); offset = end + 1;
    return { ...row, text: decode(output.subarray(start, end)) };
  });
  expect(offset).toBe(output.length);
  const find = (file: string) => { const value = documents.find(document => document.file === file); expect(value).toBeDefined(); return value!; };
  raw = documents.filter(document => document.file.startsWith(`${ORIGINAL_C001_SNAPSHOT_DIR}/`));
  const original = verifyOriginalSnapshot(raw, sha256Hex); expect(original.problems).toEqual([]);
  text = find(C001_VERIFICATION_FILE).text; expect(text).toBe(record);
  const anchor = owners.map(file => ({ file, text: find(file).text }));
  context = { original: original.documents!, anchor, sha256Hex };
});
const rejected = (result: ReturnType<typeof checkAnchoredInitialBaseline>) => {
  expect(result).toMatchObject({ baseline: null, sha256: null, adoptionsVerified: false }); expect(result.problems.length).toBeGreaterThan(0);
};
const changedFirst = (edit: (file: GitDocument) => GitDocument) => [edit({ ...raw[0] }), ...raw.slice(1)];

describe('原本確認済み私的入口（S1接続・Git来歴の合格ではない）', () => {
  it('[REQ-389] T-ANC-01 実記録の固定値と凍結・原集合・入力を保ち、原本順を変えても同じ結果にする', () => {
    const before = JSON.stringify({ raw, baseline, anchor: context.anchor }), low = checkBaselineRecord(text, context, pin);
    expect(low.problems).toEqual([]);
    for (const files of [raw, [...raw].reverse()]) {
      expect(checkAnchoredC001Record(text, files, context.anchor)).toEqual(low);
      expect(checkAnchoredInitialBaseline(baseline, files, context.anchor)).toEqual(checkInitialBaselineStructure(baseline, context));
    }
    expect(low.sha256).toBe('sha256:b0db0a585ca07991dec271e216f6cbb3a394022a6d0a5202720de6a5f615cac2');
    expect(low.baseline!.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
    const frozen = (v: unknown): boolean => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozen));
    expect(frozen(low.baseline)).toBe(true); expect(low.adoptionsVerified).toBe(false);
    expect(JSON.stringify({ raw, baseline, anchor: context.anchor })).toBe(before);
    expect(Object.isFrozen(Object.prototype)).toBe(false); expect(Object.isFrozen(Array.prototype)).toBe(false);
  });
  it('[REQ-389] T-ANC-02 改変原本と追従indexが旧構造では成功しても新入口は拒否する', () => {
    const files = changedFirst(file => ({ ...file, text: file.text.replace('SHALL', 'SHALX') }));
    expect(files[0].text).not.toBe(raw[0].text); expect(Buffer.byteLength(files[0].text)).toBe(Buffer.byteLength(raw[0].text));
    const original = context.original.map((doc, i) => i ? doc : { ...doc, text: files[0].text });
    const candidate = structuredClone(baseline); candidate.originalIndexSha256 = reconstructOriginalContracts(original, sha256Hex).index!.sha256;
    expect(checkInitialBaselineStructure(candidate, { ...context, original }).problems).toEqual([]);
    const result = checkAnchoredInitialBaseline(candidate, files, context.anchor); rejected(result);
    expect(result.problems.join(' ')).toContain('全バイト・mode・blobが一致しません');
  });
  it('[REQ-389] T-ANC-03 indexと固定PINが変わらないEOF改変も新記録入口は拒否する', () => {
    const files = changedFirst(file => ({ ...file, text: file.text + '\n' }));
    const original = context.original.map((doc, i) => i ? doc : { ...doc, text: files[0].text });
    expect(checkBaselineRecord(text, { ...context, original }, pin).problems).toEqual([]);
    rejected(checkAnchoredC001Record(text, files, context.anchor));
  });
  it.each([
    ['欠落', () => raw.slice(1)], ['追加', () => [...raw, { ...raw[0], file: `${ORIGINAL_C001_SNAPSHOT_DIR}/unknown/spec.md` }]],
    ['重複', () => [...raw, raw[0]]], ['mode', () => changedFirst(file => ({ ...file, mode: '100755' }))],
    ['blob', () => changedFirst(file => ({ ...file, oid: '0'.repeat(40) }))],
    ['CRLF', () => changedFirst(file => ({ ...file, text: file.text.replaceAll('\n', '\r\n') }))],
    ['BOM', () => changedFirst(file => ({ ...file, text: '\uFEFF' + file.text }))],
    ['同長本文', () => changedFirst(file => ({ ...file, text: file.text.replace('SHALL', 'SHALX') }))],
  ] as const)('[REQ-389] T-ANC-04 %sでは候補より原本の不一致を優先し問題を混ぜない', (_name, mutate) => {
    const files = mutate(), problems = verifyOriginalSnapshot(files, sha256Hex).problems;
    for (const result of [checkAnchoredInitialBaseline({}, files, context.anchor), checkAnchoredC001Record('expected_spec: [', files, context.anchor)]) {
      rejected(result); expect(result.problems).toEqual(problems); expect(result.problems.join(' ')).not.toContain('初回基準');
    }
  });
  it('[REQ-389] T-ANC-05 原本確認後は構造・固定値・YAMLの既存の日本語問題を保持する', () => {
    const candidate = structuredClone(baseline); candidate.rows.pop();
    const structure = checkInitialBaselineStructure(candidate, context); rejected(structure);
    expect(checkAnchoredInitialBaseline(candidate, raw, context.anchor)).toEqual(structure);
    const record = structuredClone(baseline); record.rows[0].adoption = [{ trace: { change: 'different', id: 'Q-OTHER' } }];
    for (const input of [JSON.stringify({ expected_spec: record }), 'expected_spec: [']) {
      const low = checkBaselineRecord(input, context, pin); rejected(low);
      expect(checkAnchoredC001Record(input, raw, context.anchor)).toEqual(low);
    }
  });
  it('[REQ-389] T-ANC-06 APIは候補・原文書・所有文書だけを受け、hash/PIN/論理原本を引数にしない', () => {
    expectTypeOf(checkAnchoredInitialBaseline).parameters.toEqualTypeOf<[unknown, readonly GitDocument[], typeof context.anchor]>();
    expectTypeOf(checkAnchoredC001Record).parameters.toEqualTypeOf<[string, readonly GitDocument[], typeof context.anchor]>();
    expect(checkAnchoredInitialBaseline.length).toBe(3); expect(checkAnchoredC001Record.length).toBe(3);
  });
  it.each(['structure', 'record'] as const)('[REQ-389] T-ANC-07 %s入口は各欄を一度だけ取得し照合成功値と同じ値を後段へ渡す', kind => {
    const reads: Record<keyof GitDocument, number> = { file: 0, text: 0, oid: 0, mode: 0 }, first = { ...raw[0] };
    for (const key of Object.keys(reads) as (keyof GitDocument)[]) Object.defineProperty(first, key, { enumerable: true, get: () => {
      reads[key]++; return key === 'text' && reads[key] > 1 ? raw[0].text.replace('SHALL', 'SHALX') : raw[0][key];
    } });
    const result = kind === 'structure' ? checkAnchoredInitialBaseline(baseline, [first, ...raw.slice(1)], context.anchor)
      : checkAnchoredC001Record(text, [first, ...raw.slice(1)], context.anchor);
    expect(result).toEqual(checkBaselineRecord(text, context, pin));
    expect(reads).toEqual({ file: 1, text: 1, oid: 1, mode: 1 });
  });
});
