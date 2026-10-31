import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { copyFixture, linkRuntimeDependencies } from './package-smoke.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const agreement = 'core/src/agreement.ts';
const policy = 'kit/src/verify/policy/agreement.ts';
const coverage = 'kit/src/verify/policy/coverage-policy.ts';
export const DOMAIN_MUTATIONS = [
  { id: 'M01', file: agreement, label: '要件IDの桁数', before: String.raw`/^REQ-\d{3,}$/`, after: String.raw`/^REQ-\d{2,}$/` },
  { id: 'M02', file: agreement, label: '要件IDの終端', before: String.raw`/^REQ-\d{3,}$/`, after: String.raw`/^REQ-\d{3,}/` },
  { id: 'M03', file: agreement, label: '状態の検証', before: "!(LEDGER_STATES as readonly string[]).includes(row['状態'])", after: 'false' },
  { id: 'M04', file: agreement, label: 'ブロッキング値の大文字小文字', before: '/^yes$/i', after: '/^yes$/' },
  { id: 'M05', file: policy, label: 'ブロッキング条件', before: 'q.blocking && !q.answer', after: '!q.answer' },
  { id: 'M06', file: policy, label: '回答の有無', before: 'q.blocking && !q.answer', after: 'q.blocking && q.answer' },
  { id: 'M07', file: policy, label: '確認待ち', before: "r.state === '確認待ち'", after: "r.state !== '確認待ち'" },
  { id: 'M08', file: policy, label: '承認', before: '!a.approval', after: 'a.approval' },
  { id: 'M09', file: policy, label: '出典', before: '!r.source', after: 'r.source' },
  { id: 'M10', file: coverage, label: 'テスト不足', before: 'coverage[id].length === 0', after: 'coverage[id].length > 0' },
  { id: 'M11', file: coverage, label: 'ファイル順序', before: '[...(files.get(id) ?? [])].sort()', after: '[...(files.get(id) ?? [])]' },
  { id: 'M12', file: coverage, label: '対応ファイル', before: 'files.get(id)?.add(file)', after: 'files.get(id)?.add(id)' },
  { id: 'M13', file: coverage, label: '必要IDの重複', before: '[...new Set(needed)].sort()', after: '[...needed].sort()' },
];

export function mutateOnce(source, before, after) {
  assert.ok(before && source.split(before).length === 2, '変更する文字列は1か所に一致する必要があります');
  return source.replace(before, () => after);
}

function assertions(report) {
  if (!report || !Array.isArray(report.testResults)) return [];
  return report.testResults.flatMap((suite) => Array.isArray(suite.assertionResults) ? suite.assertionResults : []);
}

/** assertion以外の失敗を、条件を検出した根拠にはしない。 */
export function classifyMutation(exitCode, report, expectedNames) {
  const error = { status: 'error', failedTests: [] };
  const rows = assertions(report);
  const actual = rows.map((row) => row.fullName);
  if (!rows.length || !Array.isArray(expectedNames) || new Set(actual).size !== actual.length || actual.some((name) => typeof name !== 'string')) return error;
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expectedNames].sort())) return error;
  if ((Object.hasOwn(report, 'numRuntimeErrorTestSuites') && report.numRuntimeErrorTestSuites !== 0) || typeof report.success !== 'boolean' || rows.some((row) => !['passed', 'failed'].includes(row.status))) return error;
  const failed = rows.filter((row) => row.status === 'failed');
  if (report.numTotalTests !== rows.length || report.numFailedTests !== failed.length || report.numPassedTests !== rows.length - failed.length || report.numPendingTests !== 0 || report.numTodoTests !== 0) return error;
  if (exitCode === 0 && report.success && !failed.length) return { status: 'survived', failedTests: [] };
  if (exitCode !== 1 || report.success || !failed.length || failed.some((row) => !Array.isArray(row.failureMessages) || !row.failureMessages.length || row.failureMessages.some((message) => typeof message !== 'string' || !/^AssertionError:/m.test(message)))) return error;
  return { status: 'killed', failedTests: failed.map((row) => row.fullName) };
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    assert.ok(entry.isFile(), `通常のファイル以外は対象にできません：${file}`);
    return [file];
  }).sort();
}

function within(parent, child) {
  const part = relative(parent, child);
  return part !== '' && part !== '..' && !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(part);
}

function runTrial(target, mutation) {
  const started = performance.now();
  const trial = join(target, mutation?.id ?? 'baseline');
  mkdirSync(trial);
  for (const name of ['core', 'kit']) {
    mkdirSync(join(trial, name));
    copyFixture(join(root, 'packages', name, 'src'), join(trial, name, 'src'));
    mkdirSync(join(trial, name, 'test'));
    const tests = name === 'core' ? ['agreement.test.ts'] : ['agreement.test.ts', 'coverage-policy.test.ts'];
    for (const test of tests) writeFileSync(join(trial, name, 'test', test), readFileSync(join(root, 'packages', name, 'test', test)));
  }
  const changed = {};
  if (mutation) {
    const file = join(trial, mutation.file);
    const before = readFileSync(file, 'utf8');
    const after = mutateOnce(before, mutation.before, mutation.after);
    changed.beforeSha256 = sha256(before);
    changed.afterSha256 = sha256(after);
    writeFileSync(file, after);
    writeFileSync(join(trial, 'mutation.txt'), after);
  }
  writeFileSync(join(trial, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  // 複製したソースが core の実行時依存（zod）を読めるようにする
  linkRuntimeDependencies(join(root, 'packages/core'), trial);
  writeFileSync(join(trial, 'vitest.config.mjs'), `export default { resolve: { alias: { '@loomake/core': ${JSON.stringify(join(trial, 'core/src/index.ts'))} } }, test: { include: ['core/test/**/*.test.ts', 'kit/test/**/*.test.ts'], reporters: ['json'], outputFile: { json: './report.json' } } };\n`);
  const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', trial, '--config', join(trial, 'vitest.config.mjs')], {
    cwd: trial, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
  });
  writeFileSync(join(trial, 'stdout.txt'), result.stdout ?? '');
  writeFileSync(join(trial, 'stderr.txt'), result.stderr ?? '');
  let report;
  try { report = JSON.parse(readFileSync(join(trial, 'report.json'), 'utf8')); } catch { /* レポートがない試行はerrorに分類する。 */ }
  for (const entry of ['core', 'kit', 'node_modules', 'vitest.config.mjs', 'package.json']) rmSync(join(trial, entry), { recursive: true, force: true });
  return { report, exitCode: result.error ? null : result.status, signal: result.signal, durationMs: Math.round(performance.now() - started), ...changed };
}

/** .loomake/quality配下の新規保存先に、選んだ13条件の試験と結果を残す。 */
export function runMutations(destination, { only } = {}) {
  if (only !== undefined) {
    assert.ok(Array.isArray(only) && only.length > 0, '検査する条件は空でないIDの配列で指定してください');
    assert.equal(new Set(only).size, only.length, '検査する条件のIDは重複できません');
    assert.ok(Array.from(only).every((id) => DOMAIN_MUTATIONS.some((mutation) => mutation.id === id)), '登録されていない条件のIDがあります');
  }
  const selected = only === undefined ? DOMAIN_MUTATIONS : only.map((id) => DOMAIN_MUTATIONS.find((mutation) => mutation.id === id));
  const quality = join(root, '.loomake/quality');
  const target = resolve(destination);
  assert.ok(within(quality, target), '保存先はリポジトリの.loomake/quality配下にしてください');
  mkdirSync(quality, { recursive: true });
  assert.equal(realpathSync(quality), quality, '試験先の親にシンボリックリンクは使えません');
  const parent = realpathSync(dirname(target));
  assert.ok(parent === quality || within(quality, parent), '保存先が試験用ディレクトリの外へ出ています');
  mkdirSync(target);
  const files = [...sourceFiles(join(root, 'packages/core/src')), ...sourceFiles(join(root, 'packages/kit/src')), ...['core/test/agreement.test.ts', 'kit/test/agreement.test.ts', 'kit/test/coverage-policy.test.ts'].map((name) => join(root, 'packages', name))];
  const sources = files.map((file) => ({ path: relative(root, file).split('\\').join('/'), sha256: sha256(readFileSync(file)) }));
  const summary = { scope: 'selected-domain-conditions', environment: { node: process.version, platform: process.platform, arch: process.arch }, scriptSha256: sha256(readFileSync(fileURLToPath(import.meta.url))), sources, baseline: null, mutations: [], originalsUnchanged: false, ok: false };
  if (only !== undefined) summary.selected = [...only];
  try {
    const baseline = runTrial(target);
    const tests = assertions(baseline.report).map((row) => row.fullName);
    const verdict = classifyMutation(baseline.exitCode, baseline.report, tests);
    summary.baseline = { status: verdict.status === 'survived' ? 'passed' : 'error', tests, exitCode: baseline.exitCode, durationMs: baseline.durationMs };
    if (summary.baseline.status === 'passed') {
      for (const mutation of selected) {
        try {
          const trial = runTrial(target, mutation);
          const verdict = classifyMutation(trial.exitCode, trial.report, tests);
          const details = { exitCode: trial.exitCode, signal: trial.signal, durationMs: trial.durationMs, beforeSha256: trial.beforeSha256, afterSha256: trial.afterSha256 };
          summary.mutations.push({ ...mutation, ...details, ...verdict });
        } catch (error) {
          summary.mutations.push({ ...mutation, status: 'error', failedTests: [], reason: error.message });
        }
      }
    }
  } finally {
    summary.originalsUnchanged = sources.every((source) => {
      try { return sha256(readFileSync(join(root, source.path))) === source.sha256; }
      catch { return false; }
    });
    summary.ok = summary.originalsUnchanged && summary.baseline?.status === 'passed' && summary.mutations.length === selected.length && summary.mutations.every((mutation) => mutation.status === 'killed');
    writeFileSync(join(target, 'results.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv[2], '新規の試験先ディレクトリを指定してください');
    const summary = runMutations(process.argv[2]);
    console.log(`選んだ条件の検出：${summary.mutations.filter((row) => row.status === 'killed').length}/${DOMAIN_MUTATIONS.length}。結果：${join(resolve(process.argv[2]), 'results.json')}`);
    if (!summary.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`ドメイン判定の試験に失敗しました：${error.message}`);
    process.exitCode = 1;
  }
}
