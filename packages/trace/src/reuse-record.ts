import { CHANGE_ID, maskSecrets, UsageError } from '@loomake/kit';

export const REUSE_RECORD_VERSION = 1;
export type ReuseRecord = {
  reuseVersion: 1; change: string; verification: 'integrity-only'; qualityCommands: 'not-run';
  source: { sha: string; summary: { path: string; oid: string; sha256: string; runId: string; runAttempt: string } };
  target: { sha: string };
  range: { commits: string[]; entries: { commit: string; path: string; oid: string }[] };
  anchor: { source: 'caller-file'; authenticity: 'unverified' };
  evaluator: { name: '@loomake/trace'; version: string };
  environment: { node: string; platform: string; arch: string };
  checkedAt: string;
};
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const BAD = '再利用の記録の形が不正です';
const SAVE_ERROR = '再利用の記録を保存できません。記録する値（change-id を含むパス、評価器と実行環境の版）に秘密情報の形があるか、記録の形が不正です。記録していません。';
/** 既知欄のown dataだけを読む。未知の欄やgetterには触れない。 */
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(BAD);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(BAD);
  return value as Record<string, unknown>;
}
function own(value: unknown, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(object(value), key);
  if (!d || !('value' in d)) throw new Error(BAD);
  return d.value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new Error(BAD);
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value as number;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !('value' in d)) throw new Error(BAD);
    result.push(d.value);
  }
  return result;
}
/** 型が確定するまで変換や正規表現を使わない。返すのは内部で構築した既知欄だけ。 */
function knownRecord(value: unknown, change: string): ReuseRecord {
  if (typeof change !== 'string' || !CHANGE_ID.test(change) || change === 'archive') throw new Error(BAD);
  const strings: string[] = [];
  const string = (v: unknown): string => { if (typeof v !== 'string' || v.length === 0) throw new Error(BAD); strings.push(v); return v; };
  const text = (v: unknown, key: string) => string(own(v, key));
  const literal = <T extends string>(v: unknown, key: string, expected: T): T => { if (text(v, key) !== expected) throw new Error(BAD); return expected; };
  const sha = (v: unknown): string => { const s = string(v); if (!SHA.test(s)) throw new Error(BAD); return s; };
  const source = own(value, 'source'); const summary = own(source, 'summary'); const target = own(value, 'target');
  const range = own(value, 'range'); const anchor = own(value, 'anchor'); const evaluator = own(value, 'evaluator'); const environment = own(value, 'environment');
  if (typeof own(value, 'reuseVersion') !== 'number' || own(value, 'reuseVersion') !== 1) throw new Error(BAD);
  const record: ReuseRecord = {
    reuseVersion: 1, change: text(value, 'change'), verification: literal(value, 'verification', 'integrity-only'), qualityCommands: literal(value, 'qualityCommands', 'not-run'),
    source: { sha: sha(own(source, 'sha')), summary: { path: text(summary, 'path'), oid: sha(own(summary, 'oid')), sha256: text(summary, 'sha256'), runId: text(summary, 'runId'), runAttempt: text(summary, 'runAttempt') } },
    target: { sha: sha(own(target, 'sha')) },
    range: { commits: array(own(range, 'commits')).map(sha), entries: array(own(range, 'entries')).map((entry) => ({ commit: sha(own(entry, 'commit')), path: text(entry, 'path'), oid: sha(own(entry, 'oid')) })) },
    anchor: { source: literal(anchor, 'source', 'caller-file'), authenticity: literal(anchor, 'authenticity', 'unverified') },
    evaluator: { name: literal(evaluator, 'name', '@loomake/trace'), version: text(evaluator, 'version') },
    environment: { node: text(environment, 'node'), platform: text(environment, 'platform'), arch: text(environment, 'arch') }, checkedAt: text(value, 'checkedAt'),
  };
  const s = record.source; const t = record.target; const commits = record.range.commits; const entries = record.range.entries;
  const pattern = new RegExp(`^\\.loomake/evidence/${change}/(?:reuse/)?\\d{8}T\\d{6}Z-[a-f0-9]{12}\\.json$`);
  if (record.change !== change
    || s.sha === t.sha || s.sha.length !== t.sha.length || !commits.length || new Set(commits).size !== commits.length || commits.at(-1) !== t.sha
    || commits.some((c) => c.length !== s.sha.length) || !entries.length || new Set(entries.map((e) => e.path)).size !== entries.length
    || entries.some((e) => !commits.includes(e.commit) || !pattern.test(e.path) || e.oid.length !== s.sha.length)
    || s.summary.oid.length !== s.sha.length || !new RegExp(`^\\.loomake/evidence/${change}/\\d{8}T\\d{6}Z-${s.sha.slice(0, 12)}\\.json$`).test(s.summary.path)
    || !entries.some((e) => e.path === s.summary.path && e.oid === s.summary.oid)
    || !/^[a-f0-9]{64}$/.test(s.summary.sha256) || !/^\d+$/.test(s.summary.runId)
    || !/^[1-9]\d*$/.test(s.summary.runAttempt) || !Number.isSafeInteger(Number(s.summary.runAttempt))
    || !/^\d{4}-\d{2}-\d{2}T/.test(record.checkedAt) || !Number.isFinite(Date.parse(record.checkedAt))) throw new Error(BAD);
  if (strings.some((s) => maskSecrets(s) !== s)) throw new Error('記録する値が秘密情報の形に当たります');
  return record;
}
/** I/Oなし。未知欄を変えず、accessorを呼ばず、どの入力でも例外を出さない。 */
export function reuseRecordProblem(value: unknown, change: string): string | undefined {
  try { knownRecord(value, change); return undefined; }
  catch (error) {
    try { return error instanceof Error && [BAD, '記録する値が秘密情報の形に当たります'].includes(error.message) ? error.message : '再利用の記録を読めません'; }
    catch { return '再利用の記録を読めません'; }
  }
}
/** 保存には内部で組み立てた既知欄だけを使い、未知欄を取り込まない。 */
export function serializeReuseRecord(record: ReuseRecord): string {
  try {
    const known = knownRecord(record, record.change);
    const text = JSON.stringify(known, null, 2) + '\n';
    if (Buffer.byteLength(text) > 64 * 1024 * 1024 || reuseRecordProblem(JSON.parse(text), known.change)) throw new Error(BAD);
    return text;
  } catch { throw new UsageError(SAVE_ERROR); }
}
