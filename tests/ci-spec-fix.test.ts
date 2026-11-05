import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { changedTestReqIds, declaredReqs, declaredRoutes, mainSpecSourceIds, specFixDecision } from '../scripts/ci-spec-fix.mjs';

type Entry = { status: string; modes: [string, string]; paths: string[] };
const entry = (status = 'M', paths = ['tests/a.test.ts']): Entry => ({ status, modes: ['100644', '100644'], paths });
const original = "it('[REQ-010] works', () => { expect(1).toBe(0); });\n";
const changed = original.replace('toBe(0)', 'toBe(1)');
const sourceIds = new Set(['REQ-010', 'REQ-011']);
const body = 'loomake-change: none\nloomake-route: spec-fix\nloomake-req: REQ-010';
const reader = (...sources: [] | [string | undefined, string | undefined]) => {
  const [before, after] = sources.length ? sources : [original, changed];
  return (side: string) => side === 'old' ? before : after;
};

describe('仕様適合の修正の条件', () => {
  it('[REQ-343] 複数行とカンマ区切り・重複・CRLFの宣言を読む', () => {
    expect(declaredRoutes(' loomake-route: SPEC-FIX\r\nloomake-route: spec-fix')).toEqual(['SPEC-FIX', 'spec-fix']);
    expect(declaredReqs('loomake-req: REQ-010, REQ-011\r\nloomake-req: REQ-010')).toEqual({ ids: ['REQ-010', 'REQ-011'], invalid: [] });
  });
  it.each(['', 'REQ-1', 'REQ-010x', 'REQ-010、REQ-011', 'REQ-010,'])('[REQ-343] 空値と不正なREQ宣言を拒む（%s）', (value) => {
    expect(declaredReqs(`loomake-req: ${value}`).invalid.length).toBeGreaterThan(0);
  });
  it('[REQ-343] routeがなければ従来経路を返す', () => {
    expect(specFixDecision({ body: 'loomake-req: REQ-010', entries: [], sourceIds, readFile: reader() })).toEqual({ route: false });
  });
  it('[REQ-343] 3条件成立で受け付ける', () => {
    expect(specFixDecision({ body, entries: [entry()], sourceIds, readFile: reader() })).toEqual({ route: true, ids: ['REQ-010'], problems: [] });
  });
  it('[REQ-343] 大文字のrouteも受け付ける', () => {
    const result = specFixDecision({ body: body.replace('spec-fix', 'SPEC-FIX'), entries: [entry()], sourceIds, readFile: reader() });
    expect(result.problems).toEqual([]);
  });
  it('[REQ-343] routeの食い違いと空値を拒む', () => {
    for (const value of ['', 'normal']) {
      const result = specFixDecision({ body: `${body}\nloomake-route: ${value}`, entries: [entry()], sourceIds, readFile: reader() });
      expect(result.problems.join(' ')).toContain('loomake-route:');
    }
  });
  it('[REQ-343] 不足する条件をすべて示す', () => {
    const result = specFixDecision({ body: body.replace('REQ-010', 'REQ-999'), entries: [entry('D', ['openspec/changes/c1/tasks.md'])], sourceIds, readFile: reader() });
    expect(result.problems.join(' ')).toContain('openspec/');
    expect(result.problems.join(' ')).toContain('Source');
    expect(result.problems.join(' ')).toContain('REQ-999');
    expect(result.problems.length).toBeGreaterThanOrEqual(3);
  });
  it.each([
    entry('R100', ['openspec/specs/x/spec.md', 'docs/copied.md']),
    entry('R100', ['docs/a.md', 'openspec/specs/x/spec.md']),
  ])('[REQ-343] openspecの名前変更は変更前後の両パスで拒む（%j）', (change) => {
    expect(specFixDecision({ body, entries: [change, entry()], sourceIds, readFile: reader() }).problems.join(' ')).toContain('openspec/');
  });
  it('[REQ-343] REQ宣言がなければ拒む', () => {
    expect(specFixDecision({ body: 'loomake-route: spec-fix', entries: [entry()], sourceIds, readFile: reader() }).problems.join(' ')).toContain('REQ ID');
  });
});

describe('主仕様のRequirement Source', () => {
  it('[REQ-343] 主仕様のSourceだけを読み、フェンスと差分仕様を除く', () => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-spec-fix-source-'));
    const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
    try {
      write('openspec/specs/x/spec.md', 'Source: REQ-099\n### Requirement: real\n本文 SHALL。\nSource: REQ-010\n```markdown\n### Requirement: example\nSource: REQ-011\n```\n');
      write('openspec/changes/c1/specs/x/spec.md', '## ADDED Requirements\n### Requirement: delta\n本文 SHALL。\nSource: REQ-012\n');
      expect([...mainSpecSourceIds(join(root, 'openspec/specs'))]).toEqual(['REQ-010']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('名前にREQを持つ変更した試験', () => {
  it.each([
    ['追加', entry('A'), undefined, changed],
    ['本文変更', entry(), original, changed],
    ['名前変更と本文変更', entry('R080', ['tests/old.test.ts', 'tests/a.test.ts']), original, changed],
    ['each', entry('A'), undefined, "it.each([1, 2])('[REQ-010] works %s', (n) => { expect(n).toBeGreaterThan(0); });"],
  ])('[REQ-343] %sを数える', (_name, change, before, after) => {
    const result = changedTestReqIds([change], reader(before, after));
    expect([...result.ids]).toEqual(['REQ-010']);
    expect(result.problems).toEqual([]);
  });
  it.each([
    ['名前変更だけ', entry('R100', ['tests/old.test.ts', 'tests/a.test.ts']), original, original],
    ['未変更の試験にコメントを追加', entry(), original, `${original}// REQ-010\n`],
    ['削除', entry('D'), original, undefined],
    ['コメント内の偽宣言', entry('A'), undefined, `// ${changed}`],
    ['文字列内の偽宣言', entry('A'), undefined, JSON.stringify(changed)],
    ['本文にだけREQ', entry('A'), undefined, "it('other', () => { const value = '[REQ-010]'; });"],
    ['include範囲外', entry('A', ['scripts/a.test.ts']), undefined, changed],
    ['skip', entry('A'), undefined, changed.replace('it(', 'it.skip(')],
    ['todo', entry('A'), undefined, "it.todo('[REQ-010] pending');"],
    ['skipIf', entry('A'), undefined, changed.replace('it(', 'it.skipIf(true)(')],
    ['runIf', entry('A'), undefined, changed.replace('it(', 'it.runIf(false)(')],
  ])('[REQ-343] %sを数えない', (_name, change, before, after) => {
    expect([...changedTestReqIds([change], reader(before, after)).ids]).toEqual([]);
  });
  it('[REQ-343] 1つの名前の複数IDを正確に集める', () => {
    const result = changedTestReqIds([entry('A')], reader(undefined, changed.replace('[REQ-010]', '[REQ-010][REQ-0100]')));
    expect([...result.ids]).toEqual(['REQ-010', 'REQ-0100']);
  });
  it('[REQ-343] 変更前の内容を読めないMと変更後を読めないAを拒む', () => {
    for (const [change, readFile] of [[entry(), reader(undefined, changed)], [entry('A'), reader(undefined, undefined)]] as const) {
      expect(changedTestReqIds([change], readFile).problems.join(' ')).toContain('読めません');
    }
  });
});
