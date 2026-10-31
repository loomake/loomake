import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
const workflow = read('.github/workflows/diagnose-hook-budget.yml');
const steps = workflow.slice(workflow.indexOf('\n    steps:\n') + 12).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
function stepById(id: string) { const step = steps.find((s) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(s)); expect(step, id).toBeDefined(); return step!; }
function evaluate(expression: string, context: Record<string, unknown>) { return runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 }); }

describe('Windowsフック期限の単独診断workflow', () => {
  it('PRと手動起動を固定Windows1サンプルへ向け、元ケースだけを一件選ぶ', () => {
    expect(workflow).toContain('  pull_request:\n    paths:'); expect(workflow).toContain('  workflow_dispatch:');
    for (const file of ['.github/workflows/diagnose-hook-budget.yml', 'scripts/external-call-diagnostics.mjs', 'packages/runner/test/process-diagnostics.ts', 'packages/runner/test/external-budget-deadline.test.ts', 'packages/runner/test/process-diagnostics.test.ts', 'tests/external-call-diagnostics.test.ts', 'tests/hook-budget-diagnostics-workflow.test.ts']) expect(workflow).toContain(`'${file}'`);
    expect(workflow).toContain('runs-on: windows-latest'); expect(workflow).not.toContain('matrix:');
    expect(stepById('node')).toContain('node-version: 24');
    const command = stepById('test').match(/^ {8}run: (.*)$/m)![1];
    const selector = command.match(/-t '([^']+)'/)![1]; const names: string[] = [];
    const source = ts.createSourceFile('test.ts', read('packages/runner/test/external-budget-deadline.test.ts'), ts.ScriptTarget.Latest, true);
    const walk = (node: ts.Node): void => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'it' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) names.push(node.arguments[0].text); ts.forEachChild(node, walk); }; walk(source);
    expect(names.filter((name) => new RegExp(selector).test(name))).toEqual(['[REQ-182] 1 操作の期限より遅い pre-commit・pre-push のフックがあっても、run の残り時間の中でコミット・push・PR の作成まで進む']);
    expect(command).toContain('packages/runner/test/external-budget-deadline.test.ts');
    expect(workflow).not.toMatch(/continue-on-error|--retry|--repeat|--maxWorkers|--testTimeout|--shard|(?:^|\n)\s+(?:TEMP|TMP):/);
  });
  it('試験失敗後も集計と保存を行い、準備失敗やキャンセルでは行わない', () => {
    for (const step of [stepById('summarize'), stepById('upload')]) {
      const expression = step.match(/^ {8}if: (.*)$/m)![1];
      const context = (checkout: string, node: string, cancelled = false) => ({ steps: { checkout: { outcome: checkout }, node: { outcome: node }, test: { outcome: 'failure' }, summarize: { outcome: 'failure', outputs: { export_validated: 'true' } } }, cancelled: () => cancelled });
      expect(evaluate(expression, context('success', 'success'))).toBe(true);
      for (const pair of [['failure', 'success'], ['success', 'failure'], ['skipped', 'success']]) expect(evaluate(expression, context(pair[0], pair[1]))).toBe(false);
      expect(evaluate(expression, context('success', 'success', true))).toBe(false);
    }
    expect(stepById('test')).toContain('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR: ${{ runner.temp }}/loomake-hook-budget/processes');
    expect(stepById('test')).toContain('LOOMAKE_CI_HEARTBEAT_DIR: ${{ runner.temp }}/loomake-hook-budget/heartbeat');
    expect(steps.indexOf(stepById('summarize'))).toBeGreaterThan(steps.indexOf(stepById('test')));
    expect(stepById('summarize')).toContain('.loomake/test-report.json');
    expect(stepById('upload')).toContain("steps.summarize.outputs.export_validated == 'true'");
    const uploadExpression = stepById('upload').match(/^ {8}if: (.*)$/m)![1];
    expect(evaluate(uploadExpression, { cancelled: () => false, steps: { checkout: { outcome: 'success' }, node: { outcome: 'success' }, summarize: { outcome: 'failure', outputs: { export_validated: 'false' } } } })).toBe(false);
    expect(stepById('summarize')).toContain('--public-export');
    expect(stepById('heartbeat_stop')).toContain('stopHeartbeat(process.argv[1], {})');
  });
  it('固定Actionとread権限を使い検査済みの公開用4ファイルだけを7日保存する', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    const pins = JSON.parse(read('.github/action-pins.json')).actions as { repository: string; sha: string }[];
    const actions = [...workflow.matchAll(/^ {6}- uses: (\S+)@([a-f0-9]{40})/gm)];
    expect(actions.map((a) => a[1])).toEqual(['actions/checkout', 'pnpm/action-setup', 'actions/setup-node', 'actions/upload-artifact']);
    for (const action of actions) expect(pins).toContainEqual(expect.objectContaining({ repository: action[1], sha: action[2] }));
    expect(stepById('checkout')).toContain('persist-credentials: false'); expect(stepById('upload')).toContain('retention-days: 7');
    expect(stepById('upload')).toContain('if-no-files-found: warn');
    const upload = stepById('upload'); expect(upload).toContain('name: hook-budget-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(upload.match(/path: \|\n([\s\S]*?)\n {10}retention-days:/)?.[1].trim().split('\n').map((s) => s.trim())).toEqual(['calls.jsonl', 'summary.json', 'summary.md', 'heartbeat.json'].map((f) => '${{ runner.temp }}/loomake-hook-budget/export/' + f));
    expect(upload).not.toMatch(/test-report|processes|\*|export\/\s*$/m);
    expect(read('.github/workflows/ci.yml')).not.toContain('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR');
  });
});
