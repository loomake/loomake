import { Buffer } from 'node:buffer';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { summarizeHeartbeat } from './ci-heartbeat.mjs';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const nullable = (value) => finite(value) ? value : null;
const kinds = new Set(['timeout', 'output', 'interrupted']);
const operations = new Set(['status', 'show', 'diff', 'rev-parse', 'check-ignore', 'switch', 'add', 'commit', 'push', 'init', 'remote', 'config', 'list', 'create', 'auth', 'pr']);
const selector = 'pre-commit・pre-push のフックがあっても';
const LIMIT = 64 * 1024;
const MAX_RECORDS = 512;
const caveat = '単独サンプルの結果であり、main の並列実行での失敗の再現でも修理でもない。診断のI/Oとpreloadが所要時間に影響する。';

function safeOperation(value) {
  if (['git', 'gh', 'claude', 'openspec', 'other'].includes(value)) return value;
  if (typeof value !== 'string') return 'other';
  if (/^git-/.test(value) && operations.has(value.slice(4))) return value;
  if (/^gh-/.test(value) && value.slice(3).split('-').length <= 2 && value.slice(3).split('-').every((part) => operations.has(part))) return value;
  return 'other';
}

/** 観測したdeadline区間だけを使う。内部timeoutの厳密値は返さない。 */
export function classifyCall(row) {
  const reasons = [];
  const spawn = row?.spawn;
  let classification = 'undetermined';
  let sharedDeadlineIntervalMs = null;
  let coincidentOperationPossible = false;
  if (finite(row?.R) && row.R > 0 && !row.Rclamped && [row.t0, row.t1, row.hw0, row.hw1].every(finite)
      && row.t0 <= row.t1 && row.hw0 <= row.hw1) {
    const interval = [row.t0 + row.R - row.hw0 + row.hw1, row.t1 + row.R - row.hw0 + row.hw1];
    if (interval.every(finite)) sharedDeadlineIntervalMs = interval;
  }
  if (row?.spawned === false && row?.limitKind === 'timeout') classification = row.R === null ? 'pre-spawn-undetermined' : 'pre-spawn-timeout';
  else if (row?.spawned === false && row?.limitKind === 'interrupted') classification = 'pre-spawn-interrupted';
  else if (row?.spawned === true && row?.spawnCount === 1 && row?.limitKind === 'interrupted' && row?.reasonPresent === true) classification = 'missing-result';
  else if (!kinds.has(row?.limitKind)) {
    if (row?.result === 'returned') classification = 'completed';
    else reasons.push('non-limit-error');
  }
  else {
    if (row?.limitKind === 'interrupted' && typeof row?.spawned !== 'boolean') reasons.push('spawn-state-unavailable');
    if (!sharedDeadlineIntervalMs) reasons.push('shared-deadline-unavailable');
    if (!spawn || !finite(spawn.D)) reasons.push('deadline-unavailable');
    if (row?.spawnCount !== 1) reasons.push('spawn-count-mismatch');
    if (spawn?.invalid !== false) reasons.push('report-invalid-or-missing');
    if (spawn?.outcomeKind !== row?.limitKind) reasons.push('outcome-kind-mismatch');
    if (row?.limitKind !== 'timeout') reasons.push('non-timeout-limit');
    if (reasons.length === 0) {
      if (!finite(spawn.ts)) reasons.push('spawn-start-unavailable');
      if (!['normal', 'untilDeadline', 'quality'].includes(row.mode)) reasons.push('mode-unavailable');
      // startedAt→timeLeft の遅れは実測していない。保持役待ちを除く観測窓だけを上限にする。
      const delayBound = finite(spawn.ts) ? spawn.ts - row.t1 - (row.hw1 - row.hw0) : null;
      if (finite(spawn.ts) && (!finite(delayBound) || delayBound < -1)) reasons.push('observation-order-invalid');
      if (reasons.length === 0) {
        const [lo, hi] = sharedDeadlineIntervalMs;
        const requested = typeof row.timeoutRequested === 'boolean' ? row.timeoutRequested : null;
        if (spawn.D > hi + 1) reasons.push('deadline-after-shared-interval');
        else if (spawn.D >= lo - Math.max(0, delayBound) - 1) {
          classification = row.op === 'gh-pr-create' ? 'create-shared-deadline' : 'shared-deadline';
          coincidentOperationPossible = row.mode === 'normal' || requested !== false;
        } else if (requested !== false) reasons.push(requested === null ? 'timeout-option-unavailable' : 'requested-timeout-possible');
        else if (row.mode !== 'normal') reasons.push('deadline-before-shared-interval');
        else classification = 'operation-limit';
      }
    }
  }
  if (classification === 'pre-spawn-undetermined') reasons.push('shared-budget-unavailable');
  return { classification, reasons, sharedDeadlineIntervalMs, coincidentOperationPossible };
}

function projectCall(row) {
  const spawn = row.spawn;
  const fields = { callId: typeof row.callId === 'string' && /^\d+-\d+$/.test(row.callId) ? row.callId : null,
    op: safeOperation(row.op), mode: ['normal', 'untilDeadline', 'quality'].includes(row.mode) ? row.mode : null,
    timeoutRequested: typeof row.timeoutRequested === 'boolean' ? row.timeoutRequested : null,
    t0: nullable(row.t0), t1: nullable(row.t1), R: nullable(row.R), Rclamped: row.Rclamped === true,
    hw0: nullable(row.hw0), hw1: nullable(row.hw1), tx: nullable(row.tx),
    spawned: typeof row.spawned === 'boolean' ? row.spawned : null, spawnCount: nullable(row.spawnCount),
    limitKind: kinds.has(row.limitKind) ? row.limitKind : null,
    result: ['returned', 'returned-error', 'threw'].includes(row.result) ? row.result : null,
    reasonPresent: typeof row.reasonPresent === 'boolean' ? row.reasonPresent : null,
    internalTimeoutMs: null,
    timeoutIntervalMs: Array.isArray(row.timeoutIntervalMs) && row.timeoutIntervalMs.length === 2 && row.timeoutIntervalMs.every(finite) ? row.timeoutIntervalMs : null,
    spawn: spawn && typeof spawn === 'object' ? {
      ts: nullable(spawn.ts), te: nullable(spawn.te), D: nullable(spawn.D),
      supervisorPid: nullable(spawn.supervisorPid), supervisorStatus: nullable(spawn.supervisorStatus),
      outcomeKind: kinds.has(spawn.outcomeKind) ? spawn.outcomeKind : spawn.outcomeKind === 'none' ? 'none' : null,
      outcomeStatus: nullable(spawn.outcomeStatus), invalid: typeof spawn.invalid === 'boolean' ? spawn.invalid : null,
    } : null };
  const missingFields = ['t0', 't1', 'R', 'hw0', 'hw1', 'tx'].filter((key) => fields[key] === null);
  if (fields.spawn === null) missingFields.push('spawn');
  else for (const key of ['ts', 'te', 'D', 'outcomeKind']) if (fields.spawn[key] === null) missingFields.push(`spawn.${key}`);
  return { ...fields, missingFields, ...classifyCall(fields) };
}

/** 自由な文字列や元レポートを返さず、到達と選択の不足を区別する。 */
export function summarizeExternalCalls(rows, report, diagnostics = {}) {
  const calls = rows.filter((row) => row && row.event === 'call').slice(0, MAX_RECORDS);
  const lastGh = calls.findLastIndex((row) => safeOperation(row.op).startsWith('gh-'));
  const chosen = calls.filter((row, index) => kinds.has(row.limitKind) || index === lastGh);
  const executed = (Array.isArray(report?.testResults) ? report.testResults : []).flatMap((suite) => Array.isArray(suite?.assertionResults) ? suite.assertionResults : [])
    .filter((test) => ['passed', 'failed'].includes(test?.status));
  const matched = executed.filter((test) => typeof test.fullName === 'string' && test.fullName.includes(selector));
  const spawnCount = calls.reduce((sum, row) => sum + (Number.isSafeInteger(row.spawnCount) && row.spawnCount > 0 ? row.spawnCount : 0), 0);
  return { version: 2, selector: matched.length === 1 && executed.length === 1 ? 'matched' : 'selector-mismatch',
    selectedCount: matched.length, executedCount: executed.length,
    selectedOutcome: matched.length === 1 ? matched[0].status : null,
    reachability: calls.length && spawnCount ? 'observed' : 'unreachable', callCount: calls.length, spawnCount,
    truncated: diagnostics.truncated === true || rows.length > MAX_RECORDS, unreadable: Number.isSafeInteger(diagnostics.unreadable) ? diagnostics.unreadable : 0,
    calls: chosen.map(projectCall), heartbeat: diagnostics.heartbeat ?? null, caveat };
}

/** ファイルごとの上限と総行数を守り、読めない入力の中身を出力しない。 */
function readDiagnosticInputs(directory, reportFile) {
  const rows = []; let unreadable = 0; let truncated = false;
  try {
    const files = readdirSync(directory).filter((file) => /^calls\.\d+\.[a-f0-9-]+\.jsonl$/.test(file)).sort();
    if (files.length > 128) truncated = true;
    for (const file of files.slice(0, 128)) {
      try {
        const path = join(directory, file); const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > LIMIT) { unreadable++; continue; }
        for (const line of readFileSync(path, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          let row; try { row = JSON.parse(line); } catch { unreadable++; continue; }
          if (row?.event === 'truncated') { truncated = true; continue; }
          if (row?.event !== 'call' && row?.event !== 'spawn') { unreadable++; continue; }
          if (rows.length < MAX_RECORDS) rows.push(row); else truncated = true;
        }
      } catch { unreadable++; }
    }
  } catch { unreadable++; }
  let report = {};
  try { if (lstatSync(reportFile).isFile() && lstatSync(reportFile).size <= 4 * 1024 * 1024) report = JSON.parse(readFileSync(reportFile, 'utf8')); else unreadable++; }
  catch { unreadable++; }
  let heartbeat = null;
  try { const file = join(directory, '..', 'heartbeat', 'heartbeat.jsonl'); if (lstatSync(file).isFile() && lstatSync(file).size <= 4 * 1024 * 1024) heartbeat = summarizeHeartbeat(readFileSync(file, 'utf8')); }
  catch { /* 心拍なしはnull。 */ }
  return { rows, report, diagnostics: { unreadable, truncated, heartbeat } };
}

export function collectExternalCalls(directory, reportFile) {
  const { rows, report, diagnostics } = readDiagnosticInputs(directory, reportFile);
  return summarizeExternalCalls(rows, report, diagnostics);
}

export function renderExternalCallSummary(summary) {
  return ['# 外部操作の期限診断', '', summary.caveat, '',
    `選択: ${summary.selector}（対象${summary.selectedCount}件・実行${summary.executedCount}件）`,
    `到達: ${summary.reachability}（call ${summary.callCount}件・spawn ${summary.spawnCount}件）`,
    `診断不足: 読めない行 ${summary.unreadable}件、上限到達 ${summary.truncated}`, '',
    '| call | 操作 | mode | 判定 | 同時上限の可能性 | 入口共有残予算ms | 実deadline | 理由 | 欠損 |', '|---|---|---|---|---|---|---|---|---|',
    ...summary.calls.map((row) => `| ${row.callId ?? '-'} | ${row.op} | ${row.mode ?? '-'} | ${row.classification} | ${row.coincidentOperationPossible ? 'yes' : 'no'} | ${row.R ?? '-'} | ${row.spawn?.D ?? '-'} | ${row.reasons.join(', ')} | ${row.missingFields.join(', ')} |`), '',
    '内部timeoutの厳密値は未取得（null）。観測区間と共有期限区間はsummary.jsonに記録する。',
    '同時上限の可能性がyesなら、1操作上限または明示timeoutが共有期限の窓に重なり得るため、原因を断定しない。',
    '共有期限の窓は、spawn直前までの未観測の遅れの上限（ts−t1−保持役待ち）だけ前へ広げる。窓より前のdeadlineだけを、明示timeoutのないnormalの1操作上限とする。',
    '保存上限：raw診断は各64KiB（最大128ファイル・合計512行）。公開calls/summary JSONは各1MiB、summary.mdは256KiB、heartbeat.jsonは2KiB。', ''].join('\n');
}

const publicCallKeys = ['event', 'callId', 'op', 'mode', 'timeoutRequested', 't0', 't1', 'R', 'Rclamped', 'hw0', 'hw1', 'tx', 'spawned', 'spawnCount', 'limitKind', 'result', 'reasonPresent', 'internalTimeoutMs', 'timeoutIntervalMs', 'spawn', 'missingFields', 'classification', 'reasons', 'sharedDeadlineIntervalMs', 'coincidentOperationPossible'];
const publicSpawnKeys = ['ts', 'te', 'D', 'supervisorStatus', 'outcomeKind', 'outcomeStatus', 'invalid'];
const publicHeartbeatKeys = ['available', 'beats', 'maxGapMs', 'gapsOverThreshold', 'maxTempWriteMs', 'maxRunnerTempWriteMs', 'maxNodeSpawnMs', 'maxGitSpawnMs', 'truncated', 'unreadable'];
const summaryKeys = ['version', 'selector', 'selectedCount', 'executedCount', 'selectedOutcome', 'reachability', 'callCount', 'spawnCount', 'truncated', 'unreadable', 'calls', 'heartbeat', 'caveat'];
const classifications = new Set(['undetermined', 'completed', 'pre-spawn-undetermined', 'pre-spawn-timeout', 'pre-spawn-interrupted', 'missing-result', 'shared-deadline', 'create-shared-deadline', 'operation-limit']);
const reasonCodes = new Set(['shared-deadline-unavailable', 'deadline-unavailable', 'spawn-count-mismatch', 'report-invalid-or-missing', 'outcome-kind-mismatch', 'non-timeout-limit', 'deadline-after-shared-interval', 'shared-budget-unavailable', 'non-limit-error', 'spawn-state-unavailable', 'spawn-start-unavailable', 'mode-unavailable', 'observation-order-invalid', 'timeout-option-unavailable', 'requested-timeout-possible', 'deadline-before-shared-interval']);
const missingCodes = new Set(['t0', 't1', 'R', 'hw0', 'hw1', 'tx', 'spawn', 'spawn.ts', 'spawn.te', 'spawn.D', 'spawn.outcomeKind']);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const nullableNumber = (value) => value === null || finite(value);
const nullableBoolean = (value) => value === null || typeof value === 'boolean';
const intervalOrNull = (value) => value === null || Array.isArray(value) && value.length === 2 && value.every(finite);
const enumOrNull = (value, values) => value === null || values.includes(value);

function publicHeartbeat(value) {
  const available = value !== null && typeof value === 'object';
  const out = { available };
  for (const key of publicHeartbeatKeys.slice(1)) out[key] = key === 'truncated' ? typeof value?.[key] === 'boolean' ? value[key] : null : nullable(value?.[key]);
  return out;
}

function validPublicCall(row) {
  if (!exactKeys(row, publicCallKeys) || row.event !== 'call' || typeof row.callId !== 'string' || !/^call-[1-9]\d{0,2}$/.test(row.callId)
      || safeOperation(row.op) !== row.op || !enumOrNull(row.mode, ['normal', 'untilDeadline', 'quality'])
      || !nullableBoolean(row.timeoutRequested)
      || !['t0', 't1', 'R', 'hw0', 'hw1', 'tx', 'spawnCount'].every((key) => nullableNumber(row[key]))
      || typeof row.Rclamped !== 'boolean' || !nullableBoolean(row.spawned) || !enumOrNull(row.limitKind, [...kinds])
      || !enumOrNull(row.result, ['returned', 'returned-error', 'threw']) || !nullableBoolean(row.reasonPresent) || row.internalTimeoutMs !== null
      || !intervalOrNull(row.timeoutIntervalMs) || !intervalOrNull(row.sharedDeadlineIntervalMs)
      || !classifications.has(row.classification) || typeof row.coincidentOperationPossible !== 'boolean'
      || !Array.isArray(row.reasons) || !row.reasons.every((r) => reasonCodes.has(r))
      || !Array.isArray(row.missingFields) || !row.missingFields.every((r) => missingCodes.has(r))) return false;
  return row.spawn === null || exactKeys(row.spawn, publicSpawnKeys)
    && ['ts', 'te', 'D', 'supervisorStatus', 'outcomeStatus'].every((key) => nullableNumber(row.spawn[key]))
    && enumOrNull(row.spawn.outcomeKind, [...kinds, 'none']) && nullableBoolean(row.spawn.invalid);
}

/** 公開対象の4ファイルだけを閉じたschemaで検査する。未知キーの中身は返さない。 */
export function publicDiagnosticsProblem(payload) {
  if (!exactKeys(payload, ['calls', 'summary', 'heartbeat', 'markdown'])) return 'invalid-payload-keys';
  if (!Array.isArray(payload.calls) || payload.calls.length > MAX_RECORDS || !payload.calls.every(validPublicCall)) return 'invalid-call-schema';
  const summary = payload.summary;
  if (!exactKeys(summary, summaryKeys) || summary.version !== 2 || !['matched', 'selector-mismatch'].includes(summary.selector)
      || !['selectedCount', 'executedCount', 'callCount', 'spawnCount', 'unreadable'].every((key) => Number.isSafeInteger(summary[key]) && summary[key] >= 0)
      || !enumOrNull(summary.selectedOutcome, ['passed', 'failed']) || !['observed', 'unreachable'].includes(summary.reachability)
      || typeof summary.truncated !== 'boolean' || summary.caveat !== caveat || !Array.isArray(summary.calls) || !summary.calls.every(validPublicCall)) return 'invalid-summary-schema';
  if (!exactKeys(payload.heartbeat, publicHeartbeatKeys) || typeof payload.heartbeat.available !== 'boolean' || !nullableBoolean(payload.heartbeat.truncated)
      || !publicHeartbeatKeys.filter((k) => !['available', 'truncated'].includes(k)).every((k) => nullableNumber(payload.heartbeat[k]))) return 'invalid-heartbeat-schema';
  if (JSON.stringify(summary.heartbeat) !== JSON.stringify(payload.heartbeat)) return 'heartbeat-mismatch';
  if (payload.markdown !== renderExternalCallSummary(summary)) return 'markdown-mismatch';
  const allIds = new Set(payload.calls.map((row) => row.callId));
  if (allIds.size !== payload.calls.length || summary.calls.some((row) => !allIds.has(row.callId))) return 'call-id-mismatch';
  if (Buffer.byteLength(JSON.stringify(payload.calls)) > 1024 * 1024 || Buffer.byteLength(JSON.stringify(summary)) > 1024 * 1024
      || Buffer.byteLength(payload.markdown) > 256 * 1024 || Buffer.byteLength(JSON.stringify(payload.heartbeat)) > 2048) return 'payload-limit';
  return null;
}

/** 公開artifact用の再投影。元PID・任意の文字列・レポート本文・preloadは含めない。 */
export function preparePublicDiagnostics(rows, report, diagnostics = {}) {
  const source = rows.filter((row) => row && row.event === 'call').slice(0, MAX_RECORDS);
  const calls = source.map((row, index) => {
    const safe = projectCall(row);
    if (safe.spawn) { const { supervisorPid: omitted, ...spawn } = safe.spawn; void omitted; safe.spawn = spawn; }
    return { event: 'call', ...safe, callId: `call-${index + 1}` };
  });
  const heartbeat = publicHeartbeat(diagnostics.heartbeat);
  const summary = summarizeExternalCalls(rows, report, { ...diagnostics, heartbeat });
  const lastGh = source.findLastIndex((row) => safeOperation(row.op).startsWith('gh-'));
  summary.calls = calls.filter((row, index) => kinds.has(source[index].limitKind) || index === lastGh);
  const payload = { calls, summary, heartbeat, markdown: renderExternalCallSummary(summary) };
  const problem = publicDiagnosticsProblem(payload);
  if (problem) throw new Error(problem);
  return payload;
}

/** 空の専用export先へ、検査済みの固定4ファイルだけを書く。外部送信はしない。 */
export function exportExternalDiagnostics(directory, reportFile, output) {
  const { rows, report, diagnostics } = readDiagnosticInputs(directory, reportFile);
  const payload = preparePublicDiagnostics(rows, report, diagnostics);
  mkdirSync(output, { recursive: true });
  if (readdirSync(output).length !== 0) throw new Error('export-directory-not-empty');
  writeFileSync(join(output, 'calls.jsonl'), payload.calls.map((row) => JSON.stringify(row) + '\n').join(''), { flag: 'wx' });
  writeFileSync(join(output, 'summary.json'), JSON.stringify(payload.summary, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(join(output, 'summary.md'), payload.markdown, { flag: 'wx' });
  writeFileSync(join(output, 'heartbeat.json'), JSON.stringify(payload.heartbeat, null, 2) + '\n', { flag: 'wx' });
  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(process.argv[2] ?? '.loomake/hook-budget/processes');
  const reportFile = resolve(process.argv[3] ?? '.loomake/test-report.json');
  if (process.argv[4] === '--public-export' && process.argv[5]) {
    try {
      const payload = exportExternalDiagnostics(directory, reportFile, resolve(process.argv[5]));
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'export_validated=true\n');
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, payload.markdown);
      process.exitCode = payload.summary.selector === 'matched' ? 0 : 1;
    } catch { console.error('公開用の診断ファイルを作れません。入力・保存先・固定schemaを確認してください。'); process.exitCode = 1; }
  } else {
    const output = join(directory, '..');
    const summary = collectExternalCalls(directory, reportFile);
    try { mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n'); writeFileSync(join(output, 'summary.md'), renderExternalCallSummary(summary)); }
    catch { /* ローカル集計の保存失敗は試験結果を変更しない。 */ }
    process.exitCode = summary.selector === 'matched' ? 0 : 1;
  }
}
