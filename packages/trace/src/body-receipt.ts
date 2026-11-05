import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join, resolve } from 'node:path';
import type { BodyReceipt } from '@loomake/core';
import { JSON_LIMITS, maskValue, UsageError } from '@loomake/kit';
import { EVIDENCE_SHA } from './evidence.js';
import { publishEvidence } from './publication.js';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const count = (v: unknown): boolean => Number.isSafeInteger(v) && (v as number) >= 0;
const digits = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v);
const attempt = (v: unknown): v is string => digits(v) && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
const sha = (v: unknown): boolean => typeof v === 'string' && EVIDENCE_SHA.test(v);
const ci = (v: unknown): boolean => object(v) && digits(v.runId) && attempt(v.runAttempt);
const problem = '本体参照receiptの形式が不正です';

/** UTCの実在時刻。Date.parseによる月末の繰上げを受理しない。 */
export function receiptUtc(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value.slice(0, 19);
}
export function receiptRelativePath(value: unknown): value is string {
  return text(value) && !/[\\:\u0000]/.test(value) && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}
export function receiptSummaryPath(value: unknown, change?: string): value is string {
  if (!receiptRelativePath(value)) return false;
  const match = /^\.loomake\/evidence\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(\d{8}T\d{6}Z)-[a-f0-9]{12}\.json$/.exec(value);
  return !!match && (change === undefined || match[1] === change) && receiptStamp(match[2]);
}
export function receiptStamp(value: string): boolean {
  return /^\d{8}T\d{6}Z$/.test(value) && receiptUtc(value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
}
export const receiptEntryHash = (entry: string): string => createHash('sha256').update(entry, 'utf8').digest('hex').slice(0, 8);

/** 共有maskで安全なJSONを複製し、値やown keyを変更した場合は拒否する。 */
function receiptJson(value: unknown): string {
  const masked = maskValue(value);
  if (!isDeepStrictEqual(value, masked)) throw new Error(problem);
  const json = JSON.stringify(masked, null, 2) + '\n';
  const pending: unknown[] = [masked];
  while (pending.length) {
    const child = pending.pop();
    if (child === undefined) throw new Error(problem);
    if (child !== null && typeof child === 'object') pending.push(...Object.values(child));
  }
  return json;
}
function inspect(value: unknown): string | undefined {
  if (!object(value) || value.indexVersion !== 1) return problem;
  const { body: b, summary: s, locator: l, archive: a, execution: e, artifact: f, retrieval: r, gaps } = value;
  if (!object(b) || b.kind !== 'test-report' || !hash(b.sha256) || !count(b.bytes)) return problem;
  if (!object(s) || !text(s.change) || !receiptSummaryPath(s.path, s.change) || !hash(s.sha256) || !count(s.bytes) || !sha(s.sha) || !ci(s.ci)) return problem;
  if (!object(l) || l.type !== 'github-actions-artifact' || !text(l.repository) || !text(l.artifactName)
    || !digits(l.artifactId) || !receiptRelativePath(l.entry) || !ci(l)) return problem;
  if (!object(a) || !hash(a.sha256) || !count(a.bytes) || typeof a.apiDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(a.apiDigest)) return problem;
  if (!object(e) || !sha(e.checkoutSha) || (e.workflowHeadSha !== null && !sha(e.workflowHeadSha)) || !ci(e)) return problem;
  if (!object(f) || !receiptUtc(f.createdAt) || !receiptUtc(f.expiresAt)) return problem;
  if (!object(r) || !receiptUtc(r.retrievedAt) || r.method !== 'github-api-authenticated-read'
    || r.accessPolicy !== 'project-members' || r.policyVerified !== false || !Array.isArray(gaps)) return problem;
  const required = new Set(['retrieval.accessPolicy', ...(e.workflowHeadSha === null ? ['execution.workflowHeadSha'] : [])]);
  const seen = new Set<string>();
  for (const g of gaps) {
    if (!object(g) || !text(g.field) || !['unverified', 'not_applicable'].includes(String(g.kind)) || typeof g.kind !== 'string'
      || !text(g.reason) || !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(g.reason)) return problem;
    if (!['retrieval.accessPolicy', 'execution.workflowHeadSha'].includes(g.field)) continue;
    if (!required.has(g.field) || seen.has(g.field) || g.kind !== 'unverified') return problem;
    seen.add(g.field);
  }
  return seen.size === required.size ? undefined : problem;
}
/** 入力内容やcauseを返さない同期検証（REQ-470）。 */
export function bodyReceiptProblem(value: unknown): string | undefined {
  try { return inspect(JSON.parse(receiptJson(value))); } catch { return problem; }
}

/** root以下の各親を検査し、リンクをたどらず保存先を作る。 */
export function receiptDirectories(root: string, relative: string, create = false): void {
  const check = (path: string) => { const stats = lstatSync(path); if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(problem); };
  let path = root; check(path);
  for (const part of relative.split('/')) {
    path = join(path, part);
    if (create) {
      try { mkdirSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    } else {
      try { check(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    }
    check(path);
  }
}
/** 取得した事実の時刻で追加する。同名衝突はfalse、入力・I/Oの拒否は安全なUsageError。 */
export function appendBodyReceipt(root: string, receipt: BodyReceipt): boolean {
  try {
    if (!text(root) || root.includes('\0')) throw new Error(problem);
    const json = receiptJson(receipt);
    if (Buffer.byteLength(json, 'utf8') > JSON_LIMITS.maxFileBytes || inspect(JSON.parse(json))) throw new Error(problem);
    const value = JSON.parse(json) as BodyReceipt;
    const directory = `.loomake/evidence/_index/body/${value.body.sha256}`;
    const stamp = new Date(value.retrieval.retrievedAt).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const file = `${stamp}-${value.locator.artifactId}-${receiptEntryHash(value.locator.entry)}.json`;
    const absolute = resolve(root); receiptDirectories(absolute, directory, true);
    return publishEvidence(join(absolute, directory, file), json);
  } catch { throw new UsageError('本体参照receiptを追加できません。入力と保存先を確認してください。'); }
}
