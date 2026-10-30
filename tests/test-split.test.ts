import { describe, expect, it } from 'vitest';
import { filesFor, includeCase, isPullRequestRun, type SplitRegistry } from './test-split.js';

const registry: SplitRegistry = {
  'mixed.test.ts': { slow: 'mixed.slow.test.ts', cases: { first: ['win32'], second: ['linux', 'darwin'], third: [] } },
  'all.test.ts': { slow: 'all.slow.test.ts', cases: { only: ['linux', 'darwin', 'win32'] } },
  'empty.test.ts': { slow: 'empty.slow.test.ts', cases: {} },
};

describe('測定したケースのfast/slow選択', () => {
  it('空の測定一覧ではfast/slowの対象ファイルを追加しない', () => {
    expect(filesFor('fast', 'linux', {})).toEqual({ include: [], exclude: [] });
    expect(filesFor('slow', 'linux', {})).toEqual({ include: [], exclude: [] });
  });

  it.each(['linux', 'darwin', 'win32', 'freebsd'])('%sでfastとslowを合わせると全ケースに一度ずつ対応する', (os) => {
    for (const [file, entry] of Object.entries(registry)) {
      for (const id of Object.keys(entry.cases)) {
        const fast = includeCase(file, 'fast', id, os, registry);
        const slow = includeCase(file, 'slow', id, os, registry);
        expect(Number(fast) + Number(slow)).toBe(1);
        expect(slow).toBe(entry.cases[id]!.some((platform) => platform === os));
      }
      for (const part of ['fast', 'slow'] as const) {
        const files = filesFor(part, os, registry);
        const selected = Object.keys(entry.cases).some((id) => includeCase(file, part, id, os, registry));
        const path = part === 'fast' ? file : entry.slow;
        expect(files.include.includes(path)).toBe(selected);
        expect(files.exclude.includes(path)).toBe(!selected);
      }
    }
  });

  it('未知の実行OSでは全件をfastにし、空ファイルは両方から除く', () => {
    expect(filesFor('fast', 'freebsd', registry)).toEqual({ include: ['mixed.test.ts', 'all.test.ts'], exclude: ['empty.test.ts'] });
    expect(filesFor('slow', 'freebsd', registry)).toEqual({ include: [], exclude: ['mixed.slow.test.ts', 'all.slow.test.ts', 'empty.slow.test.ts'] });
  });

  it('未登録ファイル・ケース・一覧のOS誤記を黙ってfastへ入れない', () => {
    expect(() => includeCase('unknown', 'fast', 'first', 'linux', registry)).toThrow('ファイルが登録されていません');
    expect(() => includeCase('mixed.test.ts', 'fast', 'unknown', 'linux', registry)).toThrow('ケースが登録されていません');
    expect(() => includeCase('toString', 'fast', 'first', 'linux', registry)).toThrow('ファイルが登録されていません');
    expect(() => includeCase('mixed.test.ts', 'fast', 'toString', 'linux', registry)).toThrow('ケースが登録されていません');
    const typo = { 'typo.test.ts': { slow: 'typo.slow.test.ts', cases: { first: ['windows'] } } } as unknown as SplitRegistry;
    expect(() => filesFor('fast', 'linux', typo)).toThrow('不明なOS');
  });

  it.each([
    [{ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }, true],
    [{ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' }, false],
    [{ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'schedule' }, false],
    [{ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch' }, false],
    [{ GITHUB_ACTIONS: 'false', GITHUB_EVENT_NAME: 'pull_request' }, false],
    [{ GITHUB_EVENT_NAME: 'pull_request' }, false],
    [{}, false],
  ])('GitHub PRだけを識別する：%j', (env, expected) => {
    expect(isPullRequestRun(env)).toBe(expected);
  });
});
