#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { parseTestReport } from './ci-test-diagnostics.mjs';

export const TARGET = 'runから外部操作までの期限 [REQ-182][REQ-297] pushの期限後に先へ進まず、再実行で重複させない';
const TARGET_FILE = 'packages/runner/test/external-budget-deadline.test.ts';
const CONTEXT_LIMIT = 64 * 1024;
const PUBLIC_LIMIT = 4096;
const EVENT_NAMES = ['shim-start', 'forward-start', 'forward-end', 'stall-start', 'delay-start', 'shim-end'];
const REASONS = ['event-shape', 'clock-regression', 'pid-ambiguous', 'pid-unpaired-end', 'pid-unpaired-start', 'no-push-stall', 'multiple-push-stall', 'earlier-stall', 'no-content-diff', 'forward-failed', 'forward-signal', 'forward-error', 'after-stall'];
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const nullableInteger = (v) => v === null || integer(v);
const keys = (v, names) => object(v) && Object.keys(v).sort().join('\0') === [...names].sort().join('\0');
const own = (v, key) => Object.hasOwn(v, key);
const sameCall = (a, b) => a.command === b.command && a.args.length === b.args.length && a.args.every((v, i) => v === b.args[i]);
const isContent = (e) => e.command === 'git' && e.args[0] === 'diff' && e.args[1] === '--cached' && e.args[2] === '-U0';
const isPush = (e) => e.command === 'git' && e.args[0] === 'push';

export function checkSelection(raw) {
  const parsed = parseTestReport(raw);
  const result = (state, executed = 0, targetStatus = null) => ({ state, executed, targetStatus });
  if (parsed.reportState === 'missing') return result('report-missing');
  if (parsed.reportState === 'invalid') return result('report-invalid');
  const executed = parsed.tests.filter((test) => ['passed', 'failed'].includes(test.status));
  if (!executed.length) return result('none');
  if (executed.length !== 1) return result('multiple', executed.length);
  const test = executed[0];
  const path = test.file.replace(/\\/g, '/');
  if (test.fullName !== TARGET || !(path === TARGET_FILE || path.endsWith('/' + TARGET_FILE))) return result('mismatch', 1);
  return result('exact', 1, test.status);
}

export function analyzeOrder(fake) {
  const reasons = new Set();
  const open = new Map();
  const calls = [];
  const stalls = [];
  let previous = -1;
  const rows = Array.isArray(fake) ? fake : [];
  if (!Array.isArray(fake)) reasons.add('event-shape');
  for (const [index, e] of rows.entries()) {
    if (!object(e) || !EVENT_NAMES.includes(e.event) || !integer(e.at) || !Number.isSafeInteger(e.pid) || e.pid <= 0 || typeof e.command !== 'string' || !Array.isArray(e.args) || !e.args.every((v) => typeof v === 'string')) {
      reasons.add('event-shape'); continue;
    }
    if (e.at < previous) reasons.add('clock-regression');
    previous = e.at;
    if (e.event === 'stall-start') stalls.push({ e, index });
    if (e.event === 'shim-start') {
      if (open.has(e.pid)) reasons.add('pid-ambiguous');
      else open.set(e.pid, { e, forward: null, stalled: false, forwarded: false });
      continue;
    }
    const shim = open.get(e.pid);
    if (!shim || !sameCall(shim.e, e)) { reasons.add('pid-unpaired-end'); continue; }
    if (e.event === 'forward-start') {
      if (shim.forward || shim.forwarded || shim.stalled) reasons.add('pid-ambiguous');
      else {
        const call = { start: e, startIndex: index, end: null, endIndex: null };
        shim.forward = call; calls.push(call);
      }
    } else if (e.event === 'forward-end') {
      if (!shim.forward || !sameCall(shim.forward.start, e)) reasons.add('pid-unpaired-end');
      else { shim.forward.end = e; shim.forward.endIndex = index; shim.forward = null; shim.forwarded = true; }
    } else if (e.event === 'shim-end') {
      if (shim.forward) reasons.add('pid-unpaired-start');
      if (shim.stalled || !shim.forwarded || e.code !== 0) reasons.add('pid-unpaired-end');
      open.delete(e.pid);
    } else if (e.event === 'stall-start') {
      if (shim.forward || shim.stalled || !isPush(e)) reasons.add('pid-ambiguous');
      shim.stalled = true;
    } else if (e.event === 'delay-start' && (shim.forward || shim.stalled)) reasons.add('pid-ambiguous');
  }
  const pushStalls = stalls.filter(({ e }) => isPush(e));
  if (!pushStalls.length) reasons.add('no-push-stall');
  if (pushStalls.length > 1) reasons.add('multiple-push-stall');
  const push = pushStalls[0];
  if (push && stalls.some(({ index }) => index < push.index)) reasons.add('earlier-stall');
  for (const shim of open.values()) {
    if (shim.forward || !shim.stalled || !isPush(shim.e) || pushStalls.length !== 1 || shim.e.pid !== push?.e.pid) reasons.add('pid-unpaired-start');
  }
  const content = calls.filter((call) => isContent(call.start));
  if (!content.length) reasons.add('no-content-diff');
  let succeeded = 0;
  let lastEnd = null;
  let lastIndex = null;
  for (const call of content) {
    if (!call.end) { reasons.add('pid-unpaired-start'); continue; }
    const e = call.end;
    if (e.status !== 0) reasons.add('forward-failed');
    if (e.signal != null) reasons.add('forward-signal');
    if (own(e, 'error')) reasons.add('forward-error');
    if (e.status === 0 && e.signal == null && !own(e, 'error')) succeeded++;
    if (!push || call.endIndex >= push.index || e.at > push.e.at) reasons.add('after-stall');
    if (lastIndex === null || call.endIndex > lastIndex) { lastIndex = call.endIndex; lastEnd = e.at; }
  }
  return {
    state: reasons.size ? 'insufficient' : 'confirmed', reasons: REASONS.filter((reason) => reasons.has(reason)),
    eventCount: rows.length, contentDiffCalls: content.length, contentDiffSucceeded: succeeded,
    lastContentDiffEndIndex: lastIndex, pushStallIndex: push?.index ?? null,
    endToStallMs: push && lastEnd !== null && push.e.at >= lastEnd ? push.e.at - lastEnd : null,
  };
}

export function parseContext(bytes) {
  const result = (state) => ({ state, bytes: bytes?.length ?? null, stage: null, code: null, stalledMarker: null, fake: [] });
  if (bytes === undefined) return result('missing');
  if (bytes.length > CONTEXT_LIMIT) return result('oversize');
  if (bytes.length >= CONTEXT_LIMIT - 3) return result('truncated');
  let raw;
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return result('invalid-json'); }
  if (!object(raw) || raw.stage !== 'push' || !Number.isSafeInteger(raw.code) || typeof raw.stalled !== 'boolean' || !Array.isArray(raw.fake)) return result('invalid-shape');
  return { state: 'valid', bytes: bytes.length, stage: 'push', code: raw.code, stalledMarker: raw.stalled, fake: raw.fake };
}

const selectionStates = ['exact', 'none', 'multiple', 'mismatch', 'report-missing', 'report-invalid'];
const contextStates = ['valid', 'missing', 'oversize', 'truncated', 'invalid-json', 'invalid-shape'];
const outcome = (summary) => {
  if (summary.testStep === 'failure' || summary.selection.targetStatus === 'failed') return 'test-failed';
  return summary.selection.state === 'exact' && summary.selection.targetStatus === 'passed' && summary.testStep === 'success' && summary.context.state === 'valid' && summary.context.code === 1 && summary.context.stalledMarker === true && summary.order.state === 'confirmed' ? 'confirmed' : 'insufficient';
};

/** @param {{selection: object, context: object, metadata?: Record<string, unknown>}} input */
export function projectSummary({ selection, context, metadata = {} }) {
  const formatted = (value, pattern, fallback) => typeof value === 'string' && pattern.test(value) ? value : fallback;
  const summary = {
    schemaVersion: 1, kind: 's4-push-order',
    runId: formatted(metadata.runId, /^\d{1,20}$/, '0'), runAttempt: formatted(metadata.runAttempt, /^\d{1,20}$/, '0'),
    checkoutSha: formatted(metadata.checkoutSha, /^[a-f0-9]{40}$/, null),
    os: ['Windows', 'Linux', 'macOS'].includes(metadata.os) ? metadata.os : 'unknown',
    node: formatted(metadata.node, /^v\d{1,3}\.\d{1,3}\.\d{1,3}$/, null),
    testStep: ['success', 'failure'].includes(metadata.testStep) ? metadata.testStep : 'unknown',
    selection: { state: selection.state, executed: selection.executed, targetStatus: selection.targetStatus },
    context: { state: context.state, bytes: context.bytes, stage: context.stage, code: context.code, stalledMarker: context.stalledMarker },
    order: analyzeOrder(context.fake), result: 'insufficient',
  };
  summary.result = outcome(summary);
  return summary;
}

export function validateSummary(v) {
  try {
    if (!keys(v, ['schemaVersion', 'kind', 'runId', 'runAttempt', 'checkoutSha', 'os', 'node', 'testStep', 'selection', 'context', 'order', 'result']) || v.schemaVersion !== 1 || v.kind !== 's4-push-order') return false;
    if (!/^\d{1,20}$/.test(v.runId) || typeof v.runId !== 'string' || !/^\d{1,20}$/.test(v.runAttempt) || typeof v.runAttempt !== 'string') return false;
    if (!(v.checkoutSha === null || typeof v.checkoutSha === 'string' && /^[a-f0-9]{40}$/.test(v.checkoutSha)) || !['Windows', 'Linux', 'macOS', 'unknown'].includes(v.os)) return false;
    if (!(v.node === null || typeof v.node === 'string' && /^v\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v.node)) || !['success', 'failure', 'unknown'].includes(v.testStep)) return false;
    const s = v.selection, c = v.context, o = v.order;
    if (!keys(s, ['state', 'executed', 'targetStatus']) || !selectionStates.includes(s.state) || !integer(s.executed) || ![null, 'passed', 'failed'].includes(s.targetStatus)) return false;
    if (s.state === 'exact' ? s.executed !== 1 || s.targetStatus === null : s.targetStatus !== null) return false;
    if (s.state === 'multiple' && s.executed < 2 || s.state === 'mismatch' && s.executed !== 1 || ['none', 'report-missing', 'report-invalid'].includes(s.state) && s.executed !== 0) return false;
    if (!keys(c, ['state', 'bytes', 'stage', 'code', 'stalledMarker']) || !contextStates.includes(c.state) || !nullableInteger(c.bytes)) return false;
    if (c.state === 'valid' ? c.stage !== 'push' || !Number.isSafeInteger(c.code) || typeof c.stalledMarker !== 'boolean' || !integer(c.bytes) || c.bytes >= CONTEXT_LIMIT - 3 : c.stage !== null || c.code !== null || c.stalledMarker !== null) return false;
    if (c.state === 'missing' && c.bytes !== null || c.state !== 'missing' && c.bytes === null || c.state === 'oversize' && c.bytes <= CONTEXT_LIMIT || c.state === 'truncated' && (c.bytes < CONTEXT_LIMIT - 3 || c.bytes > CONTEXT_LIMIT)) return false;
    if (!keys(o, ['state', 'reasons', 'eventCount', 'contentDiffCalls', 'contentDiffSucceeded', 'lastContentDiffEndIndex', 'pushStallIndex', 'endToStallMs']) || !['confirmed', 'insufficient'].includes(o.state)) return false;
    if (!Array.isArray(o.reasons) || o.reasons.some((r) => !REASONS.includes(r)) || new Set(o.reasons).size !== o.reasons.length || JSON.stringify(o.reasons) !== JSON.stringify(REASONS.filter((r) => o.reasons.includes(r)))) return false;
    if (![o.eventCount, o.contentDiffCalls, o.contentDiffSucceeded].every(integer) || ![o.lastContentDiffEndIndex, o.pushStallIndex, o.endToStallMs].every(nullableInteger)) return false;
    if (o.contentDiffSucceeded > o.contentDiffCalls || o.contentDiffCalls > o.eventCount || [o.lastContentDiffEndIndex, o.pushStallIndex].some((index) => index !== null && index >= o.eventCount)) return false;
    if (o.state === 'confirmed' ? o.reasons.length !== 0 || o.contentDiffCalls < 1 || o.contentDiffSucceeded !== o.contentDiffCalls || o.lastContentDiffEndIndex === null || o.pushStallIndex === null || o.lastContentDiffEndIndex >= o.pushStallIndex || o.endToStallMs === null : o.reasons.length === 0) return false;
    if (!['confirmed', 'test-failed', 'insufficient'].includes(v.result) || v.result !== outcome(v)) return false;
    return Buffer.byteLength(JSON.stringify(v)) <= PUBLIC_LIMIT;
  } catch { return false; }
}

export function renderSummary(v) {
  if (!validateSummary(v)) throw new Error('公開要約が不正です');
  const result = { confirmed: '操作順序を確認', 'test-failed': '元の試験が失敗', insufficient: '証拠が不足' }[v.result];
  // 自由文字列を埋め込まず、固定の文と検証済み数値だけを書く。
  return `## S4 push の操作順序\n\n結果：${result}\n\n実行件数：${v.selection.executed}\n\ncontent diff：${v.order.contentDiffSucceeded} / ${v.order.contentDiffCalls}\n\n最終content diff終了からpush停止まで：${v.order.endToStallMs === null ? '未確認' : v.order.endToStallMs + ' ms'}\n\n不足理由の件数：${v.order.reasons.length}\n\n元の試験・Windows・3 OSの結果は管理役が別に照合します。親changeの完了を示すものではありません。\n`;
}

export function verifyPublicFiles(outputDir) {
  try {
    if (readdirSync(outputDir).sort().join('\0') !== 'summary.json\0summary.md') return false;
    for (const name of ['summary.json', 'summary.md']) {
      const s = lstatSync(join(outputDir, name));
      if (!s.isFile() || s.size > PUBLIC_LIMIT) return false;
    }
    const summary = JSON.parse(readFileSync(join(outputDir, 'summary.json'), 'utf8'));
    return validateSummary(summary) && readFileSync(join(outputDir, 'summary.md'), 'utf8') === renderSummary(summary);
  } catch { return false; }
}

function readBounded(file, limit) {
  if (!existsSync(file)) return undefined;
  const size = statSync(file).size;
  if (size > limit) return null;
  const data = readFileSync(file);
  return data.length > limit ? null : data;
}

/** @param {{cwd?: string, rawDir: string, outputDir: string, reportPath?: string, metadata?: Record<string, unknown>}} options */
export function collectOrder({ cwd = process.cwd(), rawDir, outputDir, reportPath = join(cwd, '.loomake/test-report.json'), metadata = {} }) {
  try {
    const raw = resolve(rawDir), output = resolve(outputDir);
    if (raw === output || !relative(raw, output).startsWith('..') || !relative(output, raw).startsWith('..')) throw new Error('保存先が重なっています');
    mkdirSync(output, { recursive: true });
    if (readdirSync(output).length) throw new Error('公開先は空にしてください');
    const report = readBounded(reportPath, 8 * 1024 * 1024);
    const contextBytes = readBounded(join(raw, 'context.json'), CONTEXT_LIMIT);
    const context = contextBytes === null ? { state: 'oversize', bytes: statSync(join(raw, 'context.json')).size, stage: null, code: null, stalledMarker: null, fake: [] } : parseContext(contextBytes);
    const summary = projectSummary({ selection: checkSelection(report === null ? '{' : report?.toString('utf8')), context, metadata });
    if (!validateSummary(summary)) throw new Error('公開要約が不正です');
    writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(join(output, 'summary.md'), renderSummary(summary), { flag: 'wx' });
    if (!verifyPublicFiles(output)) throw new Error('公開ファイルの照合に失敗しました');
    return { verified: true, exitCode: summary.result === 'confirmed' ? 0 : 1, summary };
  } catch { return { verified: false, exitCode: 2 }; }
  finally {
    for (const file of [join(rawDir, 'context.json'), join(rawDir, 'test-output.log'), reportPath]) {
      try { rmSync(file, { force: true }); } catch { /* always cleanup が固定領域の削除を再試行する。 */ }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
    const result = collectOrder({ rawDir: process.env.S4_ORDER_RAW_DIR, outputDir: process.env.S4_ORDER_OUT_DIR, metadata: {
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, checkoutSha: git.status === 0 ? git.stdout.trim() : null,
      os: process.env.RUNNER_OS, node: process.version, testStep: process.env.S4_TEST_OUTCOME,
    } });
    if (result.verified) {
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'verified=true\n');
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderSummary(result.summary));
    } else process.stderr.write('S4 の公開要約を検証できませんでした。\n');
    process.exitCode = result.exitCode;
  } catch { process.stderr.write('S4 の公開要約を検証できませんでした。\n'); process.exitCode = 2; }
}
