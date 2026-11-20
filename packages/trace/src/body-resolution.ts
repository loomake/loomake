import { lstatSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { BodyReceipt, EvidenceSummary, QualityEvidencePolicy } from '@loomake/core';
import { artifactRetention, checkBodyReceipt, createInputReader, JSON_LIMITS, readInputBytes, UsageError, type ArtifactRetentionResult } from '@loomake/kit';
import { bodyReceiptProblem, receiptDirectories, receiptEntryHash, receiptStamp, receiptSummaryPath, receiptUtc } from './body-receipt.js';
import { evidenceProblem } from './evidence.js';

export type BodyResolutionStatus = 'invalid-index' | 'mismatch' | 'not-indexed' | 'resolved';
export type BodyArtifactResolution = {
  body: BodyReceipt['body']; status: BodyResolutionStatus; locators: BodyReceipt['locator'][]; paths: string[];
  retention: ({ path: string } & ArtifactRetentionResult)[]; access: 'unverified'; reason: string;
};
export type BodyResolution = { status: BodyResolutionStatus; reason: string; artifacts: BodyArtifactResolution[] };
export type BodyResolutionOptions = { root: string; summaryPath: string; policy: QualityEvidencePolicy; now: string };
const priority: Record<BodyResolutionStatus, number> = { resolved: 0, 'not-indexed': 1, mismatch: 2, 'invalid-index': 3 };
const reasons: Record<BodyResolutionStatus, string> = {
  resolved: '固定要約と索引の結び付けが一致しました。実取得・真正性・品質合格と閲覧権限は未確認です',
  'not-indexed': '本体参照の索引がなく、取得先を確認できません',
  mismatch: '固定要約と本体参照の結び付けを確認できません',
  'invalid-index': '索引の形式・整合性・読取り予算を確認できません',
};
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function validPolicy(v: unknown): v is QualityEvidencePolicy {
  return object(v) && ['artifact_retention', 'long_term_retention'].every((k) => typeof v[k] === 'string' && /^[1-9][0-9]*[dwy]$/.test(v[k]))
    && ['github-release', 'manual'].includes(String(v.long_term_store)) && typeof v.long_term_store === 'string'
    && ['project-members', 'owner'].includes(String(v.access)) && typeof v.access === 'string'
    && ['owner-approval', 'never'].includes(String(v.delete_policy)) && typeof v.delete_policy === 'string';
}
function argumentsFor(options: BodyResolutionOptions): BodyResolutionOptions {
  try {
    if (!object(options) || typeof options.root !== 'string' || !options.root.length || options.root.includes('\0')
      || !receiptSummaryPath(options.summaryPath) || !receiptUtc(options.now) || !validPolicy(options.policy)) throw new Error();
    const root = resolve(options.root), stats = lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error();
    return { root, summaryPath: options.summaryPath, now: options.now, policy: options.policy };
  } catch { throw new UsageError('本体参照の解決引数が不正です。ルート・要約パス・保持方針・日時を確認してください。'); }
}
const locatorKey = (r: BodyReceipt) => JSON.stringify([r.locator.repository, r.locator.artifactId, r.locator.entry]);
function candidateName(path: string, directory: string, receipt: BodyReceipt): boolean {
  const name = relative(directory, path);
  const match = /^(\d{8}T\d{6}Z)-(\d+)-([a-f0-9]{8})\.json$/.exec(name);
  return !!match && receiptStamp(match[1]) && match[2] === receipt.locator.artifactId && match[3] === receiptEntryHash(receipt.locator.entry);
}
const mark = (result: BodyArtifactResolution, status: BodyResolutionStatus) => {
  if (priority[status] > priority[result.status]) result.status = status;
};

/** 同期の索引解決。保持方針・nowは明示し、ファイルも固定要約も変更しない（REQ-471）。 */
export function resolveArtifactBody(options: BodyResolutionOptions): BodyResolution {
  const { root, summaryPath, policy, now } = argumentsFor(options);
  const reader = createInputReader(JSON_LIMITS);
  let remaining = JSON_LIMITS.maxTotalBytes;
  const read = (file: string): Buffer => {
    if (remaining <= 0) throw new Error();
    try {
      const bytes = readInputBytes(file, { ...JSON_LIMITS, maxTotalBytes: remaining });
      remaining -= bytes.byteLength;
      return bytes;
    } catch (error) { remaining = 0; throw error; }
  };
  let summaryBytes: Buffer, summary: EvidenceSummary;
  try {
    receiptDirectories(root, dirname(summaryPath).split(sep).join('/'));
    summaryBytes = read(join(root, summaryPath));
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(summaryBytes));
    if (!object(value) || value.summaryVersion !== 1 || typeof value.change !== 'string' || evidenceProblem(value, value.change)) throw new Error();
    summary = value as EvidenceSummary;
  } catch { return { status: 'mismatch', reason: reasons.mismatch, artifacts: [] }; }
  const seen = new Map<string, { receipt: BodyReceipt; result: BodyArtifactResolution }[]>();
  const artifacts = summary.artifacts.map((body): BodyArtifactResolution => {
    const result: BodyArtifactResolution = { body: { kind: body.kind, sha256: body.sha256, bytes: body.bytes },
      status: 'resolved', locators: [], paths: [], retention: [], access: 'unverified', reason: '' };
    const directoryRelative = `.loomake/evidence/_index/body/${body.sha256}`;
    const directory = join(root, directoryRelative);
    const locators = new Set<string>();
    let paths: string[];
    try {
      receiptDirectories(root, directoryRelative);
      paths = reader.walk(directory).filter((p) => /\.json$/i.test(p)).sort();
    } catch { result.status = 'invalid-index'; return result; }
    if (!paths.length) { result.status = 'not-indexed'; return result; }
    for (const path of paths) {
      let receipt: BodyReceipt;
      try {
        const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(path)));
        if (bodyReceiptProblem(value)) throw new Error();
        receipt = value as BodyReceipt;
        if (receipt.body.sha256 !== body.sha256 || !candidateName(path, directory, receipt)) throw new Error();
      } catch { mark(result, 'invalid-index'); continue; }
      const receiptPath = relative(root, path).split(sep).join('/');
      result.paths.push(receiptPath);
      const ref = { location: { createdAt: receipt.artifact.createdAt }, expiresAt: receipt.artifact.expiresAt };
      result.retention.push({ path: receiptPath, ...artifactRetention(ref, policy.artifact_retention, now) });
      const key = locatorKey(receipt), previous = seen.get(key) ?? [];
      for (const other of previous) {
        if (!isDeepStrictEqual(other.receipt.body, receipt.body) || !isDeepStrictEqual(other.receipt.summary, receipt.summary)
          || other.receipt.artifact.expiresAt !== receipt.artifact.expiresAt) {
          mark(other.result, 'invalid-index'); mark(result, 'invalid-index');
        }
      }
      previous.push({ receipt, result }); seen.set(key, previous);
      if (!locators.has(key)) { locators.add(key); result.locators.push(receipt.locator); }
      if (receipt.summary.path !== summaryPath || !checkBodyReceipt(summaryBytes, receipt).matches) mark(result, 'mismatch');
    }
    return result;
  });
  for (const result of artifacts) result.reason = reasons[result.status];
  const status = artifacts.length ? artifacts.reduce<BodyResolutionStatus>((status, a) => priority[a.status] > priority[status] ? a.status : status, 'resolved') : 'not-indexed';
  return { status, reason: reasons[status], artifacts };
}
