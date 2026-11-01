import { appendFile, mkdir } from 'node:fs';
import { join } from 'node:path';

const SAFE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const events = new Set(['case-start', 'repo-ready', 'child-ready', 'stop-begin', 'ps-return', 'ps-boot', 'ps-cim', 'ps-owner', 'ps-taskkill', 'ps-parse', 'wait-end', 'closed', 'cleanup-closed']);
const kinds = new Set(['ok', 'timeout', 'error', 'status', 'none', 'invalid', 'clock']);
const markNames = ['boot', 'cim', 'owner', 'taskkill'] as const;
type Mark = typeof markNames[number];
type Details = { durationMs?: number; kind?: string };
export type CleanupRecorder = { note(event: string, details?: Details): void; end(): void };
type StopResult = { error?: Error | { code?: string } | null; status?: number | null; stdout?: unknown };

export function parseStopMarks(stdout: unknown, timeoutMs: number): { kind: string; values: Partial<Record<Mark, number>> } {
  const empty = (kind: string) => ({ kind, values: {} });
  if (typeof stdout !== 'string') return empty('none');
  if (stdout.length > 4096) return empty('invalid');
  const lines = stdout.split('\n').slice(0, -1).map((line) => line.replace(/\r$/, '')).filter((line) => line.startsWith('LOOMAKE-PS '));
  if (lines.length === 0) return empty('none');
  const values: Partial<Record<Mark, number>> = {};
  let next = 0;
  let previous = 0;
  for (const line of lines) {
    const match = /^LOOMAKE-PS (boot|cim|owner|taskkill) (-?[0-9]{1,9})$/.exec(line);
    if (!match) return empty('invalid');
    const name = match[1] as Mark;
    const value = Number(match[2]);
    const index = markNames.indexOf(name);
    if (name in values || (index !== next && !(next === 0 && index === 1))) return empty('invalid');
    if (name !== 'boot') {
      if (value < previous || value < 0) return empty('invalid');
      previous = value;
    }
    values[name] = value;
    next = index + 1;
  }
  if (values.boot !== undefined && (values.boot < 0 || values.boot > timeoutMs)) {
    delete values.boot;
    return { kind: 'clock', values };
  }
  return { kind: 'ok', values };
}

export function classifyStopReturn(result: StopResult): string {
  if (result.error) return 'code' in result.error && result.error.code === 'ETIMEDOUT' ? 'timeout' : 'error';
  return result.status !== 0 ? 'status' : 'ok';
}

export function recordWindowsStop(recorder: Pick<CleanupRecorder, 'note'> | undefined, result: StopResult, durationMs: number, timeoutMs: number): void {
  if (!recorder) return;
  try {
    recorder.note('ps-return', { durationMs, kind: classifyStopReturn(result) });
    const parsed = parseStopMarks(result.stdout, timeoutMs);
    for (const name of markNames) {
      const value = parsed.values[name];
      if (value !== undefined) recorder.note(`ps-${name}`, { durationMs: value });
    }
    recorder.note('ps-parse', { kind: parsed.kind });
  } catch { /* 診断の失敗は元の停止結果へ伝えない。 */ }
}

export type CleanupFs = {
  mkdir(path: string, options: { recursive: true }, callback: (error: NodeJS.ErrnoException | null) => void): void;
  appendFile(path: string, data: string, callback: (error: NodeJS.ErrnoException | null) => void): void;
};
type Phase = { event: string; at: number; durationMs?: number; kind?: string };
type Counts = { rows: number; saved: number; failed: number; dropped: number };
type Channel = { note(phase: Phase): void; end(phase: Phase): void; drop(): void };
type CleanupSink = { open(label: string): Channel | undefined };
type Entry = { row: Phase & { type: 'phase'; label: string; pid: number; seq: number }; counts: Counts; end: boolean; line?: string };
const NO_RECORDER: CleanupRecorder = { note() {}, end() {} };
const MAX_ROWS = 48;
const MAX_BYTES = 8192;
// 固定項目と安全な整数の最大桁数を含む、case-end 1行分の予約。
const END_BYTES = 384;

export function createOwnedCleanupSink({ env = process.env, platform = process.platform, fs = { mkdir, appendFile } }: {
  env?: NodeJS.ProcessEnv; platform?: string; fs?: CleanupFs;
} = {}): CleanupSink {
  const directory = env.LOOMAKE_CI_HEARTBEAT_DIR;
  if (platform !== 'win32' || !directory) return { open() { return undefined; } };
  const file = join(directory, `owned-cleanup-${process.pid}.jsonl`);
  const queue: Entry[] = [];
  let rows = 0;
  let bytes = 0;
  let seq = 0;
  let active = false;
  let pumping = false;
  let initialized = false;
  let disabled = false;

  function dispatch(start: (callback: (error: NodeJS.ErrnoException | null) => void) => void, complete: (failed: boolean) => void): void {
    active = true;
    let settled = false;
    const finish = (failed: boolean) => {
      try {
        if (settled) return;
        settled = true;
        complete(failed);
        active = false;
        pump();
      } catch {
        active = false;
        disabled = true;
        queue.length = 0;
      }
    };
    try { start((error) => { try { finish(error !== null && error !== undefined); } catch { /* 診断だけを欠測にする。 */ } }); }
    catch { finish(true); }
  }

  function pump(): void {
    if (pumping) return;
    pumping = true;
    try {
      while (!active && !disabled && queue.length > 0) {
        if (!initialized) {
          initialized = true;
          dispatch((callback) => fs.mkdir(directory!, { recursive: true }, callback), (failed) => {
            if (failed) { disabled = true; queue.length = 0; }
          });
          continue;
        }
        const entry = queue.shift()!;
        const c = entry.counts;
        const line = entry.end ? JSON.stringify({ ...entry.row, kind: c.saved === c.rows && c.failed === 0 && c.dropped === 0 ? 'complete' : 'partial', ...c }) + '\n' : entry.line!;
        dispatch((callback) => fs.appendFile(file, line, callback), (failed) => {
          if (!entry.end) { if (failed) c.failed++; else c.saved++; }
        });
      }
    } catch {
      disabled = true;
      queue.length = 0;
    } finally { pumping = false; }
  }

  return {
    open(label) {
      if (disabled || !['owned-cleanup-owned', 'owned-cleanup-mismatch'].includes(label) || !SAFE.test(label) || rows + 1 > MAX_ROWS || bytes + END_BYTES > MAX_BYTES) return undefined;
      rows++;
      bytes += END_BYTES;
      const counts: Counts = { rows: 0, saved: 0, failed: 0, dropped: 0 };
      const drop = () => { counts.dropped = Math.min(Number.MAX_SAFE_INTEGER, counts.dropped + 1); };
      const enqueue = (phase: Phase, end: boolean) => {
        const row: Entry['row'] = { type: 'phase', label, ...phase, pid: process.pid, seq: seq + 1 };
        const line = JSON.stringify(row) + '\n';
        const size = Buffer.byteLength(line);
        if (!end && (rows + 1 > MAX_ROWS || bytes + size > MAX_BYTES)) { drop(); return; }
        if (!end) { rows++; bytes += size; counts.rows++; }
        seq++;
        queue.push({ row, counts, end, line });
        pump();
      };
      return { note: (phase) => enqueue(phase, false), end: (phase) => enqueue(phase, true), drop };
    },
  };
}

export function createOwnedCleanupRecorder(caseKind: 'owned' | 'mismatch', sink: CleanupSink, now: () => number = () => performance.now()): CleanupRecorder {
  try {
    const channel = sink.open(`owned-cleanup-${caseKind}`);
    if (!channel) return NO_RECORDER;
    let started: number;
    try { started = now(); } catch { channel.drop(); return NO_RECORDER; }
    let ended = false;
    const phase = (event: string, details: Details = {}): Phase | undefined => {
      if (!SAFE.test(event) || !events.has(event) || (details.kind !== undefined && (!SAFE.test(details.kind) || !kinds.has(details.kind)))) return undefined;
      const duration = event.startsWith('ps-') ? details.durationMs : now() - started;
      if (duration !== undefined && (!Number.isFinite(duration) || duration < 0 || duration > Number.MAX_SAFE_INTEGER)) return undefined;
      return { event, at: Date.now(), ...(duration === undefined ? {} : { durationMs: Math.floor(duration) }), ...(details.kind === undefined ? {} : { kind: details.kind }) };
    };
    const recorder: CleanupRecorder = {
      note(event, details) {
        if (ended) return;
        try {
          const row = phase(event, details);
          if (row) channel.note(row); else channel.drop();
        } catch { channel.drop(); }
      },
      end() {
        if (ended) return;
        ended = true;
        try {
          const durationMs = now() - started;
          if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > Number.MAX_SAFE_INTEGER) { channel.drop(); return; }
          channel.end({ event: 'case-end', at: Date.now(), durationMs: Math.floor(durationMs) });
        } catch { channel.drop(); }
      },
    };
    recorder.note('case-start');
    return recorder;
  } catch { return NO_RECORDER; }
}
