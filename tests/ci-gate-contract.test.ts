import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type GateJob = { if?: string; permissions?: unknown; steps: Record<string, unknown>[]; [key: string]: unknown };
type Workflow = { jobs: Record<string, GateJob> };
const { parse } = createRequire(new URL('../packages/kit/package.json', import.meta.url))('yaml') as { parse(text: string): Workflow };
const inlineGate = () => parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')).jobs.gate!;
const permissions = { contents: 'read', 'pull-requests': 'read' };
const expectedSteps = [
  { uses: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262', with: { 'persist-credentials': false, 'fetch-depth': 0 } },
  { run: 'git rev-parse --verify main || git branch main origin/main' },
  { uses: 'pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1' },
  { uses: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020', with: { 'node-version': 24, cache: 'pnpm' } },
  { run: 'pnpm install --frozen-lockfile' },
  { run: 'npm install -g @fission-ai/openspec@1.15.0' },
  { run: 'openspec validate --specs --strict' },
  { run: 'pnpm build' },
  { id: 'gate', run: 'node scripts/ci-gate.mjs "$HEAD_REF"', env: {
    HEAD_REF: '${{ github.head_ref }}', BASE_REF: '${{ github.base_ref }}',
    PR_NUMBER: '${{ github.event.pull_request.number }}', GH_TOKEN: '${{ github.token }}',
  } },
];

function assertExecution(gate: GateJob) {
  expect(gate['runs-on']).toBe('ubuntu-latest');
  expect(gate.permissions).toEqual(permissions);
  expect(gate.steps).toEqual(expectedSteps);
}
function assertInlineGate(gate: GateJob) {
  expect(Object.keys(gate).sort()).toEqual(['if', 'permissions', 'runs-on', 'steps']);
  expect(gate.if).toBe("github.event_name == 'pull_request'");
  assertExecution(gate);
}

describe('完了ゲートの実行契約', () => {
  it('[REQ-010][REQ-054] CI・devcontainer・開発依存・配布テンプレートの OpenSpec の版が一致する', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const version = pkg.devDependencies['@fission-ai/openspec'];
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(inlineGate().steps).toContainEqual({ run: `npm install -g @fission-ai/openspec@${version}` });
    for (const path of ['../.devcontainer/devcontainer.json', '../packages/kit/templates/devcontainer/devcontainer.json']) {
      const devcontainer = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(devcontainer.match(/@fission-ai\/openspec@([^\s"\\]+)(?: |")/)?.[1], path).toBe(version);
    }
  });
  it('[REQ-010][REQ-054][REQ-132][REQ-168][REQ-273] 9steps・引数・順序・権限・条件が一致する', () => {
    assertInlineGate(inlineGate());
  });
  it.each<[string, (gate: GateJob) => void]>([
    ['install欠落', (gate) => { gate.steps.splice(4, 1); }],
    ['順序逆転', (gate) => { gate.steps.reverse(); }],
    ['fetch-depth欠落', (gate) => { delete (gate.steps[0]!.with as Record<string, unknown>)['fetch-depth']; }],
    ['token欠落', (gate) => { delete (gate.steps[8]!.env as Record<string, unknown>).GH_TOKEN; }],
    ['権限変更', (gate) => { (gate.permissions as Record<string, unknown>).contents = 'write'; }],
    ['実行条件変更', (gate) => { gate.if = 'always()'; }],
    ['失敗継続', (gate) => { gate['continue-on-error'] = true; }],
    ['step条件追加', (gate) => { gate.steps[7]!.if = 'always()'; }],
    ['成功step追加', (gate) => { gate.steps.push({ run: 'true' }); }],
  ])('[REQ-010][REQ-054][REQ-132][REQ-168][REQ-273] %sを拒否する', (_name, mutate) => {
    const gate = structuredClone(inlineGate());
    mutate(gate);
    expect(() => assertInlineGate(gate)).toThrow();
  });
});
