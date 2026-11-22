import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { JSON_LIMITS, UsageError } from '@loomake/kit';
import type { BodyReceipt } from '@loomake/core';
import { appendBodyReceipt, resolveArtifactBody } from '../src/index.js';
import { hash, now, policy, receiptFixture, receiptName, receiptPath, summaryPath } from '../../../tests/fixtures/body-index/fixture.js';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, openSync: vi.fn(fs.openSync), readSync: vi.fn(fs.readSync) };
});
afterEach(() => vi.clearAllMocks());
function fixture(action: (root: string, data: ReturnType<typeof receiptFixture>) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake body resolution '));
  const data = receiptFixture();
  try { write(root, summaryPath, data.summaryBytes); action(root, data); } finally { rmSync(root, { recursive: true, force: true }); }
}
function write(root: string, path: string, bytes: Uint8Array | string) { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
const resolveBody = (root: string, at = now) => resolveArtifactBody({ root, summaryPath, policy, now: at });
const raw = (root: string, r: BodyReceipt, name = receiptName(r)) => write(root, `.loomake/evidence/_index/body/${r.body.sha256}/${name}`, JSON.stringify(r));
function rebind(data: ReturnType<typeof receiptFixture>) {
  data.summaryBytes = Buffer.from(JSON.stringify(data.summary) + '\n');
  data.receipt.summary = { ...data.receipt.summary, sha256: hash(data.summaryBytes), bytes: data.summaryBytes.length };
}

describe('本体ごとの参照解決', () => {
  it('[REQ-471] 固定要約のbytesを変更せず実期限と未確認accessを返す', () => fixture((root, { receipt: r, summaryBytes }) => {
    appendBodyReceipt(root, r); const before = readFileSync(join(root, receiptPath(r)));
    const result = resolveBody(root);
    expect(result.status).toBe('resolved'); expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({ status: 'resolved', body: r.body, locators: [r.locator], paths: [receiptPath(r)], access: 'unverified',
      retention: [{ path: receiptPath(r), retention: 'satisfied', current: 'available' }] });
    expect(readFileSync(join(root, summaryPath))).toEqual(summaryBytes); expect(readFileSync(join(root, receiptPath(r)))).toEqual(before);
    expect(resolveBody(root)).toEqual(result); expect(result.reason).toContain('未確認');
  }));
  it('[REQ-471] 期限ちょうど/後はexpiredだが当時の保持判定は変えない', () => fixture((root, { receipt: r }) => {
    appendBodyReceipt(root, r);
    const at = resolveBody(root, r.artifact.expiresAt).artifacts[0].retention[0];
    expect(at).toMatchObject({ retention: 'satisfied', current: 'expired' });
    expect(resolveBody(root, '2028-01-01T00:00:00Z').artifacts[0].retention[0].retention).toBe(at.retention);
    expect(resolveBody(root).status).toBe('resolved');
  }));
  it('[REQ-471] 実7dを要求90dへ置き換えず不足と期限だけを返す', () => fixture((root, { receipt: r }) => {
    r.artifact.expiresAt = '2026-11-13T00:00:00Z'; appendBodyReceipt(root, r);
    expect(resolveBody(root).artifacts[0].retention[0]).toMatchObject({ retention: 'insufficient', current: 'available' });
  }));
  it('[REQ-471] 索引なしの本体と0本体はnot-indexedで未取得理由を持つ', () => fixture((root, data) => {
    expect(resolveBody(root)).toMatchObject({ status: 'not-indexed', artifacts: [{ status: 'not-indexed', locators: [], paths: [], retention: [] }] });
    data.summary.artifacts = []; data.summary.gaps = data.summary.gaps.filter((g) => !g.field.startsWith('artifacts'));
    data.summary.gaps.push({ field: 'artifacts', kind: 'unverified', reason: '未取得です' });
    rebind(data); write(root, summaryPath, data.summaryBytes);
    expect(resolveBody(root)).toMatchObject({ status: 'not-indexed', artifacts: [] }); expect(resolveBody(root).reason).toContain('取得先');
  }));
  it('[REQ-471] 複数本体を元順序で返しnot-indexed>resolvedを優先する', () => fixture((root, data) => {
    const second = { ...data.summary.artifacts[0], sha256: hash('second'), bytes: 6 };
    data.summary.artifacts.push(second);
    for (const key of ['counts', 'location', 'expiresAt', 'retrieval']) data.summary.gaps.push({ field: `artifacts[1].${key}`, kind: 'unverified', reason: '未確認です' });
    rebind(data); write(root, summaryPath, data.summaryBytes); raw(root, data.receipt);
    const result = resolveBody(root);
    expect(result.status).toBe('not-indexed'); expect(result.artifacts.map((a) => a.body.sha256)).toEqual([data.receipt.body.sha256, second.sha256]);
    expect(result.artifacts.map((a) => a.status)).toEqual(['resolved', 'not-indexed']);
  }));
  it('[REQ-471] 同内容の別時刻正規名はlocatorだけ集約し全pathと保持判定を残す', () => fixture((root, { receipt: r }) => {
    raw(root, r); raw(root, r, receiptName(r, '20261107T000000Z'));
    const result = resolveBody(root);
    const paths = [receiptPath(r), receiptPath(r, '20261107T000000Z')];
    expect(result.status).toBe('resolved'); expect(result.artifacts[0].locators).toEqual([r.locator]);
    expect(result.artifacts[0].paths).toEqual(paths); expect(result.artifacts[0].retention.map((v) => v.path)).toEqual(paths);
    const other = { ...r, retrieval: { ...r.retrieval, retrievedAt: '2026-11-08T00:00:00Z' } };
    raw(root, other, receiptName(r, '20261108T000000Z'));
    expect(resolveBody(root).artifacts[0].locators).toHaveLength(1); expect(resolveBody(root).artifacts[0].paths).toHaveLength(3);
    expect(readFileSync(join(root, receiptPath(r)), 'utf8')).toContain(r.retrieval.retrievedAt);
  }));
  it.each(['body', 'expiresAt', 'summary'] as const)('[REQ-471] 同じlocatorの%s矛盾をinvalid-indexにする', (field) => fixture((root, { receipt: r }) => {
    raw(root, r);
    const other = structuredClone(r);
    if (field === 'body') other.body.bytes++;
    if (field === 'expiresAt') other.artifact.expiresAt = '2026-11-13T00:00:00Z';
    if (field === 'summary') other.summary.sha256 = 'e'.repeat(64);
    raw(root, other, receiptName(r, '20261107T000000Z'));
    expect(resolveBody(root)).toMatchObject({ status: 'invalid-index', artifacts: [{ status: 'invalid-index' }] });
  }));
  it('[REQ-471] 複数locatorの実期限をreceipt別に残し単一値に集約しない', () => fixture((root, { receipt: r }) => {
    raw(root, r); const other = structuredClone(r); other.locator.artifactId = '457'; other.artifact.expiresAt = '2026-11-13T00:00:00Z'; raw(root, other);
    const a = resolveBody(root).artifacts[0];
    expect(a.status).toBe('resolved'); expect(a.locators).toEqual([r.locator, other.locator]);
    expect(a.retention.map((v) => v.retention)).toEqual(['satisfied', 'insufficient']);
  }));
  it('[REQ-471] 要約pathが違えばhash等が同じでもmismatch', () => fixture((root, { receipt: r }) => {
    const other = structuredClone(r); other.summary.path = summaryPath.replace('000000Z', '000001Z'); raw(root, other);
    expect(resolveBody(root).status).toBe('mismatch');
  }));
  it('[REQ-471] 正しい構造の候補でも結付け不一致を正常候補で隠さない', () => fixture((root, { receipt: r }) => {
    raw(root, r); const bad = structuredClone(r); bad.locator.artifactId = '457'; bad.execution.runId = '2'; raw(root, bad);
    expect(resolveBody(root)).toMatchObject({ status: 'mismatch', artifacts: [{ status: 'mismatch' }] });
  }));
  it.each(['json', 'structure', 'name', 'utc', 'suffix', 'directory', 'nested', 'utf8'])('[REQ-471] %sの不正候補と正常候補を混ぜてもinvalid-index', (kind) => fixture((root, { receipt: r }) => {
    raw(root, r); let path = receiptPath(r, '20261107T000000Z'), value: string | Buffer = JSON.stringify(r);
    if (kind === 'json') value = '{';
    if (kind === 'structure') value = '{}';
    if (kind === 'name') path = path.replace('20261107T000000Z', 'invalid');
    if (kind === 'utc') path = path.replace('20261107T000000Z', '20260230T000000Z');
    if (kind === 'suffix') path = path.replace(/-[a-f0-9]{8}\.json$/, '-00000000.json');
    if (kind === 'directory') value = JSON.stringify({ ...r, body: { ...r.body, sha256: 'f'.repeat(64) } });
    if (kind === 'nested') path = path.replace('/20261107', '/nested/20261107');
    if (kind === 'utf8') value = Buffer.concat([Buffer.from('{"unknown":"'), Buffer.from([0x80]), Buffer.from('"}')]);
    write(root, path, value);
    const result = resolveBody(root); expect(result.status).toBe('invalid-index'); expect(result.artifacts[0].status).toBe('invalid-index');
    expect(result.reason).not.toContain(path); expect(result.artifacts[0].reason).not.toContain(path);
  }));
  it('[REQ-471] 読取不能候補のあとに読取り予算を復活させず後続候補も不正とする', () => fixture((root, { receipt: r }) => {
    raw(root, r); raw(root, r, receiptName(r, '20261107T000000Z'));
    const original = vi.mocked(openSync).getMockImplementation()!;
    vi.mocked(openSync).mockImplementation((path, flags, mode) => {
      if (String(path).endsWith(receiptName(r))) throw new Error('unreadable-sensitive-path');
      return original(path, flags, mode);
    });
    try {
      const result = resolveBody(root); expect(result.status).toBe('invalid-index'); expect(result.artifacts[0].paths).toEqual([]);
      expect(vi.mocked(openSync).mock.calls.filter(([p]) => String(p).endsWith(receiptName(r, '20261107T000000Z')))).toHaveLength(0);
    } finally { vi.mocked(openSync).mockImplementation(original); }
  }));
  it('[REQ-471] receiptと親directoryのリンクを拒否し通常tmpは証拠にしない', () => fixture((root, { receipt: r }) => {
    raw(root, r); write(root, `${dirname(receiptPath(r))}/.loomake-evidence-1-example.tmp`, 'partial'); expect(resolveBody(root).status).toBe('resolved');
    const link = join(root, receiptPath(r, '20261107T000000Z'));
    symlinkSync(join(root, receiptPath(r)), link, process.platform === 'win32' ? 'file' : undefined);
    expect(resolveBody(root).status).toBe('invalid-index');
  }));
  it('[REQ-471] 不正な要約・旧版・不正UTF8・同期P1意味検証の失敗はmismatch', () => fixture((root, { receipt: r, summary }) => {
    raw(root, r);
    for (const input of ['{', Buffer.from([0x80]), JSON.stringify({ ...summary, summaryVersion: 2 }), JSON.stringify({ ...summary, gaps: [] }), JSON.stringify({ ...summary, schemaVersion: 1 })]) {
      write(root, summaryPath, input); expect(resolveBody(root)).toMatchObject({ status: 'mismatch', artifacts: [] });
    }
    rmSync(join(root, summaryPath)); expect(resolveBody(root).status).toBe('mismatch');
  }));
  it('[REQ-471] 引数の誤りはraw値とcauseを含まない日本語UsageError', () => fixture((root) => {
    for (const args of [{ root: 'missing-sensitive-path' }, { summaryPath: '../sensitive' }, { summaryPath: summaryPath.replace('/sample/', '/sample/../sample/') }, { policy: {} }, { now: '2026-02-30T00:00:00Z' }, { now: undefined }]) {
      let error: unknown; try { resolveArtifactBody({ root, summaryPath, policy, now, ...args } as Parameters<typeof resolveArtifactBody>[0]); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(UsageError); expect((error as Error).cause).toBeUndefined();
      expect((error as Error).message).toBe('本体参照の解決引数が不正です。ルート・要約パス・保持方針・日時を確認してください。');
    }
  }));
});

describe('索引全体で共有する入力予算', () => {
  it('[REQ-471] summary64MiBとreceipt64MiBの合計128MiBは受理し次の読取りを開始しない', () => fixture((root, data) => {
    data.summary.padding = '';
    data.summary.padding = 'x'.repeat(JSON_LIMITS.maxFileBytes - Buffer.byteLength(JSON.stringify(data.summary) + '\n'));
    rebind(data); expect(data.summaryBytes.byteLength).toBe(JSON_LIMITS.maxFileBytes); write(root, summaryPath, data.summaryBytes);
    data.receipt.padding = '';
    data.receipt.padding = 'x'.repeat(JSON_LIMITS.maxFileBytes - Buffer.byteLength(JSON.stringify(data.receipt) + '\n'));
    const json = JSON.stringify(data.receipt) + '\n'; expect(Buffer.byteLength(json)).toBe(JSON_LIMITS.maxFileBytes);
    write(root, receiptPath(data.receipt), json);
    expect(resolveBody(root).status).toBe('resolved');
    const extraPath = receiptPath(data.receipt, '20261107T000000Z'); write(root, extraPath, '{}');
    vi.mocked(openSync).mockClear(); vi.mocked(readSync).mockClear();
    expect(resolveBody(root).status).toBe('invalid-index');
    expect(vi.mocked(openSync).mock.calls.filter(([p]) => String(p) === join(root, extraPath))).toHaveLength(0);
  }), 60_000);
  it('[REQ-471] file64MiBを1byte超えた候補をreadSync前に拒否する', () => fixture((root, { receipt: r }) => {
    const file = join(root, receiptPath(r)); write(root, receiptPath(r), 'x'.repeat(JSON_LIMITS.maxFileBytes + 1));
    const readFiles: string[] = [], original = vi.mocked(openSync).getMockImplementation()!;
    vi.mocked(openSync).mockImplementation((p, flags, mode) => { readFiles.push(String(p)); return original(p, flags, mode); });
    try {
      const before = vi.mocked(readSync).mock.calls.length;
      expect(resolveBody(root).status).toBe('invalid-index'); expect(readFiles).toContain(file);
      // summaryの1chunkとEOFだけ。候補は開いてfstatで拒否し、本体readは起動しない。
      expect(vi.mocked(readSync).mock.calls.length - before).toBe(2);
    } finally { vi.mocked(openSync).mockImplementation(original); }
  }));
  it('[REQ-471] 4096項目ちょうどを受理し4097件目では正常候補へ戻らない', () => fixture((root, { receipt: r }) => {
    raw(root, r); const directory = dirname(receiptPath(r));
    for (let n = 0; n < JSON_LIMITS.maxEntries - 1; n++) write(root, `${directory}/.loomake-evidence-${n}-entry.tmp`, '');
    expect(resolveBody(root).status).toBe('resolved');
    write(root, `${directory}/.loomake-evidence-extra-entry.tmp`, '');
    expect(resolveBody(root).status).toBe('invalid-index');
  }));
  it('[REQ-471] 深さ32は受理し33では探索を止める', () => fixture((root, { receipt: r }) => {
    raw(root, r); const directory = dirname(receiptPath(r));
    const deep = `${directory}/${Array<string>(JSON_LIMITS.maxDepth).fill('d').join('/')}`;
    mkdirSync(join(root, deep), { recursive: true }); expect(resolveBody(root).status).toBe('resolved');
    mkdirSync(join(root, deep, 'extra')); expect(resolveBody(root).status).toBe('invalid-index');
  }));
});

it('[REQ-471] 全体優先invalid-index>mismatch>not-indexed>resolvedと別body間のlocator矛盾を隠さない', () => fixture((root, data) => {
  const first = data.summary.artifacts[0];
  for (let n = 1; n <= 3; n++) {
    data.summary.artifacts.push({ ...first, sha256: hash(`body${n}`), bytes: n });
    for (const key of ['counts', 'location', 'expiresAt', 'retrieval']) data.summary.gaps.push({ field: `artifacts[${n}].${key}`, kind: 'unverified', reason: '未確認です' });
  }
  rebind(data); write(root, summaryPath, data.summaryBytes); raw(root, data.receipt);
  const r1 = structuredClone(data.receipt); r1.body = { kind: 'test-report', sha256: data.summary.artifacts[1].sha256, bytes: 1 }; r1.locator.artifactId = '457'; r1.execution.runId = '2'; raw(root, r1);
  expect(resolveBody(root).status).toBe('mismatch');
  write(root, `${dirname(receiptPath(data.receipt))}/invalid.JSON`, '{}');
  expect(resolveBody(root).status).toBe('invalid-index');
  rmSync(join(root, `${dirname(receiptPath(data.receipt))}/invalid.JSON`));
  r1.locator.artifactId = data.receipt.locator.artifactId; r1.execution.runId = data.receipt.execution.runId; raw(root, r1);
  const result = resolveBody(root); expect(result.status).toBe('invalid-index');
  expect(result.artifacts.slice(0, 2).map((a) => a.status)).toEqual(['invalid-index', 'invalid-index']);
}));
