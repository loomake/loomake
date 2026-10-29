import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const workflow = readFileSync(join(import.meta.dirname, '../.github/workflows/profile-slow-tests.yml'), 'utf8').replace(/\r\n/g, '\n');
const steps = workflow.split(/\n(?= {6}- )/);
const step = (id: string) => steps.find((value) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(value))!;

describe('期限試験の時計診断workflow', () => {
  it('[REQ-296] testとcollectだけに追加時計を指定し、同じ4ケースを3サンプルで実行する', () => {
    for (const id of ['test', 'collect']) {
      expect(step(id)).toContain("          LOOMAKE_TEST_BUDGET_CLOCK: '1'");
      expect(step(id)).toContain('          LOOMAKE_TEST_PHASE_PROFILE_DIR: ${{ runner.temp }}/loomake-test-phases');
    }
    expect(workflow.match(/LOOMAKE_TEST_BUDGET_CLOCK:/g)).toHaveLength(2);
    expect(step('test').match(/^ {8}run: (.*)$/m)?.[1]).toBe("node node_modules/vitest/vitest.mjs run tests/ai-journeys.test.ts packages/runner/test/external-budget.test.ts -t '導入・通常操作・失敗と復旧|(?:create|push)の期限後'");
    expect(workflow).toContain('sample: [1, 2, 3]');
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('runs-on: windows-latest');
    expect(step('node')).toContain('node-version: 24');
    expect(workflow).not.toMatch(/continue-on-error|--retry|--repeat|--testTimeout/);
  });

  it('[REQ-296] 元の失敗後も時計を集計し、計測2ファイルだけを7日保存する', () => {
    expect(step('collect')).toContain('TEST_PHASE_OUTCOME: ${{ steps.test.outcome }}');
    for (const id of ['collect', 'upload']) {
      const expression = step(id).match(/^ {8}if: \$\{\{ (.*) \}\}$/m)![1];
      const steps = { checkout: { outcome: 'success' }, node: { outcome: 'success' }, test: { outcome: 'failure' }, collect: { outcome: 'failure' } };
      expect(runInNewContext(expression, { steps, cancelled: () => false }, { timeout: 1000 })).toBe(true);
      expect(runInNewContext(expression, { steps, cancelled: () => true }, { timeout: 1000 })).toBe(false);
    }
    expect(step('upload')).toContain('retention-days: 7');
    expect([...step('upload').matchAll(/^ {12}(.+)$/gm)].map((match) => match[1])).toEqual([
      '${{ runner.temp }}/loomake-test-phases/profile.json',
      '${{ runner.temp }}/loomake-test-phases/summary.md',
    ]);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(step('checkout')).toContain('persist-credentials: false');
  });
});
