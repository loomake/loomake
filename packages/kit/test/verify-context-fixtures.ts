import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CHANGE, ledgerRow, requirement, specMd, traceMd, type ProjectFiles } from './project.js';

export function copyChangeToArchive(root: string): string {
  const target = join(root, 'openspec/changes/archive', `2026-11-03-${CHANGE}`);
  mkdirSync(dirname(target), { recursive: true }); cpSync(join(root, 'openspec/changes', CHANGE), target, { recursive: true }); return target;
}
export function verifyContextCases(): { name: string; files: ProjectFiles; expected: 'PASS' | 'FAIL' }[] {
  const main = (...blocks: string[]) => '# Probe Specification\n\n## Purpose\nThis fixture preserves complete main specification context for ordinary strict validation.\n\n## Requirements\n\n' + blocks.join('\n');
  const stable = requirement('Stable'), old = requirement('Old'), renamed = old.replace('Requirement: Old', 'Requirement: New');
  const cases: ReturnType<typeof verifyContextCases> = [];
  const config = { openspecValidate: true, commands: {} };
  const operations = [
    { op: 'ADDED', spec: specMd(requirement('New')), before: [], after: [requirement('New')] },
    { op: 'MODIFIED', spec: '## MODIFIED Requirements\n\n' + old, before: [old], after: [old] },
    { op: 'REMOVED', spec: '## REMOVED Requirements\n\n### Requirement: Old\nSource: REQ-012\n', before: [old], after: [] },
    { op: 'RENAMED', spec: '## RENAMED Requirements\n\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: New`\n', before: [old], after: [renamed] },
  ];
  for (const operation of operations) for (const after of [false, true]) {
    cases.push({ name: `${operation.op}/${after ? 'after' : 'before'}`, expected: 'PASS', files: { config, spec: operation.spec,
      trace: operation.op === 'RENAMED' ? traceMd({ ledger: [ledgerRow('REQ-012', '既存仕様で充足')] }) : undefined,
      files: { 'openspec/specs/x/spec.md': main(stable, ...(after ? operation.after : operation.before)) } } });
  }
  cases.push({ name: 'scenario loss', expected: 'FAIL', files: { config, spec: '## MODIFIED Requirements\n\n' + old,
    files: { 'openspec/specs/x/spec.md': main(old + '\n#### Scenario: Lost\n- **WHEN** input\n- **THEN** kept\n') } } },
  { name: 'unknown metadata', expected: 'FAIL', files: { config, files: { [`openspec/changes/${CHANGE}/.openspec.yaml`]: 'schema: spec-driven\nunknown: true\n' } } },
  { name: 'ambiguous task numbers', expected: 'FAIL', files: { config, tasks: '## 1. Tasks\n- [x] 1.1 one\n- [x] 1.1 duplicate\n' } });
  const schema = readFileSync(new URL('../../../node_modules/@fission-ai/openspec/schemas/spec-driven/schema.yaml', import.meta.url), 'utf8');
  for (const valid of [true, false]) cases.push({ name: `project schema/${valid}`, expected: valid ? 'PASS' : 'FAIL', files: { config, files: {
    'openspec/config.yaml': 'schema: local-fixture\n', 'openspec/schemas/local-fixture/schema.yaml': schema.replaceAll('tasks.md', 'steps.md'),
    [`openspec/changes/${CHANGE}/steps.md`]: valid ? '- [x] 1.1 task\n' : '- task without a checkbox\n',
  } } });
  return cases;
}
