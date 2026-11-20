import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InputReadFailure, UsageError, resolveChangeDir } from '@loomake/kit';
import { readEffortInputs } from '../src/index.js';

const roots: string[] = [];
const temporary = () => { const root = mkdtempSync(join(tmpdir(), 'loomake-effort-read-')); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const put = (root: string, path: string, text: string | Buffer) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
const SHA = 'a'.repeat(40);
const record = (change: string, extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, kind: 'loomake-effort', change, sha: SHA, recordedAt: '2026-11-06T01:02:03.000Z', totalMinutes: 90, ...extra });
const NAME = '20261106T010203Z-aaaaaaaaaaaa.json';
const effort = (root: string, change: string, value: unknown = record(change), name = NAME) => put(root, `.loomake/evidence/${change}/effort/${name}`, JSON.stringify(value, null, 2) + '\n');
const change = (root: string, id: string) => mkdirSync(join(root, 'openspec/changes', id), { recursive: true });
const archived = (root: string, id: string, date = '2026-11-01') => mkdirSync(join(root, 'openspec/changes/archive', `${date}-${id}`), { recursive: true });
const MANUAL = (id: string) => `## 記録の基本\n\n| 項目 | 値 |\n|---|---|\n| 対象 | X |\n| change | ${id} |\n| 比較の種類 | 推定との比較・人力実測なし |\n| 比較方式 | AI なしの人力 |\n| 作業範囲 | 実装 |\n\n## 事前の推定\n\n| 最小 | 最大 | 根拠 | 推定した人 | 推定した日 |\n|---|---|---|---|---|\n| 1 時間 | 2 時間 | 根拠 | 人 | 2026-10-26 |\n\n## 実績\n\n| 日 | 指示 | レビュー | 手直し | 実行 | 待機 | うち判断根拠を探す時間 | 判断要求 | 試行 | 費用 | メモ |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;

describe('効率の入力の読取り', () => {
  it('[REQ-467] 置き場がなければ空の入力を返す', () => {
    expect(readEffortInputs(temporary())).toEqual({ manual: [], changes: [], locations: {} });
  });
  it('[REQ-467] 手書き記録と Effort 1 を辞書順に読み、template.md と .md 以外と下位ディレクトリは読まない', () => {
    const root = temporary(); change(root, 'add-x'); change(root, 'add-y');
    put(root, 'docs/effort/b.md', MANUAL('add-x')); put(root, 'docs/effort/a.md', MANUAL('未作成')); put(root, 'docs/effort/template.md', '壊れた様式');
    put(root, 'docs/effort/memo.txt', 'x'); put(root, 'docs/effort/sub/c.md', MANUAL('add-y'));
    effort(root, 'add-y'); effort(root, 'add-x', record('add-x', { minutes: { review: 5 } }), '20261106T010203Z-aaaaaaaaaaaa.json');
    const inputs = readEffortInputs(root);
    expect(inputs.manual.map((m) => m.path)).toEqual(['docs/effort/a.md', 'docs/effort/b.md']);
    expect(inputs.changes.map((c) => c.change)).toEqual(['add-x', 'add-y']);
    expect(inputs.changes[1]?.observations).toEqual([{ source: { path: `.loomake/evidence/add-y/effort/${NAME}` }, totalMinutes: 90 }]);
    expect(inputs.locations).toEqual({ 'add-x': 'active', 'add-y': 'active' });
  });
  it('[REQ-467] 再読取りは同じ結果で、原本の内容も更新時刻も新しいファイルも変えない', () => {
    const root = temporary(); change(root, 'add-x'); put(root, 'docs/effort/a.md', MANUAL('add-x')); effort(root, 'add-x');
    const files = () => readdirSync(root, { recursive: true }).sort().join();
    const before = [statSync(join(root, 'docs/effort/a.md')).mtimeMs, readFileSync(join(root, 'docs/effort/a.md'), 'utf8'), files()];
    const first = readEffortInputs(root);
    expect(readEffortInputs(root)).toEqual(first);
    expect([statSync(join(root, 'docs/effort/a.md')).mtimeMs, readFileSync(join(root, 'docs/effort/a.md'), 'utf8'), files()]).toEqual(before);
  });
  it('[REQ-467] 正規名でないファイル・一時ファイル・下位ディレクトリは本文を読まずに無視する', () => {
    const root = temporary(); change(root, 'add-x'); effort(root, 'add-x');
    for (const name of ['.loomake-evidence-1.tmp', 'note.json', '20261106T010203Z-AAAAAAAAAAAA.json']) put(root, `.loomake/evidence/add-x/effort/${name}`, '壊れている');
    put(root, `.loomake/evidence/add-x/effort/sub/${NAME}`, '壊れている');
    expect(readEffortInputs(root).changes).toMatchObject([{ change: 'add-x', observations: [expect.anything()] }]);
  });
  it('[REQ-467] 名前と内容が一致しない記録・不正な記録は、その change の実績を理由つきで算出不能にする', () => {
    const cases: [string, unknown, string][] = [
      ['change の不一致', record('add-y'), NAME], ['秒の不一致', record('add-x', { recordedAt: '2026-11-06T01:02:04.000Z' }), NAME],
      ['SHA の不一致', record('add-x', { sha: 'b'.repeat(40) }), NAME], ['構造の不正', record('add-x', { cost: [] }), NAME], ['日時の精度', record('add-x', { recordedAt: '2026-11-06T01:02Z' }), NAME],
    ];
    for (const [label, value, name] of cases) {
      const root = temporary(); change(root, 'add-x'); effort(root, 'add-x', value, name);
      expect(readEffortInputs(root).changes[0]?.invalid, label).toEqual(expect.stringContaining('20261106T010203Z-aaaaaaaaaaaa.json'));
    }
    const root = temporary(); put(root, `.loomake/evidence/add-x/effort/${NAME}`, '{壊れた JSON');
    expect(readEffortInputs(root).changes[0]?.invalid).toEqual(expect.any(String));
  });
  it('[REQ-467] Effort 1 は 65536 bytes ちょうどまで読み、超えると対象を示す UsageError で止まる', () => {
    const root = temporary(); change(root, 'add-x');
    const base = JSON.stringify(record('add-x'), null, 2) + '\n';
    const pad = 65536 - Buffer.byteLength(base);
    put(root, `.loomake/evidence/add-x/effort/${NAME}`, base + ' '.repeat(pad));
    expect(readEffortInputs(root).changes[0]?.invalid).toBeUndefined();
    put(root, `.loomake/evidence/add-x/effort/${NAME}`, base + ' '.repeat(pad + 1));
    expect(() => readEffortInputs(root)).toThrow(UsageError);
    expect(() => readEffortInputs(root)).toThrow(NAME);
  });
  it('[REQ-467] リンクと 1MiB 超は UsageError で止まり、部分的な結果を返さない', () => {
    const root = temporary(); put(root, 'docs/effort/real.md', MANUAL('未作成')); symlinkSync(join(root, 'docs/effort/real.md'), join(root, 'docs/effort/link.md'));
    expect(() => readEffortInputs(root)).toThrow(UsageError);
    const big = temporary(); put(big, 'docs/effort/big.md', Buffer.alloc(1024 * 1024 + 1, 97));
    expect(() => readEffortInputs(big)).toThrow(/1048576/);
  });
  it('[REQ-467] 合計 16MiB と探索 4096 項目を超えると、上限を示して止まる', () => {
    const total = temporary(); for (let i = 0; i < 17; i++) put(total, `docs/effort/f${String(i).padStart(2, '0')}.md`, Buffer.alloc(1024 * 1024, 97));
    expect(() => readEffortInputs(total)).toThrow(/合計の上限は16777216/);
    const many = temporary(); for (let i = 0; i < 4097; i++) put(many, `docs/effort/n${i}.txt`, '');
    expect(() => readEffortInputs(many)).toThrow(/探索項目の上限は4096/);
  });
  it('[REQ-467] OS の読取り失敗の分類を保ち、message の秘密は置換し、cause を付けない', () => {
    const secret = 'sk-' + 'a'.repeat(24);
    const root = temporary(); put(root, 'docs/effort/real.md', MANUAL('未作成')); symlinkSync(join(root, 'docs/effort/real.md'), join(root, `docs/effort/${secret}.md`));
    let thrown: unknown; try { readEffortInputs(root); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(UsageError);
    expect((thrown as Error).message).not.toContain(secret);
    expect((thrown as Error).cause).toBeUndefined();
    expect(InputReadFailure.prototype).toBeInstanceOf(UsageError);
  });
  it('[REQ-467] change の所在は resolveChangeDir と一致し、active と一意の archive だけを対応させる', () => {
    const root = temporary(); change(root, 'act'); archived(root, 'old'); archived(root, 'dup', '2026-10-01'); archived(root, 'dup', '2026-10-02');
    for (const id of ['act', 'old', 'dup', 'none']) { put(root, `docs/effort/${id}.md`, MANUAL(id)); effort(root, id); }
    const inputs = readEffortInputs(root);
    const expected = Object.fromEntries(['act', 'old', 'dup', 'none'].map((id) => [id, resolveChangeDir(join(root, 'openspec/changes'), id).kind]));
    expect(inputs.locations).toEqual(expected);
    const byPath = Object.fromEntries(inputs.manual.map((m) => [m.path.slice(12, -3), m.change]));
    expect(byPath['act']).toEqual({ status: 'single', id: 'act' });
    expect(byPath['old']).toEqual({ status: 'single', id: 'old' });
    expect(byPath['dup']).toMatchObject({ status: 'unmapped' });
    expect(byPath['none']).toMatchObject({ status: 'unmapped' });
  });
  it('[REQ-467] archive の探索は 1 回の読取りで 1 度だけで、change が多くても項目数の上限に達しない', () => {
    const root = temporary();
    for (let i = 0; i < 200; i++) archived(root, `old-${i}`);
    for (let i = 0; i < 30; i++) { change(root, `add-${i}`); effort(root, `add-${i}`); }
    expect(Object.keys(readEffortInputs(root).locations)).toHaveLength(30);
  });
});
