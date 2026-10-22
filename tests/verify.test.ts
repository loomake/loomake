// 試作の scripts/verify.mjs の回帰テスト。change の要件ではないので、テスト名に要件 ID を入れない。
// 入力は tests/fixtures/verify-project/ に置く。このファイルに [REQ-xxx] を書くと、このリポジトリの要件テストとして数えられてしまう
import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const verify = join(import.meta.dirname, '..', 'scripts', 'verify.mjs');
const fixture = join(import.meta.dirname, 'fixtures', 'verify-project');

const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [verify, ...args], { cwd, encoding: 'utf8' });

function runWithConfig(config: string) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-verify-'));
  writeFileSync(join(dir, 'loomake.config.json'), config);
  const r = run(dir);
  rmSync(dir, { recursive: true, force: true });
  return r;
}

describe('verify.mjs', () => {
  it('skip・todo・skipIf・runIf の中とコメントの要件 ID は数えず、有効なテストだけを数える', () => {
    const r = run(fixture, '--change', 'sample', '--done', '--json');
    const out = JSON.parse(r.stdout);
    const covered = Object.entries(out.coverage as Record<string, string[]>)
      .filter(([, files]) => files.length > 0)
      .map(([id]) => id);
    // 数えるものと数えないものの内訳は tests/fixtures/verify-project/tests/skip.case.txt にある
    expect(covered).toEqual(['REQ-004', 'REQ-010', 'REQ-011']);
    expect(Object.keys(out.coverage)).toHaveLength(16);
    expect(r.status).toBe(1);
  });

  it('表のセルの \\| は区切りではなく文字として読む', () => {
    const r = run(fixture, '--change', 'sample', '--spec-only', '--json');
    const failed = JSON.parse(r.stdout)
      .results.filter((x: { status: string }) => x.status === 'fail')
      .map((x: { check: string }) => x.check);
    expect(failed).toEqual([]);
    expect(r.status).toBe(0);
  });

  it('CRLF で保存した trace.md・spec.md・tasks.md も読める', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-verify-'));
    cpSync(fixture, dir, { recursive: true });
    for (const entry of readdirSync(join(dir, 'openspec'), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const p = join(entry.parentPath, entry.name);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\n/g, '\r\n'));
    }
    const specOnly = run(dir, '--change', 'sample', '--spec-only');
    // tasks.md を読むのは --done だけなので、--done の結果も LF のときと比べる
    const crlf = JSON.parse(run(dir, '--change', 'sample', '--done', '--skip-commands', '--json').stdout);
    rmSync(dir, { recursive: true, force: true });
    const lf = JSON.parse(run(fixture, '--change', 'sample', '--done', '--skip-commands', '--json').stdout);
    expect(specOnly.status, specOnly.stdout).toBe(0);
    expect(crlf.results).toEqual(lf.results);
    expect(crlf.results).toContainEqual({ check: 'tasks.md', status: 'pass', detail: '1 件すべて完了' });
  });

  it('loomake.config.json が JSON として読めないときは終了コード 2', () => {
    const r = runWithConfig('{');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('loomake.config.json を読めません');
  });

  it('loomake.config.json の tests・commands の形が正しくないときは終了コード 2', () => {
    const cases: [string, string][] = [
      ['{"tests":"x"}', 'tests はオブジェクト'],
      ['{"tests":{"dirs":"tests"}}', 'tests.dirs は文字列の配列'],
      ['{"tests":{"dirs":[1]}}', 'tests.dirs は文字列の配列'],
      ['{"tests":{"pattern":1}}', 'tests.pattern は文字列'],
      ['{"tests":{"pattern":"("}}', 'tests.pattern が正規表現として読めません'],
      ['{"commands":{"test":1}}', 'commands は、値が文字列（または null）のオブジェクト'],
      ['{"openspecDir":1}', 'openspecDir は文字列'],
    ];
    for (const [config, message] of cases) {
      const r = runWithConfig(config);
      expect(r.status, config).toBe(2);
      expect(r.stderr, config).toContain(message);
    }
  });

  it('loomake.config.json がオブジェクトでないときは終了コード 2', () => {
    for (const config of ['null', '[]', '1']) {
      const r = runWithConfig(config);
      expect(r.status, config).toBe(2);
      expect(r.stderr, config).toContain('JSON のオブジェクトにしてください');
    }
  });
});
