import { existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Evidence, EvidenceSummary, VerifyScope } from '@loomake/core';
import { assertChangeId, basisHash, checkFixedSummary, createGitEvidenceReader, DOCUMENT_LIMITS,
  isAbortedResult, loadConfig, maskSecrets, maskValue, readEvidenceRange, readInputBytes, runExternal, UsageError, verifyExitCode,
  type FixedSummaryProblemCode, type EvidenceRangeReasonCode, type GitBlobText, type QualitySchemaLike } from '@loomake/kit';
import { changedDocuments, readDocuments } from './documents.js';
import { evidenceProblem } from './evidence.js';
import { recordEvidence } from './record.js';
import { commandsReference, rawHash, traceVersion } from './summary-record.js';
import { publishEvidence } from './publication.js';
import { reuseRecordProblem, serializeReuseRecord, type ReuseRecord } from './reuse-record.js';
export type ReuseOptions = {
  root: string; changeId: string; summaryPath: string; anchorPath: string;
  stdout: (text: string) => void; progress?: (text: string) => void; json?: boolean; scope?: VerifyScope; qualitySchema?: QualitySchemaLike;
  now?: () => Date; env?: NodeJS.ProcessEnv;
};
export type ReuseOutcome = 'reused' | 'revalidated' | 'returned-to-human' | 'stopped';
export type ReuseReasonCode = FixedSummaryProblemCode | EvidenceRangeReasonCode
  | 'ANCHOR_UNREADABLE' | 'ANCHOR_IN_REPOSITORY' | 'PRIMARY_MISSING' | 'PRIMARY_NOT_REGULAR' | 'PRIMARY_TOO_LARGE' | 'PRIMARY_NOT_UTF8'
  | 'PRIMARY_OTHER_CHANGE' | 'PRIMARY_INVALID' | 'PRIMARY_ROLE' | 'PRIMARY_NAME_MISMATCH' | 'PRIMARY_IN_SOURCE'
  | 'SUMMARY_NOT_PASSING' | 'ENTRY_INVALID' | 'LEGACY_EVIDENCE_IN_RANGE' | 'OTHER_EVIDENCE_NOT_PASSING'
  | 'ENVIRONMENT_MISMATCH' | 'EVALUATOR_MISMATCH' | 'COMMANDS_MISMATCH' | 'BASIS_MISMATCH' | 'DOCUMENTS_MISMATCH'
  | 'WORKTREE_DIRTY' | 'STATE_CHANGED' | 'RECORD_EXISTS';
export type ReuseReason = { code: ReuseReasonCode; message: string; path?: string; commit?: string; field?: string };
export type ReuseResult = {
  resultVersion: 1; outcome: ReuseOutcome; exitCode: number; reasons: ReuseReason[]; source: string | null; target: string;
  record: { path: string } | null; verifyExitCode: number | null;
};
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const stamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
function git(root: string, args: string[]): string {
  const r = runExternal('git', ['--no-replace-objects', '--literal-pathspecs', '-C', root, ...args], { maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new UsageError('git に失敗しました。Git のリポジトリの中で実行してください');
  return r.stdout.trim();
}
function inside(parent: string, file: string): boolean {
  const path = relative(parent, file);
  return path === '' || path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(path);
}
function readAnchor(file: string, top: string, common: string): { bytes: Buffer; value: unknown } | ReuseReason {
  try {
    const canonical = realpathSync.native(file);
    if (inside(top, canonical) || inside(common, canonical)) return { code: 'ANCHOR_IN_REPOSITORY', message: '信頼値はリポジトリと git common dir の外に置いてください' };
    const bytes = readInputBytes(file, DOCUMENT_LIMITS);
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return { bytes, value: JSON.parse(text) };
  } catch { return { code: 'ANCHOR_UNREADABLE', message: '外部の信頼値を読めません' }; }
}
function safeDirectories(root: string, change: string): void {
  let dir = root;
  for (const part of ['.loomake', 'evidence', change, 'reuse']) {
    dir = join(dir, part);
    try { const s = lstatSync(dir); if (!s.isDirectory() || s.isSymbolicLink()) throw new UsageError('再利用の記録の保存先は通常のディレクトリにしてください'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error instanceof UsageError ? error : new UsageError('再利用の記録の保存先を確認できません'); }
  }
}
/** 整合性だけの再利用と、実際の再検証への切替えを同期で行う。 */
export function runReuse(options: ReuseOptions): ReuseResult {
  const { changeId, summaryPath } = options; const root = resolve(options.root);
  assertChangeId(changeId); const config = loadConfig(root); const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) throw new UsageError('対象の active な change がありません');
  const prefix = `.loomake/evidence/${changeId}/`;
  if (typeof summaryPath !== 'string' || !summaryPath.startsWith(prefix) || !/^\d{8}T\d{6}Z-[a-f0-9]{12}\.json$/.test(summaryPath.slice(prefix.length))) throw new UsageError('--summary には対象 change の正規名の要約のパスを指定してください');
  if (typeof options.anchorPath !== 'string' || options.anchorPath.length === 0) throw new UsageError('--anchor <file> が必要です');
  const target = git(root, ['rev-parse', 'HEAD']); if (!SHA.test(target)) throw new UsageError('HEAD の完全な小文字の SHA を確認できません');
  const top = realpathSync.native(git(root, ['rev-parse', '--show-toplevel']));
  const common = realpathSync.native(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  let source: string | null = null;
  const progress = options.progress ?? (() => {});
  const reason = (code: ReuseReasonCode, message: string): ReuseReason => ({ code, message });
  const emitReasons = (reasons: ReuseReason[], output = options.json ? progress : options.stdout) => { for (const r of reasons) output(maskSecrets(`${r.code}: ${r.message}${r.path ? `（${r.path}）` : ''}${r.field ? ` ${r.field}` : ''}`)); };
  const finish = (outcome: ReuseOutcome, reasons: ReuseReason[], exitCode = 1, record: ReuseResult['record'] = null, verifyCode: number | null = null): ReuseResult => {
    const result: ReuseResult = { resultVersion: 1, outcome, exitCode, reasons, source, target, record, verifyExitCode: verifyCode };
    if (options.json) options.stdout(JSON.stringify(maskValue(result)));
    else { emitReasons(reasons); options.stdout(maskSecrets(`${outcome}${record ? `: ${record.path}` : ''}`)); if (outcome === 'reused') options.stdout('品質コマンドは実行していません。品質の合格や CI の最終合格を表しません'); }
    return result;
  };
  const human = (r: ReuseReason) => finish('returned-to-human', [r]);
  const dirty = () => git(root, ['status', '--porcelain', '--untracked-files=all']) !== '';
  if (dirty()) return finish('stopped', [reason('WORKTREE_DIRTY', '作業ツリーに未コミットの変更があります')]);
  const documents = readDocuments(changeDir); const commands = commandsReference(root);
  const anchorFile = resolve(root, options.anchorPath); const anchor = readAnchor(anchorFile, top, common);
  if ('code' in anchor) return human(anchor);
  const reader = createGitEvidenceReader(root); const tree = reader.treeEntry(target, summaryPath);
  if (tree.kind !== 'found') return human(reason('PRIMARY_MISSING', 'target の要約を読めません'));
  if (tree.type !== 'blob' || tree.mode !== '100644') return human(reason('PRIMARY_NOT_REGULAR', '要約は通常のblobではありません'));
  const primary = reader.readText(tree.oid);
  if (!primary.ok) return human(reason(primary.code === 'BLOB_TOO_LARGE' ? 'PRIMARY_TOO_LARGE' : primary.code === 'BLOB_NOT_UTF8' ? 'PRIMARY_NOT_UTF8' : 'PRIMARY_MISSING', '要約を正しいUTF-8のJSONとして読めません'));
  const fixed = checkFixedSummary(primary.text, anchor.value);
  const anchorValue = anchor.value as { sha: string; summarySha256: string; runId: string; runAttempt: string };
  if (fixed.reasons[0]?.code !== 'TRUST_MISSING' && typeof anchorValue.sha === 'string' && SHA.test(anchorValue.sha)) source = anchorValue.sha;
  if (!fixed.reusable) return human(fixed.reasons[0]);
  if (typeof anchorValue.sha !== 'string' || !SHA.test(anchorValue.sha)) return human(reason('TRUST_MISSING', '信頼値のSHAが不正です'));
  source = anchorValue.sha;
  const value: unknown = JSON.parse(primary.text);
  if ((value as { change?: unknown }).change !== changeId) return human(reason('PRIMARY_OTHER_CHANGE', '要約のchangeが対象と違います'));
  if (evidenceProblem(value, changeId) || !Object.hasOwn(value as object, 'summaryVersion')) return human(reason('PRIMARY_INVALID', '要約の形が不正です'));
  const summary = value as EvidenceSummary;
  const ci = summary.ci;
  if (ci === null) return human(reason('PRIMARY_INVALID', '要約のCI識別がありません'));
  if (summary.role !== 'development') return human(reason('PRIMARY_ROLE', 'development の要約だけを利用できます'));
  if (!summaryPath.endsWith(`-${source.slice(0, 12)}.json`)) return human(reason('PRIMARY_NAME_MISMATCH', '要約のファイル名とsourceのSHAが違います'));
  if (reader.treeEntry(source, summaryPath).kind === 'found') return human(reason('PRIMARY_IN_SOURCE', '要約はsourceに既にあります'));
  const reasons: ReuseReason[] = [];
  if (summary.verify.run.status !== 'completed' || summary.verify.run.errors.length !== 0 || summary.verify.scope !== 'ci'
    || summary.verify.verdict !== 'PASS' || summary.verify.decision.required || verifyExitCode(summary.verify) !== 0) reasons.push(reason('SUMMARY_NOT_PASSING', '要約はciの最終合格ではありません'));
  const range = readEvidenceRange({ repository: root, source, target, changeId });
  if (!range.allowed) reasons.push(...range.reasons);
  else {
    if (!range.entries.some((e) => e.path === summaryPath && e.oid === tree.oid)) return human(reason('PRIMARY_MISSING', '要約が範囲の追加entryにありません'));
    const cache = new Map<string, GitBlobText>([[tree.oid, primary]]);
    for (const entry of range.entries) {
      if (entry.path === summaryPath && entry.oid === tree.oid) continue;
      let blob = cache.get(entry.oid); if (!blob) { blob = reader.readText(entry.oid); cache.set(entry.oid, blob); }
      let code: ReuseReasonCode | undefined;
      if (!blob.ok) { code = blob.code === 'BLOB_TOO_LARGE' ? 'RANGE_TOO_LARGE' : 'ENTRY_INVALID'; }
      else {
        try {
          const other: unknown = JSON.parse(blob.text);
          if (entry.kind === 'reuse') {
            if (reuseRecordProblem(other, changeId)) code = 'ENTRY_INVALID';
            else if (!entry.path.endsWith(`-${(other as ReuseRecord).target.sha.slice(0,12)}.json`)) code = 'ENTRY_INVALID';
          } else if (evidenceProblem(other, changeId)) code = 'ENTRY_INVALID';
          else {
            const evidence = other as Evidence;
            if (!entry.path.endsWith(`-${evidence.sha.slice(0,12)}.json`)) code = 'ENTRY_INVALID';
            else if (evidence.schemaVersion === 1) code = 'LEGACY_EVIDENCE_IN_RANGE';
            else if (isAbortedResult(evidence.verify) || verifyExitCode(evidence.verify) !== 0) code = 'OTHER_EVIDENCE_NOT_PASSING';
          }
        } catch { code = 'ENTRY_INVALID'; }
      }
      if (code) reasons.push({ code, message: '範囲の証跡を再利用の条件に適合すると確認できません', path: entry.path, commit: entry.commit });
      if (code === 'RANGE_TOO_LARGE') break;
    }
  }
  for (const field of ['node', 'platform', 'arch'] as const) if (summary.execution.environment[field] !== (field === 'node' ? process.version : process[field])) reasons.push({ code: 'ENVIRONMENT_MISMATCH', message: '実行環境が違います', field });
  if (summary.execution.evaluator.version !== traceVersion()) reasons.push(reason('EVALUATOR_MISMATCH', '評価器の版が違います'));
  if (summary.execution.commands.source !== commands.source || summary.execution.commands.sha256 !== commands.sha256) reasons.push(reason('COMMANDS_MISMATCH', '品質コマンド設定の出典かハッシュが違います'));
  const basis = basisHash(root, changeDir);
  if (summary.execution.basisSha256 !== basis) reasons.push(reason('BASIS_MISMATCH', '検証の基準が違います'));
  if (!summary.documents || changedDocuments(summary.documents, documents).length) reasons.push(reason('DOCUMENTS_MISMATCH', '要件の文書が違います'));
  const endAnchor = readAnchor(anchorFile, top, common);
  let changed = 'code' in endAnchor || rawHash(endAnchor.bytes) !== rawHash(anchor.bytes);
  if (git(root, ['rev-parse', 'HEAD']) !== target || dirty()) changed = true;
  try {
    const endCommands = commandsReference(root);
    if (changedDocuments(documents, readDocuments(changeDir)).length || endCommands.source !== commands.source
      || endCommands.sha256 !== commands.sha256 || basisHash(root, changeDir) !== basis) changed = true;
  } catch (error) { if (!(error instanceof UsageError)) throw error; changed = true; }
  if (changed) return finish('stopped', [
    reason('STATE_CHANGED', '判定のあいだにHEAD・作業ツリー・文書・設定・基準・信頼値が変わりました'),
  ]);
  if (reasons.length) {
    emitReasons(reasons);
    let verifyCode: number | null = null;
    const record = recordEvidence({ root, changeId, scope: options.scope, qualitySchema: options.qualitySchema,
      env: options.env, now: options.now, stdout: (text) => (options.json ? progress : options.stdout)(maskSecrets(text)),
      progress: (text) => progress(maskSecrets(text)), onVerify: (v) => { verifyCode = verifyExitCode(v); } });
    return finish('revalidated', reasons, record.code, record.path ? { path: record.path } : null, record.verified ? verifyCode : null);
  }
  if (!range.allowed) throw new UsageError('再利用の範囲を確認できません');
  const now = (options.now ?? (() => new Date()))();
  const record: ReuseRecord = { reuseVersion: 1, change: changeId, verification: 'integrity-only', qualityCommands: 'not-run',
    source: { sha: source, summary: { path: summaryPath, oid: tree.oid, sha256: anchorValue.summarySha256,
      runId: ci.runId, runAttempt: ci.runAttempt } },
    target: { sha: target }, range: { commits: [...range.commits], entries: range.entries.map(({ commit, path, oid }) => ({ commit, path, oid })) },
    anchor: { source: 'caller-file', authenticity: 'unverified' }, evaluator: { name: '@loomake/trace', version: traceVersion() },
    environment: { node: process.version, platform: process.platform, arch: process.arch }, checkedAt: now.toISOString() };
  const serialized = serializeReuseRecord(record);
  safeDirectories(root, changeId);
  const path = `.loomake/evidence/${changeId}/reuse/${stamp(now)}-${target.slice(0,12)}.json`;
  if (!publishEvidence(join(root, path), serialized)) return finish('stopped', [reason('RECORD_EXISTS', '同じ名前の再利用の記録が既にあります')]);
  return finish('reused', [], 0, { path });
}
