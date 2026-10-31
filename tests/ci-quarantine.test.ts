import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { excludedFiles, loadQuarantine, MAX_DAYS, QuarantineError, quarantineMatrix, todayInJapan, validateQuarantine } from '../scripts/ci-quarantine.mjs';

const root = join(import.meta.dirname, '..');
const script = join(root, 'scripts/ci-quarantine.mjs');
const entry = (overrides: Record<string, unknown> = {}) => ({
  file: 'packages/runner/test/guards.test.ts', tests: ['[REQ-201] テストを足すだけなら止まらない'], os: ['windows-latest'],
  issue: 116, added: '2026-10-31', expires: '2026-11-14', ...overrides,
});
const check = (entries: unknown[], today = '2026-11-01', exists = () => true) => validateQuarantine({ entries }, { today, exists });
const failure = (entries: unknown[], today?: string, exists?: () => boolean) => {
  try { check(entries, today, exists); } catch (error) { expect(error).toBeInstanceOf(QuarantineError); return (error as Error).message; }
  throw new Error('検査が成功してしまった');
};

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function repo(entries: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-quarantine-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'tests'));
  mkdirSync(join(dir, 'packages/runner/test'), { recursive: true });
  writeFileSync(join(dir, 'packages/runner/test/guards.test.ts'), '');
  writeFileSync(join(dir, 'tests/a.test.ts'), '');
  writeFileSync(join(dir, 'tests/quarantine.json'), JSON.stringify({ entries }));
  return dir;
}
function cli(dir: string, args: string[], today = '2026-11-01') {
  const output = join(dir, 'github-output');
  writeFileSync(output, '');
  // スクリプトは自分の場所の 1 つ上をリポジトリとして読むので、写しを置いて動かす
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts/ci-quarantine.mjs'), readFileSync(script));
  const result = spawnSync(process.execPath, [join(dir, 'scripts/ci-quarantine.mjs'), ...args], {
    encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, LOOMAKE_QUARANTINE_TODAY: today },
  });
  const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  return { ...result, outputs };
}

describe('試験の隔離一覧', () => {
  it('[REQ-344] 期限内のエントリは、指定した OS のシャードでだけ除外の対象になる', () => {
    const entries = check([entry()], '2026-11-14');
    expect(excludedFiles(entries, 'windows-latest')).toEqual(['packages/runner/test/guards.test.ts']);
    expect(excludedFiles(entries, 'macos-latest')).toEqual([]);
    const dir = repo([entry()]);
    const windows = cli(dir, ['--os', 'windows-latest'], '2026-11-14');
    expect(windows.status, windows.stderr).toBe(0);
    expect(windows.outputs).toEqual({ exclude: '["packages/runner/test/guards.test.ts"]', has_entries: 'true' });
    expect(windows.stderr).toContain('packages/runner/test/guards.test.ts');
    const mac = cli(dir, ['--os', 'macos-latest'], '2026-11-14');
    expect(mac.status, mac.stderr).toBe(0);
    expect(mac.outputs).toEqual({ exclude: '[]', has_entries: 'false' });
  });

  it('[REQ-344] 期限を過ぎた一覧は、ファイルと Issue 番号を示して終了コード 2 で失敗する', () => {
    const message = failure([entry()], '2026-11-15');
    expect(message).toContain('期限 2026-11-14 を過ぎました');
    expect(message).toContain('packages/runner/test/guards.test.ts');
    expect(message).toContain('#116');
    const result = cli(repo([entry()]), ['--os', 'windows-latest'], '2026-11-15');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('期限 2026-11-14 を過ぎました');
    expect(result.outputs).toEqual({});
    // --matrix も同じ検査をする
    expect(cli(repo([entry()]), ['--matrix'], '2026-11-15').status).toBe(2);
  });

  it('[REQ-344] 日本時間の日付で比べる', () => {
    // 2026-11-14 15:00 UTC は日本時間で 2026-11-15 0:00
    expect(todayInJapan(Date.parse('2026-11-14T14:59:59Z'))).toBe('2026-11-14');
    expect(todayInJapan(Date.parse('2026-11-14T15:00:00Z'))).toBe('2026-11-15');
  });

  it('[REQ-344] OS に ubuntu-latest や対象外の値がある一覧は失敗する', () => {
    expect(failure([entry({ os: ['windows-latest', 'ubuntu-latest'] })])).toContain('Ubuntu の試験は隔離できません');
    expect(failure([entry({ os: ['windows-2019'] })])).toContain('対象外');
    expect(failure([entry({ os: [] })])).toContain('1 つ以上');
    expect(failure([entry({ os: ['macos-latest', 'macos-latest'] })])).toContain('2 回');
    const result = cli(repo([entry({ os: ['ubuntu-latest'] })]), ['--os', 'windows-latest']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('ubuntu-latest');
    // Ubuntu のシャード向けには出力しない
    const ubuntu = cli(repo([entry()]), ['--os', 'ubuntu-latest']);
    expect(ubuntu.status).toBe(2);
    expect(ubuntu.stderr).toContain('Ubuntu は一覧を読みません');
  });

  it('[REQ-344] 期限は追加日から 14 日以内で、追加日より前にはできない', () => {
    expect(MAX_DAYS).toBe(14);
    expect(check([entry({ added: '2026-10-31', expires: '2026-11-14' })], '2026-10-31')).toHaveLength(1);
    expect(failure([entry({ added: '2026-10-31', expires: '2026-11-15' })], '2026-10-31')).toContain('14 日以内');
    expect(failure([entry({ added: '2026-11-02', expires: '2026-11-01' })], '2026-10-31')).toContain('より前');
    expect(failure([entry({ expires: '2026-02-30' })])).toContain('日付として読めません');
    expect(failure([entry({ added: '2026/10/31' })])).toContain('YYYY-MM-DD');
  });

  it('[REQ-344] 存在しないファイル・試験でないパス・重複は失敗する', () => {
    expect(failure([entry()], undefined, () => false)).toContain('ファイルがありません');
    for (const file of ['packages/runner/src/run.ts', 'docs/a.test.ts', '../tests/a.test.ts', 'tests/../packages/a.test.ts', 'tests\\a.test.ts', 'tests/a test.test.ts'])
      expect(failure([entry({ file })]), file).toContain('.test.ts');
    expect(failure([entry(), entry({ os: ['macos-latest'] })])).toContain('2 回');
    const result = cli(repo([entry({ file: 'tests/missing.test.ts' })]), ['--os', 'windows-latest']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('（tests/missing.test.ts） のファイルがありません');
  });

  it('[REQ-344] 形式の誤りは失敗する', () => {
    for (const data of [null, [], {}, { entries: {} }]) expect(() => validateQuarantine(data, { today: '2026-11-01', exists: () => true })).toThrow(QuarantineError);
    expect(failure([entry({ issue: 0 })])).toContain('Issue');
    expect(failure([entry({ issue: '116' })])).toContain('Issue');
    expect(failure([entry({ tests: 'a' })])).toContain('記録用');
    expect(failure([entry({ skip: true })])).toContain('知らない項目');
    expect(failure(['a'])).toContain('オブジェクト');
    const dir = repo([]);
    writeFileSync(join(dir, 'tests/quarantine.json'), '{');
    expect(cli(dir, ['--os', 'windows-latest']).status).toBe(2);
    expect(cli(repo([]), ['--unknown']).status).toBe(2);
  });

  it('[REQ-344] 空の一覧なら除外の対象を出さず、has_entries を false にする', () => {
    const dir = repo([]);
    expect(cli(dir, ['--os', 'windows-latest']).outputs).toEqual({ exclude: '[]', has_entries: 'false' });
    expect(cli(dir, ['--matrix']).outputs).toEqual({ matrix: '{"include":[]}', has_entries: 'false' });
  });

  it('[REQ-344] 隔離のジョブの matrix は一覧の OS ごとにまとめ、サンプルの数だけ並べる', () => {
    const entries = check([entry(), entry({ file: 'tests/a.test.ts', os: ['windows-latest', 'macos-latest'], issue: 183 })]);
    expect(quarantineMatrix(entries)).toEqual({ include: [
      { os: 'macos-latest', sample: 1, files: 'tests/a.test.ts' },
      { os: 'windows-latest', sample: 1, files: 'packages/runner/test/guards.test.ts tests/a.test.ts' },
    ] });
    expect(quarantineMatrix(entries, 3).include.filter((item) => item.os === 'windows-latest').map((item) => item.sample)).toEqual([1, 2, 3]);
    expect(() => quarantineMatrix(entries, 6)).toThrow(QuarantineError);
    const result = cli(repo([entry()]), ['--matrix', '--samples', '2']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.outputs.matrix!).include).toHaveLength(2);
    expect(result.outputs.has_entries).toBe('true');
  });

  it('[REQ-344] リポジトリの一覧は形式どおりで、各エントリに Issue 番号と 14 日以内の期限がある', () => {
    // 期限切れはここでは見ない（日付で main の試験が落ちないようにする）。期限は CI の ci-quarantine.mjs で確かめる
    const data = JSON.parse(readFileSync(join(root, 'tests/quarantine.json'), 'utf8'));
    const entries = loadQuarantine(root, data.entries[0]?.added ?? '2026-10-31');
    for (const item of entries) {
      expect(item.issue).toBeGreaterThan(0);
      expect(item.os).not.toContain('ubuntu-latest');
    }
  });
});
