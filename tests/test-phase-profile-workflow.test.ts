import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = join(import.meta.dirname, '..');
const readLf = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const workflow = readLf('.github/workflows/profile-slow-tests.yml');
const steps = workflow.slice(workflow.indexOf('\n    steps:\n') + '\n    steps:\n'.length)
  .split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
function stepById(id: string): string {
  const step = steps.find((value) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(value));
  expect(step, id).toBeDefined();
  return step!;
}
function evaluate(expression: string, context: Record<string, unknown>): unknown {
  return runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 });
}
const prepared = (checkout = 'success', node = 'success') => ({
  checkout: { outcome: checkout }, node: { outcome: node }, test: { outcome: 'failure' }, collect: { outcome: 'failure' },
});

describe('Windowsの区間計測workflow', () => {
  it('[REQ-294] 関連PRと手動起動でWindows・Node24の3サンプルを同じ4ケースへ固定する', () => {
    const triggers = workflow.slice(workflow.indexOf('\non:\n'), workflow.indexOf('\npermissions:'));
    expect(triggers).toContain('  pull_request:\n    paths:');
    expect(triggers).toContain('  workflow_dispatch:');
    for (const path of ['.github/workflows/profile-slow-tests.yml', 'scripts/test-phase-profile.mjs', 'scripts/ai-journeys.mjs',
      'tests/test-phase-profile*.test.ts', 'tests/ai-journeys.test.ts', 'tests/package-build.setup.ts',
      'packages/runner/test/external-budget.test.ts', 'docs/dev/test-phase-profiling.md']) expect(triggers).toContain(`'${path}'`);
    expect(workflow).toContain('fail-fast: false');
    expect(workflow.match(/^ {8}sample: (.*)$/m)?.[1]).toBe('[1, 2, 3]');
    expect(workflow).toContain('runs-on: windows-latest');
    expect(stepById('node')).toContain('node-version: 24');
    expect(workflow).toContain('LOOMAKE_TEST_PHASE_PROFILE_DIR: ${{ runner.temp }}/loomake-test-phases');
    expect(workflow).toContain('LOOMAKE_TEST_PHASE_SAMPLE: ${{ matrix.sample }}');
    expect(stepById('test').match(/^ {8}run: (.*)$/m)?.[1]).toBe("node node_modules/vitest/vitest.mjs run tests/ai-journeys.test.ts packages/runner/test/external-budget.test.ts -t '導入・通常操作・失敗と復旧|(?:create|push)の期限後'");
    expect(workflow).not.toMatch(/continue-on-error|--retry|--repeat|--shard|--testTimeout/);
  });

  it('[REQ-294] runnerの保存先を参照できるtestとcollectのstep環境へ計測設定を渡す', () => {
    const jobConfiguration = workflow.slice(workflow.indexOf('\n  profile:'), workflow.indexOf('\n    steps:'));
    expect(jobConfiguration).not.toContain('runner.temp');
    expect(jobConfiguration).not.toMatch(/^ {4}env:/m);
    for (const step of [stepById('test'), stepById('collect')]) {
      expect(step).toContain('        env:\n');
      expect(step).toContain('          LOOMAKE_TEST_PHASE_PROFILE_DIR: ${{ runner.temp }}/loomake-test-phases');
      expect(step).toContain('          LOOMAKE_TEST_PHASE_SAMPLE: ${{ matrix.sample }}');
    }
  });

  it('[REQ-294] テストと集計の失敗後も保存し、準備失敗とキャンセルを除外する', () => {
    for (const step of [stepById('collect'), stepById('upload')]) {
      const condition = step.match(/^ {8}if: (.*)$/m)![1];
      expect(condition).toContain('!cancelled()');
      expect(evaluate(condition, { steps: prepared(), cancelled: () => false, success: () => false })).toBe(true);
      for (const args of [['failure', 'success'], ['success', 'failure'], ['skipped', 'success'], ['success', 'skipped']]) {
        expect(evaluate(condition, { steps: prepared(args[0], args[1]), cancelled: () => false })).toBe(false);
      }
      expect(evaluate(condition, { steps: prepared(), cancelled: () => true })).toBe(false);
    }
    const collect = stepById('collect');
    expect(collect).toContain('run: node scripts/test-phase-profile.mjs');
    expect(collect).toContain('TEST_PHASE_OUTCOME: ${{ steps.test.outcome }}');
    expect(steps.indexOf(collect)).toBeGreaterThan(steps.indexOf(stepById('test')));
    expect(steps.indexOf(stepById('upload'))).toBeGreaterThan(steps.indexOf(collect));
    expect(stepById('upload')).not.toContain('steps.collect.outputs');
  });

  it('[REQ-294] 読み取り権限と固定SHAを使い、計測JSONと要約だけを7日保存する', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    const pins = JSON.parse(readFileSync(join(root, '.github/action-pins.json'), 'utf8')).actions as { repository: string; sha: string }[];
    const actions = [...workflow.matchAll(/^ {6}- uses: (\S+)@([a-f0-9]{40})/gm)];
    expect(actions.map((match) => match[1])).toEqual(['actions/checkout', 'pnpm/action-setup', 'actions/setup-node', 'actions/upload-artifact']);
    for (const action of actions) expect(pins).toContainEqual(expect.objectContaining({ repository: action[1], sha: action[2] }));
    expect(stepById('checkout')).toContain('persist-credentials: false');
    const upload = stepById('upload');
    expect(upload).toContain('retention-days: 7');
    expect(upload).toContain('if-no-files-found: warn');
    expect([...upload.matchAll(/^ {12}(\$\{\{ runner.temp \}\}.*)$/gm)].map((match) => match[1]))
      .toEqual(['profile.json', 'summary.md'].map((file) => '${{ runner.temp }}/loomake-test-phases/' + file));
    const template = upload.match(/^ {10}name: (.*)$/m)![1];
    const names = [];
    for (const run of [100, 101]) for (const attempt of [1, 2]) for (const sample of [1, 2, 3]) {
      const value = template.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(evaluate(expression, { github: { run_id: run, run_attempt: attempt }, matrix: { sample } })));
      expect(value).toBe(`ci-phases-${run}-${attempt}-${sample}`);
      names.push(value);
    }
    expect(new Set(names).size).toBe(12);
  });

  it('[REQ-294] 既存qualityへ計測を混ぜず、診断artifactの3ファイル契約を保つ', () => {
    const ci = readLf('.github/workflows/ci.yml');
    expect(ci).not.toMatch(/LOOMAKE_TEST_PHASE|test-phase-profile|ci-phases-/);
    const upload = ci.split(/\n(?= {6}- )/).find((step) => step.includes('id: diagnostics_upload'));
    expect(upload).toBeDefined();
    expect(upload).toContain('retention-days: 7');
    expect([...upload!.matchAll(/^ {12}(\$\{\{ runner.temp \}\}.*)$/gm)].map((match) => match[1]))
      .toEqual(['metadata.json', 'summary.md', 'test-report.json'].map((file) => '${{ runner.temp }}/loomake-ci-test-diagnostics/' + file));
  });
});
