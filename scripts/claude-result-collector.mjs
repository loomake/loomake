import { Buffer } from 'node:buffer';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';
import { createObservedResultFixture, matchesResultCase, validateResultFixture } from './claude-result-fixture.mjs';
import { collectionSafetyStatus, diagnosticEnvironmentSignals, probeCollectionSettings } from './claude-result-preflight.mjs';

export const RESULT_NATIVE_SHA256 = Object.freeze({
  '2.1.307': '1c67968ab8410c9644e2f4867167a0dab1a8c6c9de9cc83fe78449e5ae8a3633',
  '2.1.308': 'fdd22e6cbb734d580f5664c48df4294eeec850218ff07f186f9af30426396ee1',
});
const CASES = ['success', 'error_max_turns'];
const CHILD_ENVIRONMENT = Object.freeze({ DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' });
const BASE_ARGV = ['-p', '--output-format', 'json', '--tools', 'Read', '--disallowedTools', 'mcp__*', '--no-session-persistence'];

/** A proposed invocation is data only; this module does not spawn a real CLI. */
export function resultCollectionPlan(version, resultCase, attempt, environment = process.env) {
  if (!Object.hasOwn(RESULT_NATIVE_SHA256, version) || !CASES.includes(resultCase) || ![1, 2].includes(attempt)) return undefined;
  return {
    version, case: resultCase, attempt, nativeSha256: RESULT_NATIVE_SHA256[version],
    argv: resultCase === 'success' ? [...BASE_ARGV] : [...BASE_ARGV, '--max-turns', '1'],
    prompt: resultCase === 'success' ? 'Reply exactly OK. Do not access files or call tools.' : 'Read note.txt in the current working directory and then report its contents.',
    note: 'Safe fixture note.\n', environment: { ...environment, ...CHILD_ENVIRONMENT },
  };
}

/** Reject changed argv/prompt or any environmental difference beyond the two approved controls. */
export function validResultCollectionPlan(plan, environment) {
  if (!plan || typeof environment !== 'object' || environment === null) return false;
  const expected = resultCollectionPlan(plan.version, plan.case, plan.attempt, environment);
  if (!expected || JSON.stringify(plan.argv) !== JSON.stringify(expected.argv) || plan.prompt !== expected.prompt ||
    plan.note !== expected.note || plan.nativeSha256 !== expected.nativeSha256 || !plan.environment ||
    Object.keys(plan.environment).length !== Object.keys(expected.environment).length) return false;
  return Object.keys(expected.environment).every((key) => plan.environment[key] === expected.environment[key]);
}

/**
 * Always refuses until evidence-backed adapters for every unresolved control are reviewed.
 * @param {{ environment?: NodeJS.ProcessEnv, cwd?: string }} [options]
 */
export async function refuseUnprovedResultCollection({ environment = process.env, cwd } = {}) {
  const settings = await probeCollectionSettings({ environment, cwd });
  return {
    schemaVersion: 1, ...collectionSafetyStatus(settings, environment),
    settings, diagnosticEnvironment: diagnosticEnvironmentSignals(environment),
    conversationInvocations: 0, collectedSlots: 0, requiredSlots: 4,
  };
}

/**
 * Consume an already-created process stream. Tests use fake processes, never real CLI observations.
 * @param {object} child
 * @param {object} metadata
 * @param {{ stdoutLimit?: number, stderrLimit?: number, timeoutMs?: number, killAfterMs?: number, signal?: AbortSignal }} [limits]
 */
export async function inspectResultProcess(child, metadata, { stdoutLimit = 1048576, stderrLimit = 65536, timeoutMs = 300000, killAfterMs = 5000, signal } = {}) {
  const stdout = [];
  let stdoutBytes = 0, stderrBytes = 0, reason, escalation;
  const stop = (code) => {
    if (reason) return;
    reason = code;
    child.kill('SIGTERM');
    escalation = setTimeout(() => child.kill('SIGKILL'), killAfterMs);
    escalation.unref?.();
  };
  const abort = () => stop('interrupted');
  const timer = setTimeout(() => stop('timeout'), timeoutMs);
  const onStdout = (chunk) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes > stdoutLimit) stop('stdout-limit');
    else if (!reason) stdout.push(Buffer.from(chunk));
  };
  const onStderr = (chunk) => {
    stderrBytes += chunk.length;
    if (stderrBytes > stderrLimit) stop('stderr-limit');
  };
  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let exit;
  try {
    exit = await new Promise((resolve) => {
      child.once('error', () => { reason ??= 'spawn-failed'; resolve({ code: null, signal: null }); });
      child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }));
    });
  } finally {
    clearTimeout(timer);
    if (escalation) clearTimeout(escalation);
    signal?.removeEventListener('abort', abort);
    child.stdout.removeListener('data', onStdout);
    child.stderr.removeListener('data', onStderr);
  }
  const refused = (outcome) => ({ outcome, collected: false });
  if (reason) return refused(reason);
  if (exit.code !== 0 || exit.signal !== null) return refused('nonzero-exit');
  const observedMetadata = {
    ...metadata, exit: { ...exit, timedOut: false, stdoutLimitHit: false }, stderrBytes,
  };
  let raw;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(stdout)); }
  catch {
    const fixture = { schemaVersion: 1, provenance: 'observed-metarecord', ...observedMetadata, topLevel: 'invalid-utf8' };
    return validateResultFixture(fixture) ? { ...refused('invalid-utf8'), fixture } : refused('fixture-rejected');
  }
  let value;
  try { value = JSON.parse(raw); } catch { return refused('case-mismatch'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return refused('case-mismatch');
  if (Object.hasOwn(value, 'permission_denials') && (!Array.isArray(value.permission_denials) || value.permission_denials.length !== 0)) return refused('permission-denied');
  const fixture = createObservedResultFixture(raw, observedMetadata);
  if (!fixture || !validateResultFixture(fixture)) return refused('fixture-rejected');
  return matchesResultCase(fixture) ? { outcome: 'case-matched', collected: false, fixture } : refused('case-mismatch');
}

// No evidence-file or collect switch exists: boolean input can never authorize a conversation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await refuseUnprovedResultCollection();
  console.log(JSON.stringify(report));
  process.exitCode = 2;
}
