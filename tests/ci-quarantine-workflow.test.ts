import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = join(import.meta.dirname, '..');
// Windows のチェックアウトでは行末が CRLF になるので、LF にそろえて読む
const readLf = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const ci = readLf('.github/workflows/ci.yml');
const qualityStart = ci.indexOf('\n  quality:');
const qualityEnd = ci.indexOf('\n  node22:');
if (qualityStart < 0 || qualityEnd <= qualityStart) throw new Error('quality と node22 のジョブ境界がありません');
const quality = ci.slice(qualityStart, qualityEnd).replace(/^ *#.*\n/gm, '');
const qualitySteps = quality.slice(quality.indexOf('\n    steps:\n')).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
const stepOf = (steps: string[], id: string) => {
  const found = steps.find((step) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(step));
  expect(found, id).toBeDefined();
  return found!;
};
const conditionOf = (step: string) => step.match(/^ {6}(?:- | {2})if: (.*)$/m)?.[1] ?? '';
const evaluate = (expression: string, context: Record<string, unknown>) =>
  runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), { contains: (list: string[], value: string) => list.includes(value), ...context }, { timeout: 1000 });

const quarantine = readLf('.github/workflows/quality-quarantine.yml');
const jobOf = (name: string) => {
  const start = quarantine.indexOf(`\n  ${name}:\n`);
  expect(start, name).toBeGreaterThan(0);
  const rest = quarantine.slice(start + 1);
  const end = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return end < 0 ? rest : rest.slice(0, end + 1);
};
const stepsOf = (job: string) => job.slice(job.indexOf('\n    steps:\n')).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));

describe('隔離一覧の CI への組み込み', () => {
  it('[REQ-214][REQ-344] macOS と Windows のシャードだけで一覧を検査し、除くファイルをシャードのテストに渡す。ubuntu には渡さない', () => {
    const check = stepOf(qualitySteps, 'quarantine');
    const test = stepOf(qualitySteps, 'test_shard');
    const all = stepOf(qualitySteps, 'test_all');
    expect(check).toContain('run: node scripts/ci-quarantine.mjs --os "$CI_TEST_OS"');
    expect(check).toContain('CI_TEST_OS: ${{ matrix.os }}');
    expect(qualitySteps.indexOf(check)).toBeLessThan(qualitySteps.indexOf(test));
    const docs = (value: string) => ({ changes: { outputs: { docs_only: value } } });
    for (const [shard, docsOnly, expected] of [['1/2', 'false', true], ['2/2', '', true], ['', 'false', false], ['1/2', 'true', false]] as const)
      expect(Boolean(evaluate(conditionOf(check), { matrix: { shard }, steps: docs(docsOnly) })), `${shard} ${docsOnly}`).toBe(expected);
    expect(conditionOf(check)).toBe(conditionOf(test));
    expect(test).toContain('LOOMAKE_TEST_QUARANTINE_EXCLUDE: ${{ steps.quarantine.outputs.exclude }}');
    expect(all).not.toContain('QUARANTINE');
    expect(ci.match(/LOOMAKE_TEST_QUARANTINE_EXCLUDE/g)).toHaveLength(1);
    // シャードのテストの行そのものは変えない（ほかに引数を足さない）
    expect(test).toMatch(/^ {8}run: pnpm test --shard=\$\{\{ matrix\.shard \}\}$/m);
    // vitest.config.ts が環境変数を受け取り、両方のプロジェクトの exclude に足す
    const config = readLf('vitest.config.ts');
    expect(config).toContain('process.env.LOOMAKE_TEST_QUARANTINE_EXCLUDE');
    expect(config.match(/\.\.\.quarantined\]/g)).toHaveLength(2);
  });

  it('[REQ-344] quality-quarantine は push・定期実行・手動実行と ci:all-os の PR で動き、試験のジョブは成否に数えない', () => {
    const on = quarantine.slice(quarantine.indexOf('\non:\n'), quarantine.indexOf('\npermissions:'));
    expect(on).toMatch(/^ {2}pull_request:\n {4}types: \[opened, synchronize, reopened, labeled\]\n/m);
    expect(on).toMatch(/^ {2}push:\n {4}branches: \[main\]\n/m);
    expect(on).toContain("    - cron: '0 18 * * *'");
    expect(ci).toContain("    - cron: '0 18 * * *'");
    expect(on).toMatch(/^ {2}workflow_dispatch:\n/m);
    expect(quarantine).toMatch(/^permissions:\n {2}contents: read\n/m);

    const plan = jobOf('plan');
    const planIf = plan.match(/^ {4}if: (.*)$/m)![1]!;
    const ctx = (event: string, labels: string[] = []) => ({ github: { event_name: event, event: { pull_request: { labels: labels.map((name) => ({ name })) } } } });
    const labelsOf = (context: ReturnType<typeof ctx>) => context.github.event.pull_request.labels.map((label) => label.name);
    const run = (event: string, labels: string[] = []) => {
      const context = ctx(event, labels);
      // labels.*.name の参照を、名前の配列に置き換えて評価する
      return Boolean(evaluate(planIf.replace('github.event.pull_request.labels.*.name', 'names'), { ...context, names: labelsOf(context) }));
    };
    expect(run('push')).toBe(true);
    expect(run('schedule')).toBe(true);
    expect(run('workflow_dispatch')).toBe(true);
    expect(run('pull_request')).toBe(false);
    expect(run('pull_request', ['documentation'])).toBe(false);
    expect(run('pull_request', ['ci:all-os'])).toBe(true);
    expect(plan).toContain('run: node scripts/ci-quarantine.mjs --matrix --samples "$SAMPLES"');
    expect(plan).not.toContain('continue-on-error');

    const job = jobOf('quality-quarantine');
    expect(job).toMatch(/^ {4}needs: plan$/m);
    expect(job).toMatch(/^ {4}if: needs\.plan\.outputs\.has_entries == 'true'$/m);
    expect(job).toMatch(/^ {4}continue-on-error: true$/m);
    expect(job).toContain('matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}');
    expect(job).toContain('runs-on: ${{ matrix.os }}');
    expect(job).not.toMatch(/--shard|--retry|--testTimeout|--bail/);
  });

  it('[REQ-344] 隔離のジョブは一覧のファイルだけを、段階の記録を有効にして流し、並列度と TEMP は手動実行のときだけ変える', () => {
    const steps = stepsOf(jobOf('quality-quarantine'));
    const test = stepOf(steps, 'test');
    expect(test).toContain('run: pnpm test $QUARANTINE_FILES $WORKERS');
    expect(test).toContain('QUARANTINE_FILES: ${{ matrix.files }}');
    expect(test).toContain('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR: ${{ runner.temp }}/loomake-quarantine/processes');
    expect(test).toContain('LOOMAKE_TEST_PHASE_PROFILE_DIR: ${{ runner.temp }}/loomake-quarantine/phases');
    const workers = test.match(/^ {10}WORKERS: (.*)$/m)![1]!;
    expect(evaluate(workers, { inputs: {} })).toBe('');
    expect(evaluate(workers, { inputs: { max_workers: 'default' } })).toBe('');
    expect(evaluate(workers, { inputs: { max_workers: '1' } })).toBe('--maxWorkers=1');
    const temp = steps.find((step) => step.includes('TEMP=$RUNNER_TEMP'))!;
    expect(temp).toBeDefined();
    const tempIf = conditionOf(temp);
    expect(Boolean(evaluate(tempIf, { runner: { os: 'Windows' }, inputs: { temp: 'runner-temp' } }))).toBe(true);
    expect(Boolean(evaluate(tempIf, { runner: { os: 'Windows' }, inputs: {} }))).toBe(false);
    expect(Boolean(evaluate(tempIf, { runner: { os: 'macOS' }, inputs: { temp: 'runner-temp' } }))).toBe(false);
    expect(steps.indexOf(temp)).toBeLessThan(steps.indexOf(test));

    const upload = stepOf(steps, 'upload');
    expect(upload).toContain('actions/upload-artifact@');
    expect(upload).toContain('retention-days: 7');
    expect(upload).toContain('${{ runner.temp }}/loomake-quarantine/');
    expect(conditionOf(upload)).toContain('!cancelled()');
    const name = upload.match(/^ {10}name: (.*)$/m)![1]!;
    const names = new Set<string>();
    for (const os of ['macos-latest', 'windows-latest']) for (const sample of [1, 2, 3])
      names.add(name.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(evaluate(expression, { github: { run_id: 1, run_attempt: 1 }, matrix: { os, sample } }))));
    expect(names.size).toBe(6);
  });
});
