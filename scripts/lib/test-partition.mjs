import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const PARTITION_PLATFORMS = ['linux', 'darwin', 'win32'];
const FILE_PATTERN = /^(?:tests|packages\/[a-z0-9-]+\/test)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.test\.ts$/;
/** @typedef {{ files: Record<string, { cases: Record<string, string[]> }> }} Partition */

/** 試験の分割一覧の誤り。 */
export class PartitionError extends Error {}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed, label) {
  if (!object(value)) throw new PartitionError(`${label} はオブジェクトにしてください`);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new PartitionError(`${label} に知らない項目があります：${unknown.join('、')}`);
}

/** 元ファイルに対応する slow companion のパス。 */
export function companionOf(file) {
  return file.replace(/\.test\.ts$/, '.slow.test.ts');
}

/**
 * 分割一覧を検査する。case の本体や実行順は変更しない。
 * @param {unknown} data
 * @param {{ exists: (file: string) => boolean }} options
 * @returns {Partition}
 */
export function validatePartition(data, { exists }) {
  keys(data, ['files'], 'tests/test-partition.json');
  if (!Object.hasOwn(data, 'files') || !object(data.files)) throw new PartitionError('tests/test-partition.json に files オブジェクトが必要です');
  for (const [file, entry] of Object.entries(data.files)) {
    if (!FILE_PATTERN.test(file) || file.split('/').includes('..') || file.endsWith('.slow.test.ts')) {
      throw new PartitionError(`分割する元ファイルは tests/ か packages/<name>/test/ の下の .test.ts にしてください：${file}`);
    }
    for (const path of [file, companionOf(file)]) if (!exists(path)) throw new PartitionError(`試験の分割一覧のファイルがありません：${path}`);
    keys(entry, ['cases'], file);
    if (!Object.hasOwn(entry, 'cases') || !object(entry.cases) || Object.keys(entry.cases).length === 0) throw new PartitionError(`${file}.cases に case を1件以上登録してください`);
    for (const [id, platforms] of Object.entries(entry.cases)) {
      if (!id || !Array.isArray(platforms) || platforms.some((p) => !PARTITION_PLATFORMS.includes(p)) || new Set(platforms).size !== platforms.length) {
        throw new PartitionError(`${file}.cases.${id} は linux・darwin・win32 の重複しない配列にしてください`);
      }
    }
  }
  return /** @type {Partition} */ (data);
}

/** @returns {Partition} */
export function loadPartition(root) {
  let data;
  try { data = JSON.parse(readFileSync(join(root, 'tests/test-partition.json'), 'utf8')); }
  catch (error) { throw new PartitionError(`tests/test-partition.json を読めません：${error.message}`); }
  return validatePartition(data, { exists: (file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile() });
}

/** 登録した case を fast と slow のどちらへ登録するか。未知の実行 OS は fast。 */
export function includeCase(registry, file, part, id, platform = process.platform) {
  if (part !== 'fast' && part !== 'slow') throw new PartitionError(`試験の分割先が不正です：${part}`);
  if (!Object.hasOwn(registry.files, file) || !Object.hasOwn(registry.files[file].cases, id)) throw new PartitionError(`試験の分割一覧に未登録の case です：${file} / ${id}`);
  const slow = registry.files[file].cases[id].includes(platform);
  return part === 'slow' ? slow : !slow;
}

/** @param {Partition} registry */
export function partitionFiles(registry, platform = process.platform) {
  const companions = [], fastExclude = [], slowInclude = [];
  for (const [file, { cases }] of Object.entries(registry.files)) {
    const allocations = Object.values(cases).map((platforms) => platforms.includes(platform));
    companions.push(companionOf(file));
    if (allocations.every(Boolean)) fastExclude.push(file);
    if (allocations.some(Boolean)) slowInclude.push(companionOf(file));
  }
  return { companions, fastExclude, slowInclude };
}

/** 現行の whole-file 隔離と case 分割を混ぜない。 */
export function assertNotPartitioned(files, registry) {
  const registered = new Set(Object.keys(registry.files).flatMap((file) => [file, companionOf(file)]));
  for (const file of files) if (registered.has(file)) throw new PartitionError(`${file} は試験の分割一覧（tests/test-partition.json）に載っているため隔離できません`);
}
