import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyMutation, mutateOnce } from '../scripts/domain-mutations.mjs';

it('[REQ-341] 失敗優先・guard理由順・subtype境界の変異を同じ直接試験のassertionで検出する', () => {
  const root = join(import.meta.dirname, '..');
  const parent = join(root, '.loomake/quality');
  mkdirSync(parent, { recursive: true });
  const target = mkdtempSync(join(parent, 'run-results-'));
  const sourcePath = 'packages/runner/src/run/decision-policy.ts';
  const testPath = 'packages/runner/test/result-policy.test.ts';
  const source = readFileSync(join(root, sourcePath), 'utf8');
  const tests = readFileSync(join(root, testPath), 'utf8');
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  const mutations = [
    { id: 'failure-priority', before: 'if (failed)', after: 'if (failed && !malformed)' },
    { id: 'guard-reason-order', before: '[value.resultReason, value.violationReason]', after: '[value.violationReason, value.resultReason]' },
    { id: 'subtype-boundary', before: '{1,64}', after: '{1,65}' },
  ];
  const trials = [{ id: 'baseline', text: source }, ...mutations.map((mutation) => ({ id: mutation.id, text: mutateOnce(source, mutation.before, mutation.after) }))];
  let names: string[] = [];
  const results = [];
  for (const trial of trials) {
    const dir = join(target, trial.id);
    mkdirSync(join(dir, 'src/run'), { recursive: true });
    mkdirSync(join(dir, 'test'));
    writeFileSync(join(dir, 'src/run/decision-policy.ts'), trial.text);
    writeFileSync(join(dir, 'test/result-policy.test.ts'), tests);
    writeFileSync(join(dir, 'package.json'), '{"private":true,"type":"module"}');
    writeFileSync(join(dir, 'vitest.config.mjs'), "export default { test: { include: ['test/result-policy.test.ts'], reporters: ['json'], outputFile: { json: './report.json' } } };\n");
    const ran = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', dir, '--config', join(dir, 'vitest.config.mjs')], { cwd: dir, encoding: 'utf8', timeout: 50000, maxBuffer: 4 * 1024 * 1024 });
    writeFileSync(join(dir, 'stdout.txt'), ran.stdout ?? '');
    writeFileSync(join(dir, 'stderr.txt'), ran.stderr ?? '');
    let report;
    try { report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')); } catch { /* Missing reports remain errors. */ }
    if (trial.id === 'baseline' && report) names = report.testResults.flatMap((suite: { assertionResults: { fullName: string }[] }) => suite.assertionResults.map((row) => row.fullName));
    results.push({ id: trial.id, ...classifyMutation(ran.error ? null : ran.status, report, names), sourceSha256: sha(trial.text), exitCode: ran.status });
  }
  const originalsUnchanged = readFileSync(join(root, sourcePath), 'utf8') === source && readFileSync(join(root, testPath), 'utf8') === tests;
  writeFileSync(join(target, 'results.json'), JSON.stringify({ scope: 'selected-run-result-decisions', environment: { node: process.version, platform: process.platform, arch: process.arch }, source: { path: sourcePath, sha256: sha(source) }, tests: { path: testPath, sha256: sha(tests), names }, mutations, results, originalsUnchanged }, null, 2) + '\n');
  expect(results[0].status).toBe('survived');
  expect(names).toHaveLength(53);
  expect(results.slice(1).map((result) => result.status)).toEqual(['killed', 'killed', 'killed']);
  expect(results.slice(1).every((result) => result.failedTests.length > 0)).toBe(true);
  expect(originalsUnchanged).toBe(true);
}, 220000);
