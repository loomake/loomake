import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { spawnSync } from 'node:child_process';
import { types as utilTypes } from 'node:util';
import { UsageError } from '../../kit/src/runtime/errors.js';

const LIMIT = 64 * 1024;
const RESERVE = 160;
const CASE_LABELS = new Set(['publication-retry', 'shared-first-run', 'create-before', 'create-after', 'push-retry', 'repeat', 'new-source', 'json', 'sha', 'change', 'failed', 'fail-result', 'hash', 'snapshot', 'legacy', 'lookup-fail', 'lookup-invalid', 'verify-fail', 'verify-head', 'verify-branch', 'verify-dirty', 'lookup-broken-json', 'lookup-object', 'lookup-bad-url', 'lookup-credentials', 'lookup-wrong-head', 'lookup-cross-repo', 'lookup-multiple']);
const PHASES = new Set(['case-start', 'repo-ready', 'run-start', 'run-end', 'mutate-end', 'amend-end', 'cleanup-start', 'cleanup-end', 'case-end']);
type Phase = 'case-start' | 'repo-ready' | 'run-start' | 'run-end' | 'mutate-end' | 'amend-end' | 'cleanup-start' | 'cleanup-end' | 'case-end';
type Details = { n?: number; code?: number; expectedReason?: boolean; completed?: boolean };

/** 完全な行と上限到達の印を残す。診断の失敗で元の試験を変えない。 */
function appendBounded(file: string, row: object) {
  try {
    const used = existsSync(file) ? statSync(file).size : 0;
    if (used > LIMIT - RESERVE) return false;
    const line = JSON.stringify(row) + '\n';
    if (used + Buffer.byteLength(line) <= LIMIT - RESERVE) { appendFileSync(file, line); return true; }
    appendFileSync(file, JSON.stringify({ event: 'truncated', at: Date.now(), pid: process.pid }) + '\n');
  } catch { /* 計測不足として扱い、元の処理へ例外を返さない。 */ }
  return false;
}

/** case開始時に閉包を作る。並行して残ったcallbackも別caseへ混ざらない。 */
export function createCaseDiagnostics(kind = 'publication-retry') {
  const label = CASE_LABELS.has(kind) ? kind : 'publication-retry';
  const configured = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  const directory = configured ? resolve(configured) : undefined;
  const id = `publication-retry-${process.pid}-${randomUUID()}`;
  let repo: string | undefined;
  let terminal = false;
  return {
    bind(base: string) {
      const name = basename(base);
      if (/^loomake-run-[a-zA-Z0-9_-]{1,80}$/.test(name)) repo = name;
    },
    event(event: Phase, details: Details = {}) {
      if (!directory || terminal || !PHASES.has(event)) return;
      try {
        mkdirSync(directory, { recursive: true });
        const safe: Details = {};
        for (const key of ['n', 'code'] as const) if (Number.isSafeInteger(details[key])) safe[key] = details[key];
        for (const key of ['expectedReason', 'completed'] as const) if (typeof details[key] === 'boolean') safe[key] = details[key];
        terminal = !appendBounded(join(directory, `${id}.phases.jsonl`), { event, at: Date.now(), pid: process.pid, id, label, ...(repo ? { repo } : {}), ...safe });
      } catch { /* 保存先が使えなくても元の処理を続ける。 */ }
    },
  };
}

/** 任意のローカル診断。生の引数・出力・環境値は記録しない。 */
export function attachProcessDiagnostics(base: string, env: NodeJS.ProcessEnv) {
  const configured = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  const directory = configured ? resolve(configured) : undefined;
  if (!directory) return;
  try {
    const repo = basename(base);
    if (!/^loomake-run-[a-zA-Z0-9_-]{1,80}$/.test(repo)) return;
    mkdirSync(directory, { recursive: true });
    const preload = join(base, 'process-diagnostics.cjs');
    writeFileSync(preload, `try {
      const fs = require('node:fs');
      const path = require('node:path');
      const name = path.basename(process.argv[1] || '');
      const supervisor = name === 'supervisor.cjs';
      const fake = name === 'claude' || name === 'gh';
      if (supervisor || fake) {
        const session = require('node:crypto').randomUUID();
        const operations = new Set(['status', 'show', 'diff', 'rev-parse', 'check-ignore', 'switch', 'add', 'commit', 'push', 'init', 'remote', 'config', 'list', 'create', 'auth', 'pr']);
        let operation = fake ? name : 'other';
        let deadline;
        if (supervisor) {
          const [target, args, , observedDeadline] = JSON.parse(process.argv[2]);
          if (typeof observedDeadline === 'number' && Number.isFinite(observedDeadline)) deadline = observedDeadline;
          const command = path.basename(String(target)).replace(/\\.exe$/i, '');
          if (['git', 'gh', 'node', 'cmd', 'sh', 'bash', 'powershell'].includes(command)) operation = command;
          const unquote = value => String(value).replace(/^"(.*)"$/, '$1');
          const first = unquote(args[0]);
          const second = unquote(args[1]);
          if ((command === 'git' || command === 'gh') && operations.has(first)) operation += '-' + first;
          if (command === 'gh' && operations.has(first) && operations.has(second)) operation += '-' + second;
        } else if (name === 'gh') {
          if (operations.has(process.argv[2])) operation += '-' + process.argv[2];
          if (operations.has(process.argv[3])) operation += '-' + process.argv[3];
        }
        const file = path.join(${JSON.stringify(directory)}, ${JSON.stringify(repo)} + '.' + process.pid + '.' + session + '.processes.jsonl');
        let terminal = false;
        const event = (event, code) => {
          if (terminal) return;
          try {
            const used = fs.existsSync(file) ? fs.statSync(file).size : 0;
            if (used > ${LIMIT - RESERVE}) { terminal = true; return; }
            const row = { event, at: Date.now(), pid: process.pid, session, repo: ${JSON.stringify(repo)}, operation };
            if (Number.isSafeInteger(code)) row.code = code;
            if (supervisor && deadline !== undefined) {
              const remainingMs = deadline - Number(process.hrtime.bigint()) / 1000000;
              if (Number.isFinite(remainingMs)) row.remainingMs = remainingMs;
            }
            const line = JSON.stringify(row) + '\\n';
            if (used + Buffer.byteLength(line) <= ${LIMIT - RESERVE}) fs.appendFileSync(file, line);
            else {
              terminal = true;
              fs.appendFileSync(file, JSON.stringify({ event: 'truncated', at: Date.now(), pid: process.pid, session }) + '\\n');
            }
          } catch { terminal = true; /* 診断だけを欠損させる。 */ }
        };
        event(supervisor ? 'supervisor-entry' : 'fake-cli-entry');
        process.on('exit', code => event(supervisor ? 'supervisor-exit' : 'fake-cli-exit', code));
      }
    } catch { /* preloadの診断失敗を対象プロセスへ返さない。 */ }\n`);
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preload)}`.trim();
  } catch { /* 診断の準備失敗で元の試験を止めない。 */ }
}


type ProcessRuntime = Pick<typeof import('../../kit/src/runtime/process.js'), 'runExternal' | 'readReport' | 'remainingProcessTime' | 'holderWaitTime' | 'ProcessLimitError'>;
type SpawnObservation = {
  ts: number | null; te: number | null; D: number | null; hold: 'pipe' | 'unavailable' | null;
  supervisorPid: number | null; supervisorStatus: number | null; spawnErrorCode: string | null;
  outcomeKind: string | null; outcomeStatus: number | null; spawning: boolean | null;
  protection: string | null; unprotectedCode: string | null; invalid: boolean;
};
type ActiveCall = { callId: string; spawns: SpawnObservation[]; readReport: ProcessRuntime['readReport'] };
let currentCall: ActiveCall | undefined;
let readSupervisorReport: ProcessRuntime['readReport'] | undefined;
let sequence = 0;
const writers = new Map<string, { file: string; terminal: boolean }>();
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = (value: unknown): number | null => Number.isSafeInteger(value) ? value as number : null;
const mono = () => Number(process.hrtime.bigint()) / 1_000_000;
const operations = new Set(['status', 'show', 'diff', 'rev-parse', 'check-ignore', 'switch', 'add', 'commit', 'push', 'init', 'remote', 'config', 'list', 'create', 'auth', 'pr']);
const limitKinds = new Set(['timeout', 'output', 'interrupted']);
const unprotectedCodes = new Set(['no-holder', 'holder-spawn', 'holder-not-ready', 'holder-exited', 'connect', 'connect-timeout', 'no-reply', 'invalid-reply', 'disconnected', 'exited-first']);

function writeCall(row: object): void {
  const configured = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  if (!configured) return;
  try {
    const directory = resolve(configured);
    let writer = writers.get(directory);
    if (!writer) {
      mkdirSync(directory, { recursive: true });
      writer = { file: join(directory, `calls.${process.pid}.${randomUUID()}.jsonl`), terminal: false };
      writers.set(directory, writer);
    }
    if (!writer.terminal) writer.terminal = !appendBounded(writer.file, row);
  } catch { /* 観測を欠損させ、元の結果は変えない。 */ }
}

function operation(command: string, args: readonly string[]): string {
  const name = basename(command).replace(/\.exe$/i, '').toLowerCase();
  if (!['git', 'gh', 'claude', 'openspec'].includes(name)) return 'other';
  const unquote = (value: string | undefined) => String(value ?? '').replace(/^"(.*)"$/, '$1');
  const first = unquote(args[0]); const second = unquote(args[1]);
  return name + ((name === 'git' || name === 'gh') && operations.has(first) ? '-' + first : '')
    + (name === 'gh' && operations.has(first) && operations.has(second) ? '-' + second : '');
}

/** getterやProxyを追加評価せず、明示timeoutの有無だけを観測する。 */
function timeoutRequested(options: Parameters<ProcessRuntime['runExternal']>[2]): boolean | null {
  if (options == null) return false;
  if (utilTypes.isProxy(options)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(options, 'timeoutMs');
  if (descriptor) return 'value' in descriptor ? descriptor.value !== undefined && descriptor.value !== null : null;
  const prototype = Object.getPrototypeOf(options);
  return prototype === null || prototype === Object.prototype && !Object.hasOwn(prototype, 'timeoutMs') ? false : null;
}

/** 試験専用。元関数の引数・返値・例外をそのまま通し、許可した観測値だけを残す。 */
export function observeRunExternal(real: ProcessRuntime): ProcessRuntime['runExternal'] {
  readSupervisorReport = real.readReport;
  return (...args) => {
    if (!process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR) return real.runExternal(...args);
    let start: { t0: number; R: number | null; t1: number; hw0: number };
    try {
      const t0 = mono(); const R = finite(real.remainingProcessTime()); const t1 = mono();
      start = { t0, R, t1, hw0: real.holderWaitTime() };
    } catch { return real.runExternal(...args); }
    const previous = currentCall;
    const seq = ++sequence;
    const call: ActiveCall = { callId: `${process.pid}-${seq}`, spawns: [], readReport: real.readReport };
    currentCall = call;
    let returned: ReturnType<ProcessRuntime['runExternal']> | undefined;
    let thrown: unknown; let didThrow = false;
    try { returned = real.runExternal(...args); return returned; }
    catch (error) { thrown = error; didThrow = true; throw error; }
    finally {
      currentCall = previous;
      try {
        const options = args[2];
        const tx = mono(); const hw1 = finite(real.holderWaitTime());
        const spawn = call.spawns.length === 1 ? call.spawns[0] : null;
        const error = thrown instanceof real.ProcessLimitError ? thrown : undefined;
        const repo = options?.cwd ? basename(resolve(options.cwd, '..')) : '';
        writeCall({ event: 'call', at: Date.now(), pid: process.pid, seq, callId: call.callId,
          ...(/^loomake-run-[a-zA-Z0-9_-]{1,80}$/.test(repo) ? { repo } : {}),
          timeoutRequested: timeoutRequested(options),
          op: operation(args[0], args[1]), mode: options?.qualityCommand ? 'quality' : options?.untilDeadline ? 'untilDeadline' : 'normal',
          ...start, hw0: finite(start.hw0), hw1, tx: finite(tx), Rclamped: start.R === 0,
          spawned: call.spawns.length > 0, spawnCount: call.spawns.length, spawn,
          result: didThrow ? 'threw' : returned?.error ? 'returned-error' : 'returned',
          status: integer(returned?.status),
          ...(didThrow ? { errorClass: error ? 'ProcessLimitError' : thrown instanceof UsageError ? 'UsageError' : 'other' } : {}),
          ...(error ? { limitKind: limitKinds.has(error.kind) ? error.kind : null, reasonPresent: typeof error.reason === 'string', cleanupConfirmed: error.cleanup?.confirmed ?? null } : {}),
          internalTimeoutMs: null,
          timeoutIntervalMs: spawn?.D !== null && spawn?.D !== undefined && spawn.ts !== null
            ? [finite(spawn.D - spawn.ts), finite(spawn.D - start.t1)] : null,
        });
      } catch { /* 診断失敗は元の返値やthrowに影響させない。 */ }
    }
  };
}

/** supervisorの起動を同じ引数で一度だけ通す。Bufferや生引数は保持しない。 */
export function observeSpawnSync(cp: Pick<typeof import('node:child_process'), 'spawnSync'>): typeof spawnSync {
  return ((...args: Parameters<typeof spawnSync>) => {
    const command = args[0]; const argv = args[1];
    if (!process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR || command !== process.execPath || !Array.isArray(argv) || !argv[0]?.endsWith('supervisor.cjs')) {
      return cp.spawnSync(...args);
    }
    let ts: number | null = null; let te: number | null = null;
    try { ts = finite(mono()); } catch { /* 観測時計の不足でも元spawnを呼ぶ。 */ }
    const result = cp.spawnSync(...args);
    try { te = finite(mono()); } catch { /* 返値はそのまま通す。 */ }
    try {
      let D: number | null = null; let hold: SpawnObservation['hold'] = null;
      try {
        const input = JSON.parse(argv[1]) as unknown[];
        D = finite(input[3]);
        const value = input[5];
        if (value && typeof value === 'object') hold = 'pipe' in value ? 'pipe' : 'unavailable' in value ? 'unavailable' : null;
      } catch { /* 引数は保存せず、欠損として示す。 */ }
      const bytes = result.output?.[3];
      const reader = currentCall?.readReport ?? readSupervisorReport;
      const report = reader && bytes && Buffer.byteLength(bytes) <= LIMIT ? reader(bytes.toString()) : undefined;
      const kind = report?.outcome?.kind;
      const unprotected = report?.target.unprotected;
      const spawnCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
      const row: SpawnObservation = { ts: finite(ts), te: finite(te), D, hold,
        supervisorPid: integer(result.pid), supervisorStatus: integer(result.status),
        spawnErrorCode: result.error ? ['ENOBUFS', 'ENOENT', 'ETIMEDOUT'].includes(String(spawnCode)) ? String(spawnCode) : 'other' : null,
        outcomeKind: kind && limitKinds.has(kind) ? kind : report?.outcome ? 'none' : null,
        outcomeStatus: integer(report?.outcome?.status), spawning: report?.target.spawning ?? null,
        protection: report?.target.created ? 'created' : unprotected ? 'unprotected' : null,
        unprotectedCode: unprotected ? unprotectedCodes.has(unprotected) ? unprotected : 'other' : null,
        invalid: !report || report.invalid,
      };
      if (currentCall) currentCall.spawns.push(row);
      else writeCall({ event: 'spawn', at: Date.now(), pid: process.pid, callId: null, spawn: row });
    } catch { /* 元のspawn結果を返し、観測だけを欠損させる。 */ }
    return result;
  }) as typeof spawnSync;
}
