import {
  parseTrace, parseTasks, parseSpec, extractTestRequirements, VERIFY_RESULT_SCHEMA_VERSION,
  type ParseError, type Trace, type Task, type VerifyResult, type VerifyCheckResult,
} from '@loomake/core';
import { runVerify, formatVerifyResult, UsageError, type VerifyOptions } from '@loomake/kit';
import { runRecord, runReport, buildReport, EVIDENCE_SCHEMA_VERSION, type Evidence, type Report } from '@loomake/trace';
import { runRun, maskSecrets, type RunOptions, type RunSummary } from '@loomake/runner';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type StatusContract = Assert<Equal<VerifyCheckResult['status'], 'pass' | 'fail' | 'warn' | 'skip'>>;

// 型チェックだけに使う利用側の例。呼び出してファイルやGitを変更しない。
export function consumePublicApi(root: string) {
  const error: ParseError = { file: 'trace.md', line: 1, message: '入力の確認' };
  const trace: Trace = parseTrace(error.file, '').value;
  const tasks: Task[] = parseTasks('tasks.md', '- [ ] task').value;
  const checked: boolean = tasks[0].checked;
  const specs = parseSpec('spec.md', '').value;
  const ids: Record<string, string[]> = extractTestRequirements('report.json', '{}').value;
  const verification: VerifyResult = { schemaVersion: VERIFY_RESULT_SCHEMA_VERSION, mode: 'done', change: 'sample', ok: true, results: [] };
  const ok: boolean = verification.ok;
  const options: VerifyOptions = { root, changeId: 'sample', gate: 'spec-only' };
  const verified: VerifyResult = runVerify(options);
  const text: string = formatVerifyResult(verified);
  const oldEvidence: Evidence = { schemaVersion: EVIDENCE_SCHEMA_VERSION, change: 'sample', sha: 'a', committedAt: '', recordedAt: '', verify: verification };
  const recorded: number = runRecord({ root, changeId: 'sample', stdout: () => {} });
  const reported: number = runReport({ root, changeId: 'sample', format: 'json', stdout: () => {} });
  const report: Report | undefined = buildReport(root, 'sample');
  const runOptions: RunOptions = { root, changeId: 'sample', interactive: false, confirm: async () => false, stdout: () => {} };
  const running: Promise<number> = runRun(runOptions);
  const summary: RunSummary = { change: 'sample', status: 'interrupted', reason: '', doneTasks: [], remainingTasks: [], lastVerify: null };
  const masked: string = maskSecrets(text);
  return { trace, checked, specs, ids, ok, oldEvidence, recorded, reported, report, running, summary, masked, error: new UsageError('設定の確認') };
}
