#!/usr/bin/env node
// quality ジョブのテスト結果を、checkout したコミットと実行環境に結び付ける。
import { Buffer } from 'node:buffer';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {Record<string, string | undefined>} env */
export function artifactName(env) {
  const part = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `ci-tests-${part(env.GITHUB_RUN_ID || 'unknown')}-${part(env.GITHUB_RUN_ATTEMPT || '1')}-${part(env.CI_TEST_OS || env.RUNNER_OS || process.platform)}-${part(env.CI_TEST_SHARD || 'all')}`;
}

const statuses = ['passed', 'failed', 'pending', 'skipped', 'todo', 'disabled'];
const blankCounts = () => Object.fromEntries(statuses.map((status) => [status, 0]));

/** JSON レポートの最小構造と、個々のテストの状態を確かめる。 */
export function parseTestReport(raw) {
  const unusable = (reportState) => ({ reportState, counts: blankCounts(), tests: [] });
  if (raw === undefined) return unusable('missing');
  let report;
  try { report = JSON.parse(raw); } catch { return unusable('invalid'); }
  if (!report || !Array.isArray(report.testResults)) return unusable('invalid');
  const counts = blankCounts();
  const tests = [];
  for (const suite of report.testResults) {
    if (!suite || typeof suite.name !== 'string' || !Array.isArray(suite.assertionResults)) return unusable('invalid');
    for (const test of suite.assertionResults) {
      if (!test || typeof test.fullName !== 'string' || !statuses.includes(test.status)) return unusable('invalid');
      if (test.duration != null && (typeof test.duration !== 'number' || !Number.isFinite(test.duration) || test.duration < 0)) return unusable('invalid');
      counts[test.status]++;
      tests.push({ file: suite.name, fullName: test.fullName, status: test.status, duration: test.duration ?? null });
    }
  }
  return { reportState: tests.length ? 'valid' : 'empty', counts, tests };
}

// 改行と Markdown / HTML の構文文字を文字として表示する。切り詰めはエスケープ前に行う。
export function escapeSummaryText(value) {
  const chars = [...String(value).replace(/[\r\n\t]/g, ' ')];
  return (chars.slice(0, 200).join('') + (chars.length > 200 ? '…（文字を省略）' : ''))
    .replace(/[&<>\\`*_{}[\]()#+.!|~=:"'-]/g, (char) => `&#${char.codePointAt(0)};`);
}

/** 状態の集計は全件、表示は失敗20件・所要時間上位10件・全体32KiB以内にする。 */
export function renderSummary(metadata, parsed) {
  const states = { valid: '有効', missing: '欠損', invalid: '不正', empty: '空（テスト結果なし）' };
  const outcomes = { success: '成功', failure: '失敗', not_run: '未実行' };
  const text = escapeSummaryText;
  let summary = `## CI のテスト診断\n\nテストステップ：${outcomes[metadata.testOutcome]}\n\nレポート：${states[parsed.reportState]}\n\n`;
  summary += `run：${text(metadata.runUrl)} / 試行：${text(metadata.runAttempt)}\n\ncheckout SHA：${text(metadata.checkoutSha)}\n\nOS：${text(metadata.os)} / Node：${text(metadata.node)} / シャード：${text(metadata.shard)}\n\n`;
  if (parsed.reportState !== 'valid') summary += 'レポートからテストの成功は確認できません。\n\n';
  summary += `状態別件数：成功 ${parsed.counts.passed} / 失敗 ${parsed.counts.failed} / pending ${parsed.counts.pending} / skip ${parsed.counts.skipped} / todo ${parsed.counts.todo} / disabled ${parsed.counts.disabled}\n\n`;
  const list = (title, items, limit, timed) => {
    summary += `### ${title}\n\n`;
    let shown = 0;
    for (const test of items.slice(0, limit)) {
      const row = `- ${text(test.file)} — ${text(test.fullName)}${timed ? `：${test.duration} ms` : ''}\n`;
      if (Buffer.byteLength(summary + row, 'utf8') > 30 * 1024) break;
      summary += row;
      shown++;
    }
    if (!items.length) summary += '該当なし。\n';
    if (shown < items.length) summary += `ほか ${items.length - shown} 件を省略しました。\n`;
    summary += '\n';
  };
  list('失敗したテスト（最大20件）', parsed.tests.filter((test) => test.status === 'failed'), 20, false);
  list('所要時間の上位（最大10件）', parsed.tests.filter((test) => test.duration !== null).sort((a, b) => b.duration - a.duration), 10, true);
  summary += '時間のないテストは所要時間の一覧に含めません。失敗メッセージの全文は保存した test-report.json を参照してください。\n';
  return summary;
}

/** @param {{cwd?: string, env?: Record<string, string | undefined>, reportPath?: string, outputDir?: string}} options */
export function createDiagnostics({ cwd = process.cwd(), env = process.env, reportPath = join(cwd, '.loomake/test-report.json'), outputDir = join(env.RUNNER_TEMP || cwd, 'loomake-ci-test-diagnostics') } = {}) {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (git.status !== 0) throw new Error('checkout した SHA を取得できませんでした');
  const metadata = {
    schemaVersion: 1,
    runUrl: `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY || ''}/actions/runs/${env.GITHUB_RUN_ID || ''}`,
    runId: env.GITHUB_RUN_ID || '',
    runAttempt: env.GITHUB_RUN_ATTEMPT || '1',
    checkoutSha: git.stdout.trim(),
    os: env.CI_TEST_OS || env.RUNNER_OS || process.platform,
    node: process.version,
    shard: env.CI_TEST_SHARD || 'all',
    testOutcome: ['success', 'failure'].includes(env.CI_TEST_OUTCOME) ? env.CI_TEST_OUTCOME : 'not_run',
  };
  const parsed = parseTestReport(existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : undefined);
  Object.assign(metadata, { reportState: parsed.reportState, counts: parsed.counts });
  const summary = renderSummary(metadata, parsed);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  writeFileSync(join(outputDir, 'summary.md'), summary);
  if (existsSync(reportPath)) copyFileSync(reportPath, join(outputDir, 'test-report.json'));
  else rmSync(join(outputDir, 'test-report.json'), { force: true });
  return { metadata, directory: outputDir, artifactName: artifactName(env), summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = createDiagnostics();
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary);
    const output = `artifact-name=${result.artifactName}\ndirectory=${result.directory}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    else process.stdout.write(output);
  } catch (error) {
    console.error(`CI の診断情報を生成できませんでした：${error.message}`);
    process.exitCode = 1;
  }
}
