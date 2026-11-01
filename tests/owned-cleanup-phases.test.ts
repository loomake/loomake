import { describe, expect, it } from 'vitest';
import { appendFile, mkdir, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyStopReturn, createOwnedCleanupRecorder, createOwnedCleanupSink, parseStopMarks, recordWindowsStop, type CleanupFs } from './helpers/owned-cleanup-phases.js';

const marks = (text: string) => text.split(',').map((part) => `LOOMAKE-PS ${part}\n`).join('');
const fakeSink = (append: CleanupFs['appendFile']) => createOwnedCleanupSink({ platform: 'win32', env: { LOOMAKE_CI_HEARTBEAT_DIR: '/diagnostic' }, fs: { mkdir: (_dir, _options, callback) => callback(null), appendFile: append } });
const rowsOf = (lines: string[]) => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

describe('所有fixture停止の区間解析', () => {
  it('[REQ-363] T1 原点を分けてCRLFと固定区間だけを読む', () => {
    const input = 'C:\\private --token secret\r\n' + marks('boot 900,cim 400,owner 410,taskkill 700').replaceAll('\n', '\r\n');
    expect(parseStopMarks(input, 3000)).toEqual({ kind: 'ok', values: { boot: 900, cim: 400, owner: 410, taskkill: 700 } });
    expect(JSON.stringify(parseStopMarks(input, 3000))).not.toContain('private');
    expect(JSON.stringify(parseStopMarks(input, 3000))).not.toContain('--token');
    expect(parseStopMarks(marks('cim 400,owner 410,taskkill 700'), 3000)).toEqual({ kind: 'ok', values: { cim: 400, owner: 410, taskkill: 700 } });
  });

  it.each([null, ''])('[REQ-363] T2 停止成功と印の欠測を分ける（%j）', (stdout) => {
    expect(classifyStopReturn({ status: 0, stdout })).toBe('ok');
    expect(parseStopMarks(stdout, 3000)).toEqual({ kind: 'none', values: {} });
  });

  it('[REQ-363] T3 期限切れの途中行を捨て元のresultを変更しない', () => {
    const result = Object.freeze({ status: null, error: Object.freeze({ code: 'ETIMEDOUT', message: 'raw-error' }), stdout: marks('boot 900,cim 400') + 'LOOMAKE-PS owner 4' });
    const notes: unknown[][] = [];
    expect(recordWindowsStop({ note: (...args: unknown[]) => { notes.push(args); } }, result, 3010, 3000)).toBeUndefined();
    expect(notes).toEqual([['ps-return', { durationMs: 3010, kind: 'timeout' }], ['ps-boot', { durationMs: 900 }], ['ps-cim', { durationMs: 400 }], ['ps-parse', { kind: 'ok' }]]);
    expect(result.error.code).toBe('ETIMEDOUT');
    expect(JSON.stringify(notes)).not.toContain('raw-error');
    expect(classifyStopReturn({ error: { code: 'EIO' }, status: 0 })).toBe('error');
    expect(classifyStopReturn({ status: null })).toBe('status');
    expect(classifyStopReturn({ status: 1 })).toBe('status');
    expect(() => recordWindowsStop({ note() { throw new Error('sink'); } }, result, 3010, 3000)).not.toThrow();
  });

  it.each(['boot 1,boot 2', 'boot 1,owner 2', 'boot 1,cim 400,owner 399', 'cim -1', 'boot 1000000000', 'owner 1', 'boot 1,unknown 2', 'boot 1,cim +2'])('[REQ-363] T4 不正な印は数値を全部捨てる（%s）', (text) => {
    expect(parseStopMarks(marks(text), 3000)).toEqual({ kind: 'invalid', values: {} });
  });
  it('[REQ-363] T4 stdout上限を超えたら解析しない', () => {
    expect(parseStopMarks('x'.repeat(4097), 3000)).toEqual({ kind: 'invalid', values: {} });
  });

  it.each([-1, 3001])('[REQ-363] T5 bootの不整合はF系だけを残す（%i）', (boot) => {
    expect(parseStopMarks(marks(`boot ${boot},cim 400,owner 410`), 3000)).toEqual({ kind: 'clock', values: { cim: 400, owner: 410 } });
    expect(parseStopMarks(marks(`boot ${boot},cim 400,owner 399`), 3000)).toEqual({ kind: 'invalid', values: {} });
  });
});

describe('保存の成功通知と上限', () => {
  it('[REQ-363] T7a 一部保存失敗を数えて後続も試しpartialにする', () => {
    const lines: string[] = [];
    let count = 0;
    const sink = fakeSink((_file, line, cb) => { count++; if (count === 2) cb(new Error('failed')); else { lines.push(line); cb(null); } });
    const r = createOwnedCleanupRecorder('owned', sink, () => 0);
    expect(r.note('repo-ready')).toBeUndefined();
    r.note('child-ready');
    expect(r.end()).toBeUndefined();
    expect(rowsOf(lines).at(-1)).toMatchObject({ event: 'case-end', kind: 'partial', rows: 3, saved: 2, failed: 1, dropped: 0 });
    expect(rowsOf(lines).some((row) => row.event === 'child-ready')).toBe(true);
  });

  it('[REQ-363] T7b 同期throwも保存失敗として数え外へ出さない', () => {
    const lines: string[] = [];
    let count = 0;
    const sink = fakeSink((_file, line, cb) => { if (++count === 2) throw new Error('sync'); lines.push(line); cb(null); });
    const r = createOwnedCleanupRecorder('owned', sink);
    expect(() => r.note('repo-ready')).not.toThrow();
    r.end();
    expect(rowsOf(lines).at(-1)).toMatchObject({ kind: 'partial', failed: 1 });
    const broken = createOwnedCleanupRecorder('owned', fakeSink((_f, _l, cb) => cb(null)), () => { throw new Error('clock'); });
    expect(() => { broken.note('repo-ready'); broken.end(); }).not.toThrow();
  });

  it('[REQ-363] T7c endの枠を残して全体48行8KiBを守る', () => {
    const lines: string[] = [];
    const sink = fakeSink((_file, line, cb) => { lines.push(line); cb(null); });
    const r = createOwnedCleanupRecorder('owned', sink);
    for (let i = 0; i < 60; i++) r.note('repo-ready');
    r.end();
    const before = lines.length;
    r.note('child-ready'); r.end();
    expect(lines.length).toBe(before);
    expect(lines.length).toBeLessThanOrEqual(48);
    expect(Buffer.byteLength(lines.join(''))).toBeLessThanOrEqual(8192);
    expect(rowsOf(lines).at(-1)).toMatchObject({ event: 'case-end', kind: 'partial' });
    expect(rowsOf(lines).at(-1)!.dropped).toBeGreaterThan(0);
  });

  it('[REQ-363] T7c 不正なeventとkindと数値を捨て固定schemaだけを書く', () => {
    const lines: string[] = [];
    const r = createOwnedCleanupRecorder('mismatch', fakeSink((_file, line, cb) => { lines.push(line); cb(null); }), () => 0);
    r.note('unknown-secret');
    r.note('ps-return', { kind: 'unknown-secret' });
    for (const durationMs of [-1, NaN, Infinity]) r.note('ps-return', { durationMs });
    r.end();
    expect(rowsOf(lines)).toHaveLength(2);
    expect(rowsOf(lines).at(-1)).toMatchObject({ label: 'owned-cleanup-mismatch', kind: 'partial', dropped: 5, rows: 1, saved: 1, failed: 0 });
    expect(lines.join('')).not.toContain('unknown-secret');
  });

  it('[REQ-363] T7c 2つのrecorderは全体予算の中に両方のendを予約する', () => {
    const lines: string[] = [];
    const sink = fakeSink((_file, line, cb) => { lines.push(line); cb(null); });
    const owned = createOwnedCleanupRecorder('owned', sink, () => 0);
    const mismatch = createOwnedCleanupRecorder('mismatch', sink, () => 0);
    for (let i = 0; i < 60; i++) { owned.note('repo-ready'); mismatch.note('repo-ready'); }
    owned.end(); mismatch.end();
    expect(lines.length).toBeLessThanOrEqual(48);
    expect(Buffer.byteLength(lines.join(''))).toBeLessThanOrEqual(8192);
    expect(rowsOf(lines).filter((row) => row.event === 'case-end').map((row) => [row.label, row.kind])).toEqual([
      ['owned-cleanup-owned', 'partial'], ['owned-cleanup-mismatch', 'partial'],
    ]);
  });

  it('[REQ-363] T7d 通知固着では同時1要求だけでnote/endは待たずに戻る', () => {
    const lines: string[] = [];
    const sink = fakeSink((_file, line) => { lines.push(line); });
    const r = createOwnedCleanupRecorder('owned', sink);
    expect(r.note('repo-ready')).toBeUndefined();
    expect(r.end()).toBeUndefined();
    expect(lines).toHaveLength(1);
    expect(rowsOf(lines)[0]).toMatchObject({ event: 'case-start' });
  });

  it('[REQ-363] T7d 遅延callbackも順番を守り終わりを先に保存しない', () => {
    const lines: string[] = [];
    const callbacks: ((error: NodeJS.ErrnoException | null) => void)[] = [];
    const sink = fakeSink((_file, line, cb) => { lines.push(line); callbacks.push(cb); });
    const r = createOwnedCleanupRecorder('owned', sink, () => 0);
    r.note('repo-ready'); r.end();
    expect(lines).toHaveLength(1);
    callbacks[0]!(null); expect(lines).toHaveLength(2);
    callbacks[1]!(null); expect(lines).toHaveLength(3);
    expect(rowsOf(lines).at(-1)).toMatchObject({ kind: 'complete', rows: 2, saved: 2, failed: 0 });
    callbacks[2]!(null);
  });

  it('[REQ-363] T7e 同期callbackと通知後throwで二重計上や順序逆転を起こさない', () => {
    const lines: string[] = [];
    const sink = fakeSink((_file, line, cb) => { lines.push(line); cb(null); throw new Error('after callback'); });
    const r = createOwnedCleanupRecorder('owned', sink, () => 0);
    expect(() => { r.note('repo-ready'); r.end(); }).not.toThrow();
    expect(rowsOf(lines).map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(rowsOf(lines).at(-1)).toMatchObject({ kind: 'complete', saved: 2, failed: 0 });
  });

  it('[REQ-363] T7d mkdir通知固着でも追記を始めず同期で戻る', () => {
    let mkdirCalls = 0;
    let appendCalls = 0;
    const sink = createOwnedCleanupSink({ env: { LOOMAKE_CI_HEARTBEAT_DIR: '/diagnostic' }, platform: 'win32', fs: {
      mkdir() { mkdirCalls++; }, appendFile() { appendCalls++; },
    } });
    const r = createOwnedCleanupRecorder('owned', sink);
    expect(r.note('repo-ready')).toBeUndefined();
    expect(r.end()).toBeUndefined();
    expect(mkdirCalls).toBe(1);
    expect(appendCalls).toBe(0);
  });

  it('[REQ-363] T7e end自身の保存通知が失敗したときcompleteは残らない', () => {
    const lines: string[] = [];
    const r = createOwnedCleanupRecorder('owned', fakeSink((_file, line, cb) => {
      if ((JSON.parse(line) as { event: string }).event === 'case-end') cb(new Error('end failed'));
      else { lines.push(line); cb(null); }
    }));
    expect(r.end()).toBeUndefined();
    expect(rowsOf(lines).map((row) => row.event)).toEqual(['case-start']);
  });

  it('[REQ-363] T7e 同期通知で待ち行列を進めてもfs呼出が再入しない', () => {
    const lines: string[] = [];
    let depth = 0;
    let maxDepth = 0;
    let release: ((error: NodeJS.ErrnoException | null) => void) | undefined;
    const sink = fakeSink((_file, line, cb) => {
      depth++; maxDepth = Math.max(maxDepth, depth); lines.push(line);
      if (!release) release = cb; else cb(null);
      depth--;
    });
    const r = createOwnedCleanupRecorder('owned', sink, () => 0);
    for (let i = 0; i < 60; i++) r.note('repo-ready');
    r.end();
    expect(lines).toHaveLength(1);
    release!(null);
    expect(maxDepth).toBe(1);
    expect(rowsOf(lines).map((row) => row.seq)).toEqual(lines.map((_line, i) => i + 1));
    expect(rowsOf(lines).at(-1)).toMatchObject({ event: 'case-end', kind: 'partial' });
    expect(lines.length).toBeLessThanOrEqual(48);
    expect(Buffer.byteLength(lines.join(''))).toBeLessThanOrEqual(8192);
  });

  it('[REQ-363] T7c 長い整数の行でも8KiBを先に守りendを残す', () => {
    const lines: string[] = [];
    let now = 0;
    const sink = fakeSink((_file, line, cb) => { lines.push(line); cb(null); });
    const r = createOwnedCleanupRecorder('mismatch', sink, () => now);
    const others = Array.from({ length: 8 }, (_, i) => createOwnedCleanupRecorder(i % 2 === 0 ? 'owned' : 'mismatch', sink, () => now));
    now = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 60; i++) {
      r.note('cleanup-closed', { kind: 'timeout' });
      for (const other of others) other.note('cleanup-closed', { kind: 'timeout' });
    }
    r.end();
    for (const other of others) other.end();
    expect(lines.length).toBeLessThan(48);
    expect(Buffer.byteLength(lines.join(''))).toBeLessThanOrEqual(8192);
    expect(rowsOf(lines).at(-1)).toMatchObject({ event: 'case-end', kind: 'partial' });
    expect(rowsOf(lines).at(-1)!.dropped).toBeGreaterThan(0);
  });

  it('[REQ-363] T7f helperは同期fs・待機・Promise・追加プロセス・hookを使わない', () => {
    const source = readFileSync(join(import.meta.dirname, 'helpers/owned-cleanup-phases.ts'), 'utf8');
    expect(source).not.toMatch(/Sync\(|\bawait\b|new Promise|\.then\(|child_process|worker_threads|afterAll|onTestFinished/);
  });

  it('[REQ-363] T8 実fsの全成功通知でcompleteと自己PIDだけを残す', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-cleanup-phases-'));
    try {
      const targetPid = process.pid + 100000;
      await new Promise<void>((resolve, reject) => {
        const sink = createOwnedCleanupSink({ env: { LOOMAKE_CI_HEARTBEAT_DIR: dir }, platform: 'win32', fs: { mkdir, appendFile: (file, line, cb) => appendFile(file, line, (err) => { cb(err); if (JSON.parse(line).event === 'case-end') { if (err) reject(err); else resolve(); } }) } });
        const r = createOwnedCleanupRecorder('owned', sink);
        r.note('repo-ready', { durationMs: 1, kind: 'ok', targetPid, path: 'private-path', argv: '--token', errorMessage: 'private-error' } as never);
        r.end();
      });
      const filename = `owned-cleanup-${process.pid}.jsonl`;
      expect(readdirSync(dir)).toEqual([filename]);
      const text = readFileSync(join(dir, filename), 'utf8');
      const rows = rowsOf(text.trimEnd().split('\n'));
      expect(rows.every((row) => row.pid === process.pid && row.pid !== targetPid)).toBe(true);
      expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
      expect(rows.every((row) => row.type === 'phase' && row.label === 'owned-cleanup-owned')).toBe(true);
      expect(rows.every((row) => Number.isSafeInteger(row.at) && Number.isSafeInteger(row.durationMs) && Number(row.durationMs) >= 0)).toBe(true);
      expect(rows.at(-1)).toMatchObject({ event: 'case-end', kind: 'complete', rows: 2, saved: 2, failed: 0, dropped: 0 });
      expect(text).not.toContain(String(targetPid));
      for (const secret of ['private-path', '--token', 'private-error', 'unknown-secret']) expect(text).not.toContain(secret);
      const allowed = new Set(['type', 'label', 'event', 'at', 'pid', 'seq', 'durationMs', 'kind', 'rows', 'saved', 'failed', 'dropped']);
      for (const row of rows) expect(Object.keys(row).every((key) => allowed.has(key))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('[REQ-363] T8 mkdir不能は例外を外へ出さず元のファイルを保つ', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-cleanup-file-'));
    const file = join(dir, 'file'); writeFileSync(file, 'preserved');
    try {
      await new Promise<void>((resolve) => {
        const sink = createOwnedCleanupSink({ env: { LOOMAKE_CI_HEARTBEAT_DIR: file }, platform: 'win32', fs: { mkdir: (path, options, cb) => mkdir(path, options, (err) => { cb(err); resolve(); }), appendFile } });
        const r = createOwnedCleanupRecorder('owned', sink);
        expect(() => { r.note('repo-ready'); r.end(); }).not.toThrow();
      });
      expect(readFileSync(file, 'utf8')).toBe('preserved');
      expect(readdirSync(dir)).toEqual(['file']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('[REQ-363] T9 無効な環境とsink生成時はfsを一度も呼ばない', () => {
    let calls = 0;
    const fs: CleanupFs = { mkdir() { calls++; throw new Error('mkdir'); }, appendFile() { calls++; throw new Error('append'); } };
    const enabled = createOwnedCleanupSink({ env: { LOOMAKE_CI_HEARTBEAT_DIR: '/diagnostic' }, platform: 'win32', fs });
    expect(calls).toBe(0);
    for (const sink of [createOwnedCleanupSink({ env: {}, platform: 'win32', fs }), createOwnedCleanupSink({ env: { LOOMAKE_CI_HEARTBEAT_DIR: '/diagnostic' }, platform: 'linux', fs })]) {
      const r = createOwnedCleanupRecorder('owned', sink); r.note('repo-ready'); r.end();
    }
    expect(calls).toBe(0);
    expect(() => { createOwnedCleanupRecorder('owned', enabled).end(); }).not.toThrow();
  });
});
