import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [targetArg, outputArg] = process.argv.slice(2);
assert.ok(targetArg && outputArg, '準備した配布物と、新しい結果の保存先を指定してください');
const consumer = join(resolve(targetArg), 'consumer');
const output = resolve(outputArg);
const require = createRequire(join(consumer, 'package.json'));
const kit = join(consumer, 'node_modules/@loomake/kit');
const manifest = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8'));
assert.ok(!JSON.stringify(manifest.exports).includes('@loomake/source'));
assert.equal(realpathSync(require.resolve('@loomake/kit')), realpathSync(join(kit, 'dist/index.js')));
assert.equal(manifest.dependencies.vitest, undefined);
const vitestManifest = require.resolve('vitest/package.json');
assert.equal(JSON.parse(readFileSync(vitestManifest, 'utf8')).version, '5.0.5');
const vitestBin = join(dirname(vitestManifest), 'vitest.mjs');
mkdirSync(output);
const results = [];
for (const mode of ['identity', 'standard', 'custom', 'unconfigured']) {
  const project = mkdtempSync(join(consumer, `.body-${mode}-`));
  const raw = join(output, mode);
  mkdirSync(raw);
  try {
    const files = {
      'body-cases.test.mjs': readFileSync(join(root, 'tests/fixtures/vitest-body-cases.mjs.txt'), 'utf8'),
      'body.mjs': `import { chai } from 'vitest';
  import { createBodyRecorder as real } from '@loomake/kit';
  export const createBodyRecorder = ${JSON.stringify(mode)} === 'identity' ? () => (_ctx, fn) => fn() : real;
  export const body = createBodyRecorder(chai);
  `,
      'runner.mjs': `import { TestRunner } from 'vitest';
  import { createBodyRunner } from '@loomake/kit';
  class ExistingRunner extends TestRunner {
    extendTaskContext(context) { super.extendTaskContext(context); context.task.meta.consumerContext = true; return context; }
    async runTask(task) {
      task.meta.consumerCalls = (task.meta.consumerCalls ?? 0) + 1;
      return await TestRunner.getTestFn(task)();
    }
  }
  export default createBodyRunner(${mode === 'custom' ? 'ExistingRunner' : 'TestRunner'});
  `,
      'vitest.config.mjs': `export default { test: { include: ['body-cases.test.mjs'], ${['standard', 'custom'].includes(mode) ? "runner: './runner.mjs'," : ''} reporters: ['json'], outputFile: 'report.json' } };\n`,
    };
    for (const [name, text] of Object.entries(files)) { writeFileSync(join(project, name), text); writeFileSync(join(raw, name), text); }
    const args = [vitestBin, 'run', '--config', 'vitest.config.mjs'];
    const run = spawnSync(process.execPath, args, { cwd: project, encoding: 'utf8', timeout: 45_000 });
    writeFileSync(join(raw, 'stdout.txt'), run.stdout ?? ''); writeFileSync(join(raw, 'stderr.txt'), run.stderr ?? '');
    writeFileSync(join(raw, 'outcome.json'), JSON.stringify({ command: [process.execPath, ...args], cwd: project, status: run.status, signal: run.signal, error: run.error?.message ?? null, node: process.version }, null, 2));
    assert.equal(run.error, undefined, run.stderr); assert.equal(run.signal, null, run.stderr);
    // The unchanged fixture intentionally contains six failures.
    assert.equal(run.status, 1, run.stdout + run.stderr);
    const report = readFileSync(join(project, 'report.json'), 'utf8');
    writeFileSync(join(raw, 'report.json'), report);
    const cases = JSON.parse(report).testResults.flatMap(file => file.assertionResults);
    assert.equal(cases.length, 52);
    assert.deepEqual(['passed', 'failed', 'skipped', 'todo'].map(status => cases.filter(test => test.status === status).length), [44, 6, 1, 1], mode);
    if (mode === 'standard' || mode === 'custom') {
      const byId = id => cases.find(test => test.fullName.includes(`[${id}]`));
      assert.deepEqual(byId('P07').meta.loomakeBody.attempts, [{ repeat: 0, retry: 0, expectedFailure: null, state: 'pass', calls: {} }]);
      assert.deepEqual(byId('P08').meta.loomakeBody.attempts, [{ repeat: 0, retry: 0, expectedFailure: null, state: 'pass', calls: { toBe: 1 } }]);
      assert.deepEqual(byId('P23').meta.loomakeBody.attempts.map(attempt => [attempt.repeat, attempt.retry, attempt.state, attempt.calls]), [[0, 0, 'fail', { toBe: 1 }], [0, 1, 'pass', {}]]);
      assert.deepEqual(byId('P30').meta.loomakeBody.attempts[0].calls, { toBe: 2 });
      assert.deepEqual(byId('P31').meta.loomakeBody.attempts[0].calls, { toBe: 1 });
      assert.equal(Object.hasOwn(byId('P32').meta, 'loomakeBody'), false);
      if (mode === 'custom') for (const test of cases.filter(test => !['skipped', 'todo'].includes(test.status))) {
        assert.equal(test.meta.consumerContext, true);
        const id = test.fullName.match(/\[P(\d+)\]/)?.[1];
        const expected = { 23: 2, 24: 2, 25: 3, 26: 4 }[Number(id)] ?? 1;
        assert.equal(test.meta.consumerCalls, expected, test.fullName);
      }
    } else for (const test of cases) assert.equal(Object.hasOwn(test.meta, 'loomakeBody'), false, test.fullName);
    results.push({ mode, status: run.status, cases });
  } finally { rmSync(project, { recursive: true, force: true }); }
}
const statuses = result => result.cases.map(test => [test.fullName, test.status]);
for (const result of results.slice(1)) assert.deepEqual(statuses(result), statuses(results[0]));
writeFileSync(join(output, 'results.json'), JSON.stringify({ requirement: 'REQ-393', ok: true, node: process.version, vitest: '5.0.5', sourceAliases: false, kitEntry: require.resolve('@loomake/kit'), results }, null, 2) + '\n');
console.log('配布物のVitest利用側で設定移行と元の実行結果を確認しました');
