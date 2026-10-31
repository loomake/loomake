import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyCall, summarizeExternalCalls, preparePublicDiagnostics, publicDiagnosticsProblem, exportExternalDiagnostics } from '../scripts/external-call-diagnostics.mjs';

const row = (extra: Record<string, unknown> = {}) => ({ event: 'call', callId: '1-1', pid: 1, op: 'gh-pr-list', mode: 'normal', timeoutRequested: false,
  t0: 100, t1: 101, R: 5000, Rclamped: false, hw0: 10, hw1: 10, tx: 2200,
  spawned: true, spawnCount: 1, result: 'threw', limitKind: 'timeout', reasonPresent: false,
  internalTimeoutMs: null, timeoutIntervalMs: [1998, 2000],
  spawn: { ts: 103, te: 2200, D: 2101, outcomeKind: 'timeout', invalid: false }, ...extra });
const report = { testResults: [{ assertionResults: [{ fullName: '[REQ-182] 1 操作の期限より遅い pre-commit・pre-push のフックがあっても、run の残り時間の中でコミット・push・PR の作成まで進む', status: 'passed' }] }] };

describe('外部操作診断の分類と欠損', () => {
  it('1操作の上限と共有期限、create共有期限を分ける', () => {
    expect(classifyCall(row())).toMatchObject({ classification: 'operation-limit' });
    const shared = row({ spawn: { ts: 103, D: 5100.5, outcomeKind: 'timeout', invalid: false } });
    expect(classifyCall(shared)).toMatchObject({ classification: 'shared-deadline', coincidentOperationPossible: true });
    expect(classifyCall({ ...shared, op: 'gh-pr-create', mode: 'untilDeadline' })).toMatchObject({ classification: 'create-shared-deadline' });
  });
  it('保持役の準備待ちを除いた予算から実共有期限の区間を求める', () => {
    expect(classifyCall(row({ hw1: 1010, spawn: { ts: 1103, D: 6100.5, outcomeKind: 'timeout', invalid: false } })))
      .toMatchObject({ classification: 'shared-deadline', sharedDeadlineIntervalMs: [6100, 6101] });
  });
  it.each([
    { R: null }, { spawn: null }, { spawnCount: 2 }, { hw1: NaN }, { t0: 1e308, t1: 1e308, R: 1e308 },
    { spawn: { D: 6000, outcomeKind: 'timeout', invalid: false } },
    { spawn: { D: 2101, outcomeKind: 'output', invalid: false } },
    { spawn: { D: 2101, outcomeKind: 'timeout', invalid: true } },
  ])('欠けた値や不整合を原因として断定しない %j', (change) => {
    const actual = classifyCall(row(change)); expect(actual.classification).toBe('undetermined'); expect(actual.reasons.length).toBeGreaterThan(0);
  });
  it('通常成功と返値error・未知のthrowを区別する', () => {
    expect(classifyCall(row({ result: 'returned', limitKind: null }))).toHaveProperty('classification', 'completed');
    for (const result of ['returned-error', 'threw']) expect(classifyCall(row({ result, limitKind: null }))).toMatchObject({ classification: 'undetermined', reasons: ['non-limit-error'] });
  });
  it('起動前timeoutと結果欠損のinterruptedを識別する', () => {
    expect(classifyCall(row({ spawned: false, spawn: null, spawnCount: 0, R: 0, Rclamped: true }))).toMatchObject({ classification: 'pre-spawn-timeout' });
    expect(classifyCall(row({ spawned: false, spawn: null, spawnCount: 0, R: null }))).toMatchObject({ classification: 'pre-spawn-undetermined' });
    expect(classifyCall(row({ limitKind: 'interrupted', reasonPresent: true }))).toMatchObject({ classification: 'missing-result' });
  });
  it('最後のghと全limit行だけを投影し、元の自由な文字列を保存しない', () => {
    const data = [row({ callId: '1-1', limitKind: undefined, result: 'returned', secret: 'private-value' }), row({ callId: '1-2', op: 'git-status', secret: 'private-value' }), row({ callId: '1-3' })];
    const summary = summarizeExternalCalls(data, report);
    expect(summary.calls).toHaveLength(2); expect(summary.calls.map((c: { callId: string | null }) => c.callId)).toEqual(['1-2', '1-3']);
    expect(JSON.stringify(summary)).not.toContain('private-value');
    expect(summary.selector).toBe('matched');
  });
  it('未到達とselectorの0件・2件・別試験を成功にしない', () => {
    expect(summarizeExternalCalls([], report)).toMatchObject({ reachability: 'unreachable', callCount: 0, spawnCount: 0 });
    expect(summarizeExternalCalls([], {})).toHaveProperty('selector', 'selector-mismatch');
    expect(summarizeExternalCalls([], { testResults: [...report.testResults, ...report.testResults] })).toHaveProperty('selector', 'selector-mismatch');
    expect(summarizeExternalCalls([], { testResults: [{ assertionResults: [{ fullName: 'unrelated', status: 'passed' }] }] })).toHaveProperty('selector', 'selector-mismatch');
  });
  it('CLIは失敗試験の1件選択を保持し、壊れた診断と上限印を欠損として保存する', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-summary-'));
    try {
      const processes = join(dir, 'processes'); mkdirSync(processes);
      const testReport = join(dir, 'report.json'); writeFileSync(testReport, JSON.stringify({ testResults: [{ assertionResults: [{ ...report.testResults[0].assertionResults[0], status: 'failed' }] }] }));
      writeFileSync(join(processes, 'calls.1.a.jsonl'), JSON.stringify(row()) + '\nnot-json\n' + JSON.stringify({ event: 'truncated' }) + '\n');
      const script = join(import.meta.dirname, '../scripts/external-call-diagnostics.mjs');
      const result = spawnSync(process.execPath, [script, processes, testReport], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      const summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
      expect(summary).toMatchObject({ unreadable: 1, truncated: true, selector: 'matched', selectedOutcome: 'failed' });
      expect(summary.calls[0].classification).toBe('operation-limit');
      expect(summary.calls[0].missingFields).toEqual([]);
      expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toContain('修理でもない');
      writeFileSync(testReport, '{}');
      expect(spawnSync(process.execPath, [script, processes, testReport]).status).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('公開用4ファイルはPIDや未知キー・秘密風文字列を再投影で除き、同callの観測を保持する', () => {
    const input = row({ callId: 'private-pid-account', privateKey: 'private-token',
      spawn: { ts: 103, te: 2200, D: 2101, outcomeKind: 'timeout', invalid: false, supervisorPid: 987654321, privateKey: 'private-token' } });
    const payload = preparePublicDiagnostics([input], { ...report, secret: 'private-token' }, { heartbeat: { beats: 1, maxGapMs: 10, secret: 'private-token' } });
    expect(publicDiagnosticsProblem(payload)).toBeNull();
    expect(payload.calls[0]).toMatchObject({ callId: 'call-1', R: 5000, spawn: { D: 2101, outcomeKind: 'timeout' }, classification: 'operation-limit' });
    expect(payload.summary.calls[0].callId).toBe(payload.calls[0].callId);
    const text = JSON.stringify(payload); expect(text).not.toMatch(/private|987654321|supervisorPid|fullName|testResults/);
    expect(payload.heartbeat).toMatchObject({ available: true, beats: 1, maxGapMs: 10 });
  });
  it('公開schemaは未知キー・自由文字列・非有限値・markdown混入を拒否する', () => {
    const payload = preparePublicDiagnostics([row()], report);
    const change = (mutate: (value: typeof payload) => void) => { const copy = structuredClone(payload); mutate(copy); return publicDiagnosticsProblem(copy); };
    expect(change((p) => { Object.assign(p.calls[0], { unknown: 'private-token' }); })).toBe('invalid-call-schema');
    expect(change((p) => { p.calls[0].op = 'private-token'; })).toBe('invalid-call-schema');
    expect(change((p) => { p.calls[0].R = Infinity; })).toBe('invalid-call-schema');
    expect(change((p) => { Object.assign(p.summary, { unknown: 'private-token' }); })).toBe('invalid-summary-schema');
    expect(change((p) => { p.markdown += 'private-token'; })).toBe('markdown-mismatch');
    expect(change((p) => { p.calls[0].callId = '12345-1'; })).toBe('invalid-call-schema');
  });
  it('公開exportの固定4ファイルを実際に書き、元report/preload/任意ファイルを持ち込まない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-public-diagnostics-'));
    try {
      const processes = join(dir, 'processes'); mkdirSync(processes);
      const input = join(dir, 'report.json'); writeFileSync(input, JSON.stringify(report));
      writeFileSync(join(processes, 'calls.1.a.jsonl'), JSON.stringify(row({ secret: 'private-token' })) + '\n');
      writeFileSync(join(processes, 'arbitrary.txt'), 'private-token');
      writeFileSync(join(processes, 'preload.processes.jsonl'), 'private-token');
      const output = join(dir, 'public-export');
      const payload = exportExternalDiagnostics(processes, input, output);
      expect(readdirSync(output).sort()).toEqual(['calls.jsonl', 'heartbeat.json', 'summary.json', 'summary.md']);
      const actual = { calls: readFileSync(join(output, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)),
        summary: JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8')), heartbeat: JSON.parse(readFileSync(join(output, 'heartbeat.json'), 'utf8')), markdown: readFileSync(join(output, 'summary.md'), 'utf8') };
      expect(publicDiagnosticsProblem(actual)).toBeNull(); expect(actual).toEqual(payload);
      expect(JSON.stringify(actual)).not.toMatch(/private-token|testResults|fullName/);
      expect(() => exportExternalDiagnostics(processes, input, output)).toThrow('export-directory-not-empty');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('公開再投影でも欠損・選択失敗・未到達の情報を保持する', () => {
    const payload = preparePublicDiagnostics([row({ R: null, spawn: null, spawned: false, spawnCount: 0 })], {});
    expect(payload.summary).toMatchObject({ selector: 'selector-mismatch', reachability: 'unreachable' });
    expect(payload.calls[0]).toMatchObject({ classification: 'pre-spawn-undetermined', R: null, spawn: null, internalTimeoutMs: null });
    expect(payload.calls[0].missingFields).toContain('R'); expect(payload.calls[0].missingFields).toContain('spawn');
    expect(payload.heartbeat.available).toBe(false);
  });

  it('公開CLIだけが検査済みmarkdownをStep Summaryへ出し、ローカル集計は投稿しない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-public-cli-'));
    try {
      const processes = join(dir, 'processes'); mkdirSync(processes);
      const reportFile = join(dir, 'report.json'); writeFileSync(reportFile, JSON.stringify(report));
      writeFileSync(join(processes, 'calls.1.a.jsonl'), JSON.stringify(row({ callId: '987654321-1' })) + '\n');
      const githubSummary = join(dir, 'step-summary.md'); writeFileSync(githubSummary, 'before\n');
      const script = join(import.meta.dirname, '../scripts/external-call-diagnostics.mjs');
      const githubOutput = join(dir, 'step-output.txt');
      const env = { ...process.env, GITHUB_STEP_SUMMARY: githubSummary, GITHUB_OUTPUT: githubOutput };
      expect(spawnSync(process.execPath, [script, processes, reportFile], { env }).status).toBe(0);
      expect(readFileSync(githubSummary, 'utf8')).toBe('before\n');
      const output = join(dir, 'public-export');
      expect(spawnSync(process.execPath, [script, processes, reportFile, '--public-export', output], { env }).status).toBe(0);
      expect(readFileSync(githubSummary, 'utf8')).toBe('before\n' + readFileSync(join(output, 'summary.md'), 'utf8'));
      expect(readFileSync(githubSummary, 'utf8')).not.toContain('987654321');
      expect(readFileSync(githubOutput, 'utf8')).toBe('export_validated=true\n');
      writeFileSync(reportFile, '{}');
      const missing = join(dir, 'selector-mismatch-export');
      expect(spawnSync(process.execPath, [script, processes, reportFile, '--public-export', missing], { env }).status).toBe(1);
      expect(readFileSync(githubOutput, 'utf8')).toBe('export_validated=true\nexport_validated=true\n');
      expect(JSON.parse(readFileSync(join(missing, 'summary.json'), 'utf8')).selector).toBe('selector-mismatch');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

});


describe('外部操作の中断と時計窓の補正', () => {
  it.each([false, true])('先行欠損の後の起動前中断を自call欠損と分ける reason=%s', (reasonPresent) => {
    const summary = summarizeExternalCalls([
      row({ callId: '1-1', limitKind: 'interrupted', reasonPresent: true }),
      row({ callId: '1-2', spawned: false, spawn: null, spawnCount: 0, limitKind: 'interrupted', reasonPresent }),
    ], report);
    expect(summary.calls.map((call: { classification: string }) => call.classification)).toEqual(['missing-result', 'pre-spawn-interrupted']);
  });
  it('spawn不明や複数spawnの中断を自callの結果欠損と断定しない', () => {
    const unknown = classifyCall(row({ spawned: null, limitKind: 'interrupted', reasonPresent: true }));
    expect(unknown.classification).toBe('undetermined');
    expect(unknown.reasons).toContain('spawn-state-unavailable');
    const multiple = classifyCall(row({ spawnCount: 2, limitKind: 'interrupted', reasonPresent: true }));
    expect(multiple.classification).toBe('undetermined');
    expect(multiple.reasons).toContain('spawn-count-mismatch');
  });
  it.each([
    [5097.5, 'normal', false, 'shared-deadline', true, undefined],
    [5089, 'normal', false, 'shared-deadline', true, undefined],
    [5088.999, 'normal', false, 'operation-limit', false, undefined],
    [5088.999, 'untilDeadline', false, 'undetermined', false, 'deadline-before-shared-interval'],
    [5088.999, 'quality', true, 'undetermined', false, 'requested-timeout-possible'],
    [5088.999, 'normal', true, 'undetermined', false, 'requested-timeout-possible'],
    [5088.999, 'normal', undefined, 'undetermined', false, 'timeout-option-unavailable'],
    [5097.5, 'untilDeadline', false, 'shared-deadline', false, undefined],
    [5097.5, 'quality', true, 'shared-deadline', true, undefined],
    [5097.5, 'normal', undefined, 'shared-deadline', true, undefined],
    [5102, 'normal', false, 'shared-deadline', true, undefined],
    [5102.001, 'normal', false, 'undetermined', false, 'deadline-after-shared-interval'],
  ] as const)('未観測遅延を含むD=%s mode=%s timeout=%sを区別する', (D, mode, timeoutRequested, classification, coincidentOperationPossible, reason) => {
    const actual = classifyCall(row({ mode, timeoutRequested, spawn: { ts: 111, D, outcomeKind: 'timeout', invalid: false } }));
    expect(actual).toMatchObject({ classification, coincidentOperationPossible, sharedDeadlineIntervalMs: [5100, 5101] });
    if (reason) expect(actual.reasons).toContain(reason);
    else expect(actual.reasons).toEqual([]);
  });
  it('保持役待ちを未観測遅延から引き、十分離れた実1操作上限を保持する', () => {
    expect(classifyCall(row({ hw1: 1010, spawn: { ts: 1111, D: 6000, outcomeKind: 'timeout', invalid: false } }))).toMatchObject({ classification: 'operation-limit' });
    expect(classifyCall(row())).toMatchObject({ classification: 'operation-limit' });
  });
  it.each([
    [null, 'spawn-start-unavailable'], [Infinity, 'spawn-start-unavailable'], [50, 'observation-order-invalid'],
  ] as const)('spawn時計%sの欠測や逆転を未確定にする', (ts, reason) => {
    const actual = classifyCall(row({ spawn: { ts, D: 5100, outcomeKind: 'timeout', invalid: false } }));
    expect(actual.classification).toBe('undetermined'); expect(actual.reasons).toContain(reason);
  });
  it('mode不明なら遠いdeadlineも操作上限と断定しない', () => {
    const actual = classifyCall(row({ mode: null }));
    expect(actual.classification).toBe('undetermined'); expect(actual.reasons).toContain('mode-unavailable');
  });
  it('旧rawの明示timeout欠落はunknownへ投影し、版2と公開schemaで区別する', () => {
    const legacy: Record<string, unknown> = row(); delete legacy.timeoutRequested;
    const payload = preparePublicDiagnostics([legacy], report);
    expect(payload.summary.version).toBe(2);
    expect(payload.calls[0]).toMatchObject({ timeoutRequested: null, classification: 'undetermined' });
    expect(payload.calls[0].reasons).toContain('timeout-option-unavailable');
    expect(publicDiagnosticsProblem(payload)).toBeNull();
    const oldVersion = structuredClone(payload); oldVersion.summary.version = 1;
    expect(publicDiagnosticsProblem(oldVersion)).toBe('invalid-summary-schema');
    for (const mutation of ['missing', 'string', 'unknown'] as const) {
      const invalid = structuredClone(payload);
      if (mutation === 'missing') delete invalid.calls[0].timeoutRequested;
      else if (mutation === 'string') invalid.calls[0].timeoutRequested = 'private-value';
      else invalid.calls[0].unknown = 'private-value';
      expect(publicDiagnosticsProblem(invalid)).toBe('invalid-call-schema');
    }
  });
  it('公開Markdownで同時上限の可能性と理由・欠損、別々の保存上限を示す', () => {
    const payload = preparePublicDiagnostics([row({ R: null, spawn: null })], report);
    expect(payload.markdown).toContain('| call | 操作 | mode | 判定 | 同時上限の可能性 |');
    expect(payload.markdown).toContain('| 理由 | 欠損 |');
    expect(payload.markdown).toContain('shared-deadline-unavailable');
    expect(payload.markdown).toContain('64KiB'); expect(payload.markdown).toContain('1MiB');
    expect(payload.markdown).toContain('256KiB'); expect(payload.markdown).toContain('2KiB');
    expect(publicDiagnosticsProblem({ ...payload, markdown: payload.markdown + 'altered' })).toBe('markdown-mismatch');
  });
});
