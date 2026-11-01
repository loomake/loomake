import { canonicalJson, isSafeRepoPath } from './canonical.js';
import type { AdoptionRef, ApprovedBaseline, BaselineOwner, BaselineRow, TestRef } from './baseline-types.js';

const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const digest = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v);
const contentHash = (v: unknown): v is string => typeof v === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(v);
const change = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const path = (v: unknown): v is string => typeof v === 'string' && isSafeRepoPath(v);
const list = <T>(v: unknown, check: (v: unknown) => v is T): v is T[] => Array.isArray(v) && v.every(check);
const object = (v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
  && required.every((key) => Object.hasOwn(v, key))
  && Object.keys(v).every((key) => required.includes(key) || optional.includes(key));
const key = (v: unknown): v is BaselineRow['key'] => typeof v === 'string'
  && /^.+\/(added|modified)\/REQ-\d{3,}$/.test(v) && isSafeRepoPath(v);
const refs = (v: unknown): v is AdoptionRef[] => list(v, adoptionRef);

function adoptionRef(v: unknown): v is AdoptionRef {
  if (object(v, ['trace'])) return object(v.trace, ['change', 'id']) && change(v.trace.change) && text(v.trace.id);
  if (object(v, ['comment'])) return object(v.comment, ['id', 'pr', 'bodySha256'])
    && positive(v.comment.id) && positive(v.comment.pr) && contentHash(v.comment.bodySha256);
  return object(v, ['prBody']) && object(v.prBody, ['pr', 'line', 'sha256'])
    && positive(v.prBody.pr) && positive(v.prBody.line) && contentHash(v.prBody.sha256);
}

function testRef(v: unknown): v is TestRef {
  return object(v, ['file', 'name']) && path(v.file) && text(v.name);
}

function owner(v: unknown): v is BaselineOwner {
  return object(v, ['kind', 'file', 'name', 'block', 'scenarios'], ['change'])
    && ['delta', 'main-unchanged', 'archived'].includes(v.kind as string)
    && (!Object.hasOwn(v, 'change') || change(v.change)) && path(v.file) && text(v.name)
    && digest(v.block) && list(v.scenarios, text);
}

function row(v: unknown): v is BaselineRow {
  if (!object(v, ['key', 'original', 'owners', 'scenarioMap', 'adoption', 'tests'], ['supplements', 'supersessions', 'open'])) return false;
  return key(v.key)
    && object(v.original, ['ref', 'path', 'line', 'name', 'scenarios'])
    && v.original.ref === 'bb88fe238ab0254e34d25dd8caeb19e8d0155cc4' && path(v.original.path)
    && positive(v.original.line) && text(v.original.name) && list(v.original.scenarios, text)
    && list(v.owners, owner) && list(v.scenarioMap, (s): s is BaselineRow['scenarioMap'][number] =>
      object(s, ['original', 'current', 'status'], ['by']) && text(s.original)
      && (s.current === null || (object(s.current, ['file', 'name', 'scenario'])
        && path(s.current.file) && text(s.current.name) && text(s.current.scenario)))
      && ['kept', 'renamed', 'moved', 'superseded'].includes(s.status as string)
      && (!Object.hasOwn(s, 'by') || refs(s.by)))
    && (!Object.hasOwn(v, 'supplements') || list(v.supplements, (s): s is NonNullable<BaselineRow['supplements']>[number] =>
      object(s, ['key', 'scenario']) && key(s.key) && text(s.scenario)))
    && (!Object.hasOwn(v, 'supersessions') || list(v.supersessions, (s): s is NonNullable<BaselineRow['supersessions']>[number] =>
      object(s, ['clause', 'by']) && text(s.clause) && refs(s.by)))
    && (!Object.hasOwn(v, 'open') || list(v.open, (s): s is NonNullable<BaselineRow['open']>[number] =>
      object(s, ['clause', 'owner']) && text(s.clause) && ['parent-1.2', 'parent-1.3'].includes(s.owner as string)))
    && refs(v.adoption) && list(v.tests, testRef);
}

/** Private initial data only. This does not validate adoption authority or test execution. */
export function decodeInitialBaseline(input: unknown): { baseline: ApprovedBaseline | null; problems: string[] } {
  let value: unknown;
  try { value = JSON.parse(canonicalJson(input)) as unknown; }
  catch { return { baseline: null, problems: ['初回基準には副作用のない JSON 値だけを使用してください'] }; }
  if (!object(value, ['version', 'originalIndexSha256', 'counts', 'rows', 'cross']) || value.version !== 1
    || !digest(value.originalIndexSha256) || !object(value.counts, ['contracts', 'scenarios', 'uniqueSources', 'cross'])
    || value.counts.contracts !== 47 || value.counts.scenarios !== 158 || value.counts.uniqueSources !== 46 || value.counts.cross !== 16
    || !list(value.rows, row) || !list(value.cross, (c): c is ApprovedBaseline['cross'][number] =>
      object(c, ['no', 'title', 'group', 'rows', 'tests']) && positive(c.no) && text(c.title)
      && ['G1', 'G2', 'G3', 'G4'].includes(c.group as string) && list(c.rows, key) && list(c.tests, testRef))) {
    return { baseline: null, problems: ['初回基準の形・未知欄・固定件数が一致しません'] };
  }
  return { baseline: value as ApprovedBaseline, problems: [] };
}
