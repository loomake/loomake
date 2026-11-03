import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatVerifyResult, isAbortedResult, loadVerifyQualitySchema, runVerify, UsageError, verifyExitCode } from '@loomake/kit';
import type { VerifyResult } from '@loomake/core';
import * as input from '../src/runtime/input.js';
import * as process from '../src/runtime/process.js';
import { CHANGE, COPY_REPORT, commitAll, reportJson, traceMd, withProject } from './project.js';
const qualitySchema = await loadVerifyQualitySchema();
const name = '依存する成果物';
const row = ['D-01', 'REQ-012', 'change', 'producer', '', '', ''];
const rows = [row, ['D-02', 'REQ-012', 'issue', '#12', 'producer', '', '1/2'],
  ['D-03', 'REQ-012', 'path', 'src/main.ts', 'producer', 'a'.repeat(40), '']];
const section = (values = rows) => '\n## 依存する成果物\n| ID | 関連 | 種類 | 依存先 | 提供元 | 期待blob | CI |\n|---|---|---|---|---|---|---|\n' + values.map(v => `| ${v.join(' | ')} |`).join('\n');
const check = (r: VerifyResult) => !isAbortedResult(r) ? r.checks.find(c => c.id === name) : undefined;
const run = (root: string, gate: 'spec-only' | 'done' = 'spec-only', scope: 'local' | 'ci' = 'local') => runVerify({ root, qualitySchema, changeId: CHANGE, gate, scope });
const tracePath = (root: string) => join(realpathSync(root), 'openspec/changes', CHANGE, 'trace.md');
const ready = { config: { openspecValidate: false, commands: { test: COPY_REPORT } }, quality: true };
const prepare = (root: string) => writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] works', 'passed']] }));
afterEach(() => vi.restoreAllMocks());
it.each(['local', 'ci'] as const)('[REQ-401] all three declarations are ordered notices in spec-only/%s', scope => withProject({ trace: traceMd() + section() }, root => {
  const r = run(root, 'spec-only', scope);
  expect(check(r)).toEqual({ id: name, result: 'PASS', reason: '案内：REQ-012 ← D-01 change producer（未確認）\nREQ-012 ← D-02 issue #12（未確認）\nREQ-012 ← D-03 path src/main.ts（未確認）', evidence: [] });
  expect(verifyExitCode(r)).toBe(0); expect(r.run.errors).toEqual([]);
  expect(!isAbortedResult(r) && r.decision.required).toBe(false);
  expect(formatVerifyResult(r)).toContain('! 依存する成果物');
}));
it.each(['local', 'ci'] as const)('[REQ-401] all three dependencies turn an otherwise successful done/%s into pending evidence', scope => withProject(ready, root => {
  prepare(root); commitAll(root); expect(verifyExitCode(run(root, 'done', scope))).toBe(0);
  writeFileSync(tracePath(root), traceMd() + section()); commitAll(root);
  const r = run(root, 'done', scope);
  expect(check(r)?.result).toBe('INSUFFICIENT_EVIDENCE'); expect(verifyExitCode(r)).toBe(1);
  expect(r.run.errors).toEqual([]); expect(!isAbortedResult(r) && r.decision.required).toBe(false);
  expect(!isAbortedResult(r) && r.scope === 'local' ? r.summary.pending : !isAbortedResult(r) && r.scope === 'ci' && r.summary.insufficient).toBe(1);
  expect(!isAbortedResult(r) && r.checks.filter(c => c.id !== name).every(c => c.result === 'PASS')).toBe(true);
}));
const invalid = [section([row, row]), section([['D-01', 'REQ-999', ...row.slice(2)]]), section([[...row.slice(0, 3), CHANGE, '', '', '']]),
  section([[...row.slice(0, 3), 'archive', '', '', '']]), section([['D-01', 'REQ-012', 'issue', '#12', '', '', '']]),
  section([['D-01', 'REQ-012', 'issue', 'https://github.com/else/repo/issues/12', 'producer', '', '']]),
  section([['D-01', 'REQ-012', 'path', '../file', 'producer', 'a'.repeat(40), '']]),
  section([['D-01', 'REQ-012', 'path', 'file', 'producer', 'xyz', '']]), section([[...row.slice(0, 6), 'wrong']]),
  section().replace('関連', 'unknown'), '\n## 依存する成果物\n', section([row, ['D-02', 'REQ-999', ...row.slice(2)]])];
it.each(invalid.flatMap(body => (['spec-only', 'done'] as const).map(gate => ({ body, gate }))))('[REQ-401] syntax errors win even with populated declarations ($gate) %#', ({ body, gate }) => withProject({ trace: traceMd() + body }, root => {
  const r = run(root, gate); expect(check(r)?.result).toBe('FAIL'); expect(verifyExitCode(r)).toBe(1);
  expect(check(r)?.reason).toMatch(/trace\.md:\d+ /); expect(check(r)?.reason).not.toContain('未確認');
}));
it.each(['', '\n## 依存と技術確認\n' + section().replace('## 依存する成果物', 'old'), '\n```md\n' + section() + '\n```'])('[REQ-401] absent declarations preserve the entire result, text and exit %#', suffix => withProject({}, root => {
  const before = run(root); writeFileSync(tracePath(root), traceMd() + suffix); const after = run(root);
  expect(after).toEqual(before); expect(formatVerifyResult(after)).toBe(formatVerifyResult(before)); expect(verifyExitCode(after)).toBe(verifyExitCode(before));
}));
it.each(['question', 'assumption'] as const)('[REQ-401] dependency evidence preserves existing %s decisions and other failures', kind => withProject({ trace: kind === 'question'
  ? traceMd({ questions: ['| Q-01 | REQ-012 | How many | 1 / 2 | 1 | yes | |'] })
  : traceMd({ assumptions: ['| A-01 | REQ-012 | assumption | reason | |'] }) }, root => {
  const before = run(root, 'done'); writeFileSync(tracePath(root), readFileSync(tracePath(root), 'utf8') + section()); const after = run(root, 'done');
  expect(check(after)?.result).toBe('INSUFFICIENT_EVIDENCE'); expect(after.run).toEqual(before.run);
  expect(afte!isAbortedResult(r) && !isAbortedResult(before) && after.decision).toEqual(!isAbortedResult(before) && before.decision);
  expect(afte!isAbortedResult(r) && after.checks.filter(c => c.id !== name)).toEqual(!isAbortedResult(before) && before.checks);
}));
it('[REQ-401] reuses the trace read and adds no reads or external calls for declarations', () => withProject({}, root => {
  const original = input.createInputReader, paths: string[] = [];
  vi.spyOn(input, 'createInputReader').mockImplementation(limits => { const reader = original(limits), read = reader.read; return { ...reader, read: p => { paths.push(p); return read(p); } }; });
  const external = vi.spyOn(process, 'runExternal'); run(root); const first = paths.splice(0); const calls = external.mock.calls.length;
  writeFileSync(tracePath(root), traceMd() + section()); run(root);
  expect(paths).toEqual(first); expect(paths.filter(p => p === tracePath(root))).toHaveLength(1); expect(external.mock.calls.length).toBe(calls * 2);
}));
it.each([new UsageError('input budget exceeded'), new process.ProcessLimitError('interrupted', 'trace')])('[REQ-401] preserves the input exception without guidance %#', failure => withProject({ trace: traceMd() + section() }, root => {
  const original = input.createInputReader;
  vi.spyOn(input, 'createInputReader').mockImplementation(limits => { const reader = original(limits), read = reader.read; return { ...reader, read: p => { if (p === tracePath(root)) throw failure; return read(p); } }; });
  expect(() => run(root)).toThrow(failure);
}));
