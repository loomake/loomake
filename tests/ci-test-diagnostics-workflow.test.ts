import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = join(import.meta.dirname, '..');
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').replace(/\r\n/g, '\n');
const quality = workflow.slice(workflow.indexOf('\n  quality:'), workflow.indexOf('\n  node20:'));
const steps = quality.slice(quality.indexOf('\n    steps:\n') + '\n    steps:\n'.length).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
const stepById = (id: string) => {
  const found = steps.find((step) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(step));
  expect(found, id).toBeDefined();
  return found!;
};
const conditionOf = (step: string) => step.match(/^ {6}(?:- | {2})if: (.*)$/m)?.[1] ?? '';
function evaluate(condition: string, context: Record<string, unknown>): unknown {
  return runInNewContext(condition.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 });
}
const ready = (docs = 'false', checkout = 'success', node = 'success') => ({
  checkout: { outcome: checkout }, node: { outcome: node }, changes: { outputs: { docs_only: docs } },
  diagnostics: { outcome: 'failure' }, test_shard: { outcome: 'failure' }, test_all: { outcome: 'skipped' },
});

describe('quality の診断保存', () => {
  it('[REQ-289][REQ-291] テスト失敗後と診断生成失敗後も保存し、未準備・文書だけ・キャンセルを除く', () => {
    const generate = stepById('diagnostics');
    const upload = stepById('diagnostics_upload');
    for (const step of [generate, upload]) {
      const condition = conditionOf(step);
      expect(condition).toContain('!cancelled()');
      // テスト・lint・型検査の失敗で success() が false でも実行する。
      expect(evaluate(condition, { steps: ready(), cancelled: () => false, success: () => false })).toBe(true);
      expect(evaluate(condition, { steps: ready(''), cancelled: () => false })).toBe(true);
      for (const context of [
        { steps: ready('true'), cancelled: () => false },
        { steps: ready('false', 'failure'), cancelled: () => false },
        { steps: ready('false', 'success', 'failure'), cancelled: () => false },
        { steps: ready(), cancelled: () => true },
      ]) expect(evaluate(condition, context)).toBe(false);
    }
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(generate));
    expect(quality).not.toContain('continue-on-error');
    expect(quality).not.toMatch(/retry|rerun|--retry/);
    expect(quality.match(/run: pnpm test\b.*/g)).toEqual(['run: pnpm test --shard=${{ matrix.shard }}', 'run: pnpm test --coverage']);
    expect(workflow.slice(workflow.indexOf('\n  node20:'))).not.toContain('ci-test-diagnostics');
  });

  it('[REQ-289][REQ-291] 固定SHAで3ファイルだけを7日保存し、生成ステップの出力がなくてもuploadできる', () => {
    const upload = stepById('diagnostics_upload');
    expect(upload).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02');
    expect(upload).toContain('retention-days: 7');
    expect(upload).toContain('if-no-files-found: warn');
    const paths = [...upload.matchAll(/^ {12}(\$\{\{ runner.temp \}\}.*)$/gm)].map((match) => match[1]);
    expect(paths).toEqual(['metadata.json', 'summary.md', 'test-report.json'].map((name) => '${{ runner.temp }}/loomake-ci-test-diagnostics/' + name));
    expect(upload).not.toContain('steps.diagnostics.outputs');
    const name = upload.match(/^ {10}name: (.*)$/m)![1];
    const names: string[] = [];
    for (const attempt of [1, 2]) for (const os of ['ubuntu-latest', 'windows-latest', 'macos-latest']) for (const shard of ['', '1/2', '2/2']) {
      const context = { github: { run_id: '321', run_attempt: attempt }, matrix: { os, shard } };
      const rendered = name.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(evaluate(expression, context)));
      expect(rendered).not.toContain('/');
      names.push(rendered);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('[REQ-289] OS・シャード・選択したテストステップの結果を診断へ渡す', () => {
    const generate = stepById('diagnostics');
    expect(generate).toContain('run: node scripts/ci-test-diagnostics.mjs');
    expect(generate).toContain('CI_TEST_OS: ${{ matrix.os }}');
    expect(generate).toContain("CI_TEST_SHARD: ${{ matrix.shard || 'all' }}");
    const outcome = generate.match(/^ {10}CI_TEST_OUTCOME: (.*)$/m)![1];
    for (const shard of ['', '1/2', '2/2']) for (const status of ['success', 'failure', 'skipped']) {
      const context = { matrix: { shard }, steps: { test_shard: { outcome: shard ? status : 'skipped' }, test_all: { outcome: shard ? 'skipped' : status } } };
      expect(evaluate(outcome, context)).toBe(status);
    }
    expect(stepById('checkout')).toContain('uses: actions/checkout@');
    expect(stepById('node')).toContain('uses: actions/setup-node@');
  });
});
