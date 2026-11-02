import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { reconstructOriginalContracts } from '../packages/kit/src/verify/trusted/original-contracts.js';
import { reconstructOriginalScope } from '../packages/kit/src/verify/trusted/original-cross-conditions.js';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';

let original: { file: string; text: string }[];
beforeAll(() => {
  const root = resolve(import.meta.dirname, '..');
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = verifyOriginalSnapshot(readGitDocuments(root, head, ORIGINAL_C001_SNAPSHOT_DIR), sha256Hex);
  expect(result.problems).toEqual([]);
  expect(result.documents).not.toBeNull();
  original = result.documents!;
});
const reconstruct = (files = original) => reconstructOriginalContracts(files, sha256Hex);
const mutate = (file: string, edit: (text: string) => string) => original.map((entry) => entry.file.endsWith(file) ? { ...entry, text: edit(entry.text) } : entry);

describe('原契約からの独立した集合復元', () => {
  it('[REQ-377][REQ-371] Aに固定した原文書から47契約・158 Scenario・46 Sourceと別契約のREQ-041を復元する', () => {
    const result = reconstruct();
    expect(result.problems).toEqual([]);
    expect(result.index?.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46 });
    expect(result.index?.contracts.filter((row) => row.original.sources.includes('REQ-041')).map((row) => row.key)).toEqual([
      'cli/modified/REQ-041', 'verify/modified/REQ-041',
    ]);
    expect(result.index?.contracts.find((row) => row.key === 'verify/modified/REQ-042')?.original.scenarios).toEqual(['commands のみ']);
    expect(result.index?.contracts.find((row) => row.key === 'verify/modified/REQ-038')?.original.scenarios).toHaveLength(9);
  });

  it('[REQ-377][REQ-371] 入力順と改行方式だけでは原集合のfingerprintを変えない', () => {
    const files = [...original].reverse().map((file) => ({ ...file, text: file.text.replace(/\r\n?/g, '\n').replaceAll('\n', '\r\n') }));
    expect(reconstruct(files)).toEqual(reconstruct());
  });

  it('[REQ-377][REQ-371] 原契約のTHEN変更は件数が同じでも本文と索引のhashを変える', () => {
    const before = reconstruct().index;
    const result = reconstruct(mutate('verify/spec.md', (text) => text.replace(/(#### Scenario: commands のみ[\s\S]*?\*\*THEN\*\* )[^\n]*/, '$1別の結果を返す')));
    expect(result.problems).toEqual([]);
    expect(result.index?.counts).toEqual(before?.counts);
    expect(result.index?.sha256).not.toBe(before?.sha256);
    expect(result.index?.contracts.find((row) => row.key === 'verify/modified/REQ-042')?.original.block)
      .not.toBe(before?.contracts.find((row) => row.key === 'verify/modified/REQ-042')?.original.block);
  });

  it('[REQ-377][REQ-371] 同じREQ番号が別契約に残っても欠落した契約を受理しない', () => {
    expect(reconstruct(original.filter((file) => !file.file.endsWith('/cli/spec.md'))).index).toBeNull();
    const removed = mutate('verify/spec.md', (text) => text.replace(/#### Scenario: commands のみ[\s\S]*?(?=### Requirement:)/, ''));
    expect(reconstruct(removed).index).toBeNull();
  });

  it('[REQ-377][REQ-371] 件数を保ってScenario名だけ重ねた索引を作らない', () => {
    const result = reconstruct(mutate('cli/spec.md', (text) => text.replace('#### Scenario: サブコマンドのヘルプ', '#### Scenario: 全体のヘルプ')));
    expect(result.index).toBeNull();
    expect(result.problems.some((problem) => problem.includes('Scenario'))).toBe(true);
  });

  it('[REQ-377][REQ-371] fence内の偽Scenarioは原集合へ足さず、本文のhashには含める', () => {
    const files = mutate('cli/spec.md', (text) => text.replace('#### Scenario: 全体のヘルプ', '~~~~md\n#### Scenario: 偽\n```\n~~~~\n#### Scenario: 全体のヘルプ'));
    const before = reconstruct().index;
    const after = reconstruct(files);
    expect(after.problems).toEqual([]);
    expect(after.index?.counts).toEqual(before?.counts);
    expect(after.index?.contracts.map((row) => row.original.scenarios)).toEqual(before?.contracts.map((row) => row.original.scenarios));
    expect(after.index?.sha256).not.toBe(before?.sha256);
  });

  it('[REQ-377][REQ-371] 元16条件を47契約の群へ結び、旧PR配分をownerとして採用しない', () => {
    const result = reconstructOriginalScope(original, sha256Hex);
    expect(result.problems).toEqual([]);
    expect(result.scope?.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
    expect(result.scope?.cross.map((condition) => condition.no)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(result.scope?.cross[0]).toMatchObject({ title: '具体別承認/生成基準/過去回答', group: 'G1' });
    expect(result.scope?.cross[5]).toMatchObject({ title: '独立S1/実証跡/受入', group: 'G4' });
    expect(result.scope?.cross[15]).toMatchObject({ title: 'REQ205とREQ-337保持', group: 'G2' });
    const keys = new Set(result.scope?.contracts.map((row) => row.key));
    for (const condition of result.scope?.cross ?? []) expect(condition.rows.every((key) => keys.has(key))).toBe(true);
    expect(JSON.stringify(result.scope)).not.toContain('proposedPR');
    expect(reconstructOriginalScope(original.slice(1), sha256Hex).scope).toBeNull();
  });

  it('[REQ-377][REQ-371] 返した索引を変更しても後の復元に使う元16条件を変えない', () => {
    const first = reconstructOriginalScope(original, sha256Hex).scope!;
    const expected = reconstructOriginalScope(original, sha256Hex).scope;
    first.cross[0].rows.pop(); first.cross[0].title = '改変';
    expect(reconstructOriginalScope(original, sha256Hex).scope).toEqual(expected);
  });
});
