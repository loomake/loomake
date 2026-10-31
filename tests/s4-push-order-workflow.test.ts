import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
const workflow = read('.github/workflows/s4-push-order.yml');
const steps = workflow.slice(workflow.indexOf('\n    steps:\n') + '\n    steps:\n'.length).split(/\n(?= {6}- )/).filter((s) => /^ {6}- /.test(s));
const step = (id: string) => {
  const value = steps.find((s) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(s));
  expect(value, id).toBeDefined(); return value!;
};
const evaluate = (expression: string, context: Record<string, unknown>) => runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 });
const inline = (id: string) => step(id).split("node --input-type=module <<'NODE'\n")[1].split('\n          NODE')[0].split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');

describe('S4 の Windows 操作順序workflow', () => {
  it('Windowsの1 jobでPR headを選び、既存予算・通常CIを変えない', () => {
    expect(workflow).toContain('  pull_request:\n    paths:'); expect(workflow).toContain('  workflow_dispatch:');
    expect(workflow.match(/runs-on:/g)).toHaveLength(1); expect(workflow).toContain('runs-on: windows-latest');
    expect(workflow).not.toMatch(/matrix:|strategy:|continue-on-error|--retry|--repeat|--shard|--testTimeout|DIAGNOSTIC_DIR|TEST_PHASE|LOOMAKE_TEST_BUDGET_CLOCK/);
    expect(step('node')).toContain('node-version: 24');
    expect(step('checkout')).toContain('ref: ${{ github.event.pull_request.head.sha || github.sha }}');
    for (const file of ['.github/workflows/ci.yml', '.github/workflows/profile-slow-tests.yml']) expect(read(file)).not.toMatch(/s4-push-order|LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_FILE/);
    expect(step('test')).toContain("['node_modules/vitest/vitest.mjs', 'run', 'packages/runner/test/external-budget-deadline.test.ts', '-t', 'pushの期限後に先へ進まず']");
    expect(step('test')).toContain("LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_FILE: ${{ runner.temp }}/loomake-s4-order-raw/context.json");
  });
  it.each([0, 1, 2])('testの出力を専用rawファイルへ送り、終了コード%sをそのまま保つ', (status) => {
    const script = inline('test');
    expect(script).toContain("stdio: ['ignore', log, log]");
    expect(script).toContain('process.exitCode = result.status ?? 1;');
    // workflow の実wrapperを同じnodeで動かし、子だけを副作用のない検査fixtureへ置換する。
    {
      const dir = mkdtempSync(join(tmpdir(), 'loomake-order-wrapper-'));
      try {
        const prepare = inline('prepare');
        expect(spawnSync(process.execPath, ['--input-type=module', '-e', prepare], { cwd: dir, env: { ...process.env, RUNNER_TEMP: dir } }).status).toBe(0);
        const args = "['node_modules/vitest/vitest.mjs', 'run', 'packages/runner/test/external-budget-deadline.test.ts', '-t', 'pushの期限後に先へ進まず']";
        const fixture = JSON.stringify(['-e', `process.stdout.write('PRIVATE_STDOUT');process.stderr.write('PRIVATE_STDERR');process.exit(${status})`]);
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', script.replace(args, fixture)], { cwd: dir, env: { ...process.env, RUNNER_TEMP: dir }, encoding: 'utf8' });
        expect(result.status).toBe(status); expect(result.stdout + result.stderr).toBe('');
        const raw = join(dir, 'loomake-s4-order-raw'); expect(readFileSync(join(raw, 'test-output.log'), 'utf8')).toBe('PRIVATE_STDOUTPRIVATE_STDERR');
        expect(spawnSync(process.execPath, ['--input-type=module', '-e', inline('cleanup')], { cwd: dir, env: { ...process.env, RUNNER_TEMP: dir } }).status).toBe(0);
        expect(readdirSync(dir)).toEqual([]);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });
  it('元testの失敗後も集計し、検証済みmarkerだけがuploadを許す', () => {
    const collect = step('collect').match(/^ {8}if: (.*)$/m)![1];
    const upload = step('upload').match(/^ {8}if: (.*)$/m)![1];
    const context = (verified: string, checkout = 'success', node = 'success') => ({ cancelled: () => false, steps: { checkout: { outcome: checkout }, node: { outcome: node }, test: { outcome: 'failure' }, collect: { outcome: 'failure', outputs: { verified } } } });
    expect(evaluate(collect, context('true'))).toBe(true);
    expect(evaluate(upload, context('true'))).toBe(true);
    for (const verified of ['', 'false', 'TRUE']) expect(evaluate(upload, context(verified))).toBe(false);
    expect(evaluate(upload, { ...context('true'), cancelled: () => true })).toBe(false);
    for (const args of [['failure', 'success'], ['success', 'failure']]) expect(evaluate(collect, context('true', args[0], args[1]))).toBe(false);
    expect(step('collect')).toContain('S4_TEST_OUTCOME: ${{ steps.test.outcome }}');
    expect(evaluate(step('cleanup').match(/^ {8}if: (.*)$/m)![1], { always: () => true })).toBe(true);
    expect(steps.indexOf(step('collect'))).toBeGreaterThan(steps.indexOf(step('test')));
    expect(steps.indexOf(step('cleanup'))).toBeGreaterThan(steps.indexOf(step('upload')));
  });
  it('固定SHA・read権限でsummary2ファイルだけを7日保存する', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(step('checkout')).toContain('persist-credentials: false');
    const pins = JSON.parse(read('.github/action-pins.json')).actions as { repository: string; sha: string }[];
    const actions = [...workflow.matchAll(/^ {6}- uses: (\S+)@([a-f0-9]{40})/gm)];
    expect(actions.map((a) => a[1])).toEqual(['actions/checkout', 'pnpm/action-setup', 'actions/setup-node', 'actions/upload-artifact']);
    for (const action of actions) expect(pins).toContainEqual(expect.objectContaining({ repository: action[1], sha: action[2] }));
    expect([...step('upload').matchAll(/^ {12}(\$\{\{ runner.temp \}\}.*)$/gm)].map((m) => m[1])).toEqual(['summary.json', 'summary.md'].map((name) => '${{ runner.temp }}/loomake-s4-order/' + name));
    expect(step('upload')).toContain('retention-days: 7'); expect(step('upload')).toContain('if-no-files-found: error');
    expect(step('upload')).not.toMatch(/context|test-report|raw|\.\.\/|\*/);
  });
});
