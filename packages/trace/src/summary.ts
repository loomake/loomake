import { createHash } from 'node:crypto';
/** 要約拡張だけの同期意味検証。旧 Evidence の検証と I/O は呼出元が担う。 */
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const attempt = (v: unknown): v is string => typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
const oneOf = (v: unknown, choices: string[]): boolean => typeof v === 'string' && choices.includes(v);
const named = (v: unknown): v is Record<string, unknown> => object(v) && nonempty(v.name) && nonempty(v.version);
const COUNTS = ['passed', 'failed', 'skipped', 'todo', 'pending', 'other'];

/** summaryVersion のない記録は解釈せず、未知欄をそのまま残す（REQ-460/461）。 */
export function summaryProblem(value: unknown): string | undefined {
  if (!object(value) || !Object.hasOwn(value, 'summaryVersion')) return undefined;
  if (value.schemaVersion !== 2 || value.summaryVersion !== 1) return '要約拡張の版に対応していません';
  if (!oneOf(value.role, ['development', 'release'])) return '要約のroleが不正です';
  const nullable = new Map<string, unknown>([['ci', value.ci], ['request', value.request], ['observation', value.observation]]);
  if (value.ci !== null && (!object(value.ci) || !nonempty(value.ci.runId) || !/^\d+$/.test(value.ci.runId)
    || !attempt(value.ci.runAttempt) || value.ci.source !== 'environment')) return '要約のCI識別が不正です';
  if (value.request !== null || value.observation !== null) return '要約の要求か観測の欄が不正です';
  const e = value.execution;
  if (!object(e) || typeof e.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(e.id)
    || !oneOf(e.origin, ['local', 'github-actions']) || !named(e.evaluator) || e.evaluator.name !== '@loomake/trace'
    || !hash(e.basisSha256) || !object(e.environment) || !['node', 'platform', 'arch'].every((k) => nonempty(e.environment && (e.environment as Record<string, unknown>)[k]))
    || !date(e.startedAt) || !date(e.finishedAt) || Date.parse(e.startedAt) > Date.parse(e.finishedAt)
    || e.verification !== 'executed') return '要約の実行条件が不正です';
  if (e.producer !== null && !named(e.producer)) return '要約の生成器が不正です';
  nullable.set('execution.producer', e.producer);
  const c = e.commands;
  if (!object(c) || !oneOf(c.source, ['loomake.config.json', 'defaults']) || (c.sha256 !== null && !hash(c.sha256))) return '要約のコマンド参照が不正です';
  if (c.source === 'defaults' ? c.sha256 !== null : !hash(c.sha256)) return '要約の設定出典とハッシュが合いません';
  if (c.nameRefs !== null && (!Array.isArray(c.nameRefs) || !c.nameRefs.every((n) => object(n) && hash(n.nameSha256)
    && (n.knownName === undefined || (typeof n.knownName === 'string' && ['lint', 'typecheck', 'test'].includes(n.knownName) && createHash('sha256').update(n.knownName).digest('hex') === n.nameSha256))))) return '要約のコマンド名参照が不正です';
  nullable.set('execution.commands.sha256', c.sha256);
  nullable.set('execution.commands.nameRefs', c.nameRefs);
  if (!Array.isArray(value.artifacts)) return '要約の本体参照が配列ではありません';
  if (value.artifacts.length === 0) nullable.set('artifacts', null);
  else nullable.set('artifacts', value.artifacts);
  for (const [i, a] of value.artifacts.entries()) {
    if (!object(a) || a.kind !== 'test-report' || !nonempty(a.path) || !hash(a.sha256) || !count(a.bytes)
      || !object(a.sameRun) || !oneOf(a.sameRun.status, ['verified', 'unverified'])) return '要約の本体参照が不正です';
    if (a.sameRun.status === 'unverified' && !nonempty(a.sameRun.reason)) return '未照合の本体に理由がありません';
    if (a.counts !== null && (!object(a.counts) || !COUNTS.every((k) => count((a.counts as Record<string, unknown>)[k])))) return '要約の観測件数が不正です';
    if ((a.sameRun.status === 'verified') !== (a.counts !== null)) return '本体の照合状態と観測件数が合いません';
    if (a.location !== null) {
      const l = a.location;
      if (!object(l) || l.type !== 'github-actions-artifact' || !nonempty(l.repository) || !nonempty(l.runId) || !/^\d+$/.test(l.runId)
        || !attempt(l.runAttempt) || !nonempty(l.artifactName) || !nonempty(l.entry) || !date(l.createdAt)) return '本体の保存先が不正です';
    }
    if (a.expiresAt !== null && !date(a.expiresAt)) return '本体の実保存期限が不正です';
    if (a.retrieval !== null && (!object(a.retrieval) || !date(a.retrieval.checkedAt)
      || !oneOf(a.retrieval.access, ['project-members', 'owner']) || a.retrieval.sha256Matched !== true)) return '本体の取得照合が不正です';
    if (!oneOf(a.availability, ['not-uploaded', 'uploaded', 'retrieved'])) return '本体の取得状態が不正です';
    if (a.availability === 'not-uploaded' ? a.location !== null || a.expiresAt !== null || a.retrieval !== null
      : a.location === null || (a.availability === 'retrieved' ? a.retrieval === null : a.retrieval !== null)) return '本体の取得状態と参照が合いません';
    if (value.role === 'release' && (a.location === null || a.retrieval === null)) return '固定用の要約に取得照合済みの本体参照がありません';
    for (const k of ['counts', 'location', 'expiresAt', 'retrieval']) nullable.set(`artifacts[${i}].${k}`, a[k]);
  }
  if (!Array.isArray(value.gaps)) return '要約の未確認理由が配列ではありません';
  const seen = new Set<string>();
  for (const g of value.gaps) {
    if (!object(g) || !nonempty(g.field) || !oneOf(g.kind, ['unverified', 'not_applicable']) || !nonempty(g.reason)) return '要約の未確認理由が不正です';
    if (!nullable.has(g.field)) continue; // 将来の未知欄に対する説明は解釈しない。
    if (nullable.get(g.field) !== null || seen.has(g.field)) return '要約の未確認理由が重複しているか値のある欄に付いています';
    seen.add(g.field);
  }
  if ([...nullable].some(([field, v]) => v === null && !seen.has(field))) return '要約のnull欄に対応する未確認理由がありません';
  return undefined;
}
