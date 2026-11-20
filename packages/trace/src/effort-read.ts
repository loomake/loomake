import { resolve, join, posix } from 'node:path';
import {
  CHANGE_ID, DOCUMENT_LIMITS, loadConfig, InputReadFailure, UsageError, createByteInputReader, maskSecrets, resolveChangeDir,
  type ByteInputReader, type InputReader,
} from '@loomake/kit';
import { effortProblem } from './effort-input.js';
import { parseManualEffort } from './effort-manual.js';
import { EVIDENCE_DIR } from './record.js';
import type { EffortChangeRecords, EffortInputs, EffortLocation, EffortObservation, ManualEffortRecord } from './effort-types.js';

const MANUAL_DIR = 'docs/effort';
const EFFORT_FILE = /^(\d{8}T\d{6}Z)-([0-9a-f]{12})\.json$/;
const MAX_EFFORT_BYTES = 65536;
const strict = new TextDecoder('utf-8', { fatal: true });

type Evidence = Record<string, unknown> & { change: string; sha: string; recordedAt: string };

/** 同じ archive の一覧を何度も数えないよう、entries の結果を使い回す */
function memoizeEntries(reader: ByteInputReader): InputReader {
  const cache = new Map<string, ReturnType<InputReader['entries']>>();
  const entries: InputReader['entries'] = (dir, options) => {
    const hit = cache.get(dir);
    if (hit) return hit;
    const found = reader.entries(dir, options);
    cache.set(dir, found);
    return found;
  };
  return { ...reader, entries };
}

const stampOf = (recordedAt: string): string => new Date(recordedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

/** 名前と内容が食い違う理由。問題がなければ null */
function mismatch(name: string, dirName: string, value: Evidence): string | null {
  const [, stamp, hex] = EFFORT_FILE.exec(name) ?? [];
  if (effortProblem(value)) return `${name} の内容が Effort 1 の書式に合いません`;
  if (value.change !== dirName) return `${name} の change が置き場と一致しません`;
  if (stamp !== stampOf(value.recordedAt)) return `${name} の記録日時が名前と一致しません`;
  if (hex !== value.sha.toLowerCase().slice(0, 12)) return `${name} の SHA が名前と一致しません`;
  return null;
}

function observation(path: string, value: Evidence): EffortObservation {
  const amount = 'minutes' in value ? { minutes: value.minutes } : { totalMinutes: value.totalMinutes };
  const extra = (['decisions', 'attempts', 'cost'] as const).filter((key) => value[key] !== undefined).map((key) => [key, value[key]]);
  return { source: { path }, ...amount, ...Object.fromEntries(extra) } as EffortObservation;
}

function parseEvidence(reader: ByteInputReader, file: string): Evidence | null {
  const bytes = reader.readBytes(file);
  if (bytes.length > MAX_EFFORT_BYTES) throw new UsageError(`入力を読み取れません：Effort 1 の上限は${MAX_EFFORT_BYTES}バイトです（${file}）`);
  try { return JSON.parse(strict.decode(bytes)) as Evidence; } catch { return null; }
}

function readChange(reader: ByteInputReader, root: string, id: string): EffortChangeRecords {
  const dir = join(root, EVIDENCE_DIR, id, 'effort');
  const found: EffortChangeRecords = { change: id, observations: [], files: [] };
  for (const entry of reader.entries(dir).filter((e) => e.kind === 'file' && EFFORT_FILE.test(e.name))) {
    const path = posix.join(EVIDENCE_DIR, id, 'effort', entry.name);
    const value = parseEvidence(reader, join(dir, entry.name));
    const reason = value === null ? `${entry.name} は JSON として読めません` : mismatch(entry.name, id, value);
    found.files.push(path);
    if (reason !== null || value === null) found.invalid ??= reason ?? '';
    else found.observations.push(observation(path, value));
  }
  return found;
}

function readManual(reader: ByteInputReader, root: string): ManualEffortRecord[] {
  const dir = join(root, MANUAL_DIR);
  return reader.entries(dir).filter((e) => e.kind === 'file' && e.name.endsWith('.md') && e.name !== 'template.md')
    .map((e) => parseManualEffort(posix.join(MANUAL_DIR, e.name), reader.readBytes(join(dir, e.name))));
}

function evidenceIds(reader: ByteInputReader, root: string): string[] {
  return reader.entries(join(root, EVIDENCE_DIR))
    .filter((e) => e.kind === 'directory' && e.name !== 'archive' && CHANGE_ID.test(e.name)).map((e) => e.name);
}

function locate(reader: InputReader, changesDir: string, ids: string[]): Record<string, EffortLocation> {
  return Object.fromEntries(ids.map((id) => [id, resolveChangeDir(changesDir, id, reader).kind]));
}

const resolved = (location: EffortLocation | undefined): boolean => location === 'active' || location === 'archived';

function relink(record: ManualEffortRecord, locations: Record<string, EffortLocation>): ManualEffortRecord {
  if (record.change.status !== 'single' || resolved(locations[record.change.id])) return record;
  return { ...record, change: { status: 'unmapped', reason: 'change が見つからないか、archive で一意に決まりません' } };
}

const idsToLocate = (changes: EffortChangeRecords[], manual: ManualEffortRecord[]): string[] =>
  [...new Set([...changes.map((c) => c.change), ...manual.flatMap((m) => (m.change.status === 'single' ? [m.change.id] : []))])].sort();

function gather(root: string): EffortInputs {
  const reader = createByteInputReader(DOCUMENT_LIMITS);
  const manual = readManual(reader, root);
  const changes = evidenceIds(reader, root).map((id) => readChange(reader, root, id));
  const locations = locate(memoizeEntries(reader), resolve(root, loadConfig(root).openspecDir, 'changes'), idsToLocate(changes, manual));
  return { manual: manual.map((m) => relink(m, locations)), changes, locations };
}

/** 手書きの効率記録と Effort 1 を、1 つの入力予算で読む。部分的な結果は返さない */
export function readEffortInputs(root: string): EffortInputs {
  try { return gather(resolve(root)); } catch (error) {
    const Failure = error instanceof InputReadFailure ? InputReadFailure : UsageError;
    throw new Failure(maskSecrets(error instanceof Error ? error.message : '効率の入力を読み取れません'));
  }
}
