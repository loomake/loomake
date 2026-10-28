import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactName, createDiagnostics, parseTestReport, renderSummary, escapeSummaryText } from '../scripts/ci-test-diagnostics.mjs';

const directories: string[] = [];
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-ci-diagnostics-'));
  directories.push(cwd);
  spawnSync('git', ['init', '--quiet'], { cwd });
  spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture'], { cwd });
  mkdirSync(join(cwd, '.loomake'));
  return cwd;
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'loomake/loomake', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', RUNNER_OS: 'Windows', CI_TEST_OS: 'windows-latest', CI_TEST_SHARD: '1/2', CI_TEST_OUTCOME: 'failure' };

describe('CI のテスト診断', () => {
  it('[REQ-289] run・試行・OS・シャードごとに artifact 名を分ける', () => {
    expect(artifactName(env)).toBe('ci-tests-123-2-windows-latest-1-2');
    const variants = [env, { ...env, CI_TEST_SHARD: '2/2' }, { ...env, GITHUB_RUN_ATTEMPT: '3' }, { ...env, CI_TEST_OS: 'ubuntu-latest' }, { ...env, GITHUB_RUN_ID: '124' }];
    expect(new Set(variants.map(artifactName)).size).toBe(5);
    expect(artifactName({ ...env, CI_TEST_SHARD: '' })).toMatch(/-all$/);
  });

  it('[REQ-289] 実際の checkout SHA と Node 版を記録し、元レポートだけを写す', () => {
    const cwd = fixture();
    const raw = '{"testResults": []}\n';
    writeFileSync(join(cwd, '.loomake/test-report.json'), raw);
    writeFileSync(join(cwd, '.loomake/private.txt'), '保存対象外');
    const result = createDiagnostics({ cwd, env: { ...env, RUNNER_TEMP: cwd, GITHUB_SHA: 'pr-head-is-not-checkout' } });
    expect(result.metadata).toMatchObject({ schemaVersion: 1, runUrl: 'https://github.com/loomake/loomake/actions/runs/123', runId: '123', runAttempt: '2', os: 'windows-latest', node: process.version, shard: '1/2', testOutcome: 'failure' });
    expect(result.metadata.checkoutSha).toBe(spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim());
    expect(JSON.parse(readFileSync(join(result.directory, 'metadata.json'), 'utf8'))).toEqual(result.metadata);
    expect(readFileSync(join(result.directory, 'test-report.json'), 'utf8')).toBe(raw);
    expect(readdirSync(result.directory).sort()).toEqual(['metadata.json', 'summary.md', 'test-report.json']);
    expect(createDiagnostics({ cwd, env: { RUNNER_TEMP: cwd, RUNNER_OS: 'Linux' } }).metadata).toMatchObject({ shard: 'all', os: 'Linux', testOutcome: 'not_run' });
  });
});

const report = (tests: object[], file = 'tests/example.test.ts') => JSON.stringify({ testResults: [{ name: file, assertionResults: tests }] });
const metadata = { testOutcome: 'failure', runUrl: 'https://github.com/loomake/loomake/actions/runs/123', runAttempt: '2', checkoutSha: 'abc', os: 'Windows', node: 'v24.0.0', shard: '1/2' };

describe('診断レポートの要約', () => {
  it('[REQ-290] 全結果を状態別に数え、失敗の完全名と時間順を表示する', () => {
    const parsed = parseTestReport(report([
      { fullName: 'suite succeeds', status: 'passed', duration: 20 },
      { fullName: 'suite fails', status: 'failed', duration: 120, failureMessages: ['要約には載せない失敗メッセージ'] },
      { fullName: 'suite skips', status: 'skipped' },
      { fullName: 'suite pending', status: 'pending', duration: null },
      { fullName: 'suite todo', status: 'todo' },
      { fullName: 'suite disabled', status: 'disabled' },
    ]));
    expect(parsed.reportState).toBe('valid');
    expect(parsed.counts).toEqual({ passed: 1, failed: 1, skipped: 1, pending: 1, todo: 1, disabled: 1 });
    const summary = renderSummary(metadata, parsed);
    expect(summary).toContain('テストステップ：失敗');
    expect(summary).toContain('状態別件数：成功 1 / 失敗 1 / pending 1 / skip 1 / todo 1 / disabled 1');
    expect(summary).toContain('suite fails');
    expect(summary).toContain('tests/example&#46;test&#46;ts');
    expect(summary).not.toContain('要約には載せない失敗メッセージ');
    const slow = summary.split('### 所要時間')[1]!;
    expect(slow.indexOf('suite fails')).toBeLessThan(slow.indexOf('suite succeeds'));
    expect(slow).not.toContain('suite skips');
    expect(slow).not.toContain('suite pending');
  });

  it('[REQ-290] 欠損・不正なJSONや構造・空の結果を成功として表示しない', () => {
    for (const [raw, state] of [[undefined, 'missing'], ['{', 'invalid'], ['null', 'invalid'], ['{}', 'invalid'], ['{"testResults":[{}]}', 'invalid'], [report([{ fullName: 'bad', status: 'unknown' }]), 'invalid'], [report([{ fullName: 'bad', status: 'passed', duration: -1 }]), 'invalid'], [report([{ status: 'passed' }]), 'invalid'], ['{"testResults":[]}', 'empty'], [report([]), 'empty']] as const) {
      const parsed = parseTestReport(raw);
      expect(parsed.reportState).toBe(state);
      const summary = renderSummary({ ...metadata, testOutcome: 'not_run' }, parsed);
      expect(summary).toContain('テストステップ：未実行');
      expect(summary).toContain('レポートからテストの成功は確認できません');
      expect(summary).not.toContain('全件成功');
    }
    // 読めるレポートがあっても、テストステップが未実行なら別々に表示する。
    expect(renderSummary({ ...metadata, testOutcome: 'not_run' }, parseTestReport(report([{ fullName: 'a', status: 'passed' }])))).toContain('テストステップ：未実行');
  });

  it('[REQ-290] 失敗20件・時間上位10件に制限し、省略しても全件を集計する', () => {
    const parsed = parseTestReport(report(Array.from({ length: 25 }, (_, i) => ({ fullName: `test ${i}`, status: 'failed', duration: i }))));
    const summary = renderSummary(metadata, parsed);
    const failed = summary.split('### 失敗したテスト')[1]!.split('### 所要時間')[0]!;
    const slow = summary.split('### 所要時間')[1]!;
    expect((failed.match(/^- /gm) || []).length).toBe(20);
    expect((slow.match(/^- /gm) || []).length).toBe(10);
    expect(failed).toContain('ほか 5 件を省略');
    expect(slow).toContain('ほか 15 件を省略');
    expect(parsed.counts.failed).toBe(25);
    expect(slow).toContain('test 24：24 ms');
    expect(slow).not.toContain('test 14：14 ms');
  });

  it('[REQ-290] 名前を200文字で省略し、Markdown・HTML・改行をエスケープし、全体を32KiB以内に収める', () => {
    const dangerous = '[link](https://example.invalid) | <script> & `code`\n# title \\ **bold**';
    const escaped = escapeSummaryText(dangerous);
    expect(escaped).not.toMatch(/[<\n|`*]/);
    expect(escaped).toContain('&#91;link&#93;');
    expect(escaped).toContain('&#60;script&#62;');
    expect(escaped).toContain('&#38;');
    expect(escaped).toContain('&#92;');
    expect(escapeSummaryText('あ'.repeat(201))).toBe('あ'.repeat(200) + '…（文字を省略）');
    const parsed = parseTestReport(report(Array.from({ length: 100 }, () => ({ fullName: '*'.repeat(2000), status: 'failed', duration: 1 })), '*'.repeat(2000)));
    const summary = renderSummary(metadata, parsed);
    expect(Buffer.byteLength(summary, 'utf8')).toBeLessThanOrEqual(32 * 1024);
    expect(summary).toContain('文字を省略');
    expect(summary).toContain('件を省略');
    expect(parsed.counts.failed).toBe(100);
  });

  it('[REQ-289][REQ-290] metadata にレポート状態と全件集計を書き、要約と不正レポートの写しも保存する', () => {
    const cwd = fixture();
    const path = join(cwd, '.loomake/test-report.json');
    writeFileSync(path, report([{ fullName: 'suite test', status: 'passed', duration: 0 }]));
    const valid = createDiagnostics({ cwd, env: { ...env, RUNNER_TEMP: cwd } });
    expect(valid.metadata).toMatchObject({ reportState: 'valid', counts: { passed: 1 } });
    expect(readFileSync(join(valid.directory, 'summary.md'), 'utf8')).toBe(valid.summary);
    writeFileSync(path, '{invalid');
    const invalid = createDiagnostics({ cwd, env: { ...env, RUNNER_TEMP: cwd } });
    expect(invalid.metadata).toMatchObject({ reportState: 'invalid', counts: { passed: 0 } });
    expect(readFileSync(join(invalid.directory, 'test-report.json'), 'utf8')).toBe('{invalid');
    rmSync(path);
    const missing = createDiagnostics({ cwd, env: { ...env, RUNNER_TEMP: cwd } });
    expect(missing.metadata).toMatchObject({ reportState: 'missing' });
    expect(readdirSync(missing.directory).sort()).toEqual(['metadata.json', 'summary.md']);
  });
});
