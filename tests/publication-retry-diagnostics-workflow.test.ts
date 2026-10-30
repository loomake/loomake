import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = join(import.meta.dirname, '..');
const workflow = readFileSync(join(root, '.github/workflows/profile-publication-retry.yml'), 'utf8').replace(/\r\n/g, '\n');
const steps = workflow.split(/\n(?= {6}- )/).slice(1);
const step = (id: string) => steps.find((value) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(value))!;

describe('publication retryの独立Windowsサンプル', () => {
  it('対象PRと手動で元shard全体を独立3サンプル実行し成否を上書きしない', () => {
    expect(workflow).toMatch(/on:\n {2}pull_request:\n {4}paths:/);
    expect(workflow).toContain('  workflow_dispatch:');
    const expectedPaths = ['.github/workflows/profile-publication-retry.yml', 'packages/runner/test/publication-retry.test.ts',
      'packages/runner/test/process-diagnostics.ts', 'packages/runner/test/helpers.ts', 'packages/kit/supervisor/**',
      'packages/**/src/**', 'packages/kit/test/project.ts', 'vitest.config.ts',
      'tests/publication-retry-diagnostics*.test.ts', 'docs/dev/test-phase-profiling.md'];
    const paths = [...workflow.matchAll(/^ {6}- '([^']+)'$/gm)].map((match) => match[1]);
    expect(paths.sort()).toEqual([...expectedPaths].sort());
    const docs = readFileSync(join(root, 'docs/dev/test-phase-profiling.md'), 'utf8').replace(/\r\n/g, '\n');
    const documented = docs.match(/^自動起動の対象は次のパスです。\n\n((?:- `[^`]+`\n)+)/m)![1];
    expect([...documented.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]).sort()).toEqual([...expectedPaths].sort());
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('sample: [1, 2, 3]');
    expect(workflow).toContain('runs-on: windows-latest');
    expect(step('node')).toContain('node-version: 24.22.1');
    expect(workflow).toContain('version: 12.10.1');
    expect(workflow).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(step('test').match(/^ {8}run: (.*)$/m)?.[1]).toBe('pnpm test --shard=1/2');
    expect(step('test')).toContain('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR: ${{ runner.temp }}/publication-retry-diagnostics');
    expect(workflow).not.toMatch(/continue-on-error|--retry|--repeat|--testTimeout|--maxWorkers|--no-file-parallelism/);
  });

  it('保存条件はalways()に固定し、診断dirとsampleを混ぜず保存する', () => {
    const upload = step('upload');
    const condition = upload.match(/^ {8}if: (.*)$/m)?.[1];
    expect(condition).toBe('${{ always() }}');
    expect(upload.match(/^ {10}path: (.*)$/m)?.[1]).toBe('${{ runner.temp }}/publication-retry-diagnostics/');
    expect(upload).toContain('retention-days: 7');
    const template = upload.match(/^ {10}name: (.*)$/m)![1];
    const names = [];
    for (const run_id of [1, 2]) for (const run_attempt of [1, 2]) for (const sample of [1, 2, 3]) {
      names.push(template.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(runInNewContext(expression, { github: { run_id, run_attempt }, matrix: { sample } }, { timeout: 1000 }))));
    }
    expect(new Set(names).size).toBe(12);
    expect(workflow).toContain('permissions:\n  contents: read');
    const pins = JSON.parse(readFileSync(join(root, '.github/action-pins.json'), 'utf8')).actions;
    for (const match of workflow.matchAll(/^ {6}- uses: (\S+)@([a-f0-9]{40})/gm)) expect(pins).toContainEqual(expect.objectContaining({ repository: match[1], sha: match[2] }));
    expect(step('checkout')).toContain('persist-credentials: false');
    expect(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).not.toContain('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR');
  });
});
