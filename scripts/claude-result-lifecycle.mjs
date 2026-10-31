import { Buffer } from 'node:buffer';
import { projectResultTransport } from './claude-result-collector.mjs';

const TIMER_MAX_MS = 2147483647;
const LIMITS = Object.freeze({ stdout: 1048576, stderr: 65536, timeoutMs: 300000, killAfterMs: 5000, groupWaitMs: 1000, closeGraceMs: 1000 });
const OPTIONS = Object.freeze({ shell: false, detached: true, stdio: Object.freeze(['pipe', 'pipe', 'pipe']) });
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const EXIT_SIGNALS = new Set(['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGIOT', 'SIGBUS', 'SIGFPE', 'SIGKILL', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGALRM', 'SIGTERM', 'SIGCHLD', 'SIGCONT', 'SIGSTOP', 'SIGTSTP', 'SIGTTIN', 'SIGTTOU', 'SIGURG', 'SIGXCPU', 'SIGXFSZ', 'SIGVTALRM', 'SIGPROF', 'SIGWINCH', 'SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSYS', 'SIGSTKFLT', 'SIGBREAK']);
const errorSink = () => {};
const emitter = (value) => value && typeof value.on === 'function' && typeof value.off === 'function';
const emptyFlags = () => ({ timedOut: false, aborted: false, stdoutLimitHit: false, stderrLimitHit: false });
const early = (outcome) => ({ outcome, collected: false, primary: outcome, exit: null, close: null, flags: emptyFlags(), transport: 'not-started', cleanup: 'not-started' });
const observedExit = (code, signal) => (code === null || Number.isSafeInteger(code) && code >= 0) && (signal === null || EXIT_SIGNALS.has(signal)) ? { code, signal } : null;

/** Synthetic-only transport driver. Every process/clock/signal operation is injected; no live adapter or CLI entry. */
export function driveResultProcess(deps, request) {
  if (!deps || !['spawnChild', 'signalGroup', 'waitGroupExit', 'now'].every((key) => typeof deps[key] === 'function') ||
    typeof deps.timers?.setTimeout !== 'function' || typeof deps.timers?.clearTimeout !== 'function' ||
    typeof deps.parentSignals?.on !== 'function' || typeof deps.parentSignals?.off !== 'function' || typeof deps.platform !== 'string') {
    return Promise.resolve(early('lifecycle-dependency-missing'));
  }
  if (deps.platform === 'win32') return Promise.resolve(early('lifecycle-platform-unsupported'));
  const limits = { ...LIMITS, ...request?.limits };
  if (!request || typeof request.input !== 'string' || !request.metadata || typeof request.metadata !== 'object' ||
    Object.keys(limits).some((key) => !Object.hasOwn(LIMITS, key) || !Number.isSafeInteger(limits[key]) || limits[key] <= 0 || limits[key] > TIMER_MAX_MS) ||
    limits.killAfterMs + limits.groupWaitMs + limits.closeGraceMs > TIMER_MAX_MS) {
    return Promise.resolve(early('lifecycle-request-invalid'));
  }
  if (request.signal && (typeof request.signal.addEventListener !== 'function' || typeof request.signal.removeEventListener !== 'function')) {
    return Promise.resolve(early('lifecycle-request-invalid'));
  }
  return new Promise((resolve) => {
    let child, pgid, primary = null, exit = null, close = null;
    let transport = 'not-started', cleanup = 'not-started';
    let settled = false, tearingDown = false, cleanupDone = false, groupFailed = false;
    let executionTimer, closeTimer, waitTimer;
    let stdout = [], stdoutBytes = 0, stderrBytes = 0;
    const flags = emptyFlags(), pending = new Set(), bindings = [];
    const now = () => { try { const value = deps.now(); return Number.isFinite(value) ? value : null; } catch { return null; } };
    const cancel = (timer) => {
      if (timer === undefined) return;
      deps.timers.clearTimeout(timer); pending.delete(timer);
    };
    const schedule = (callback, delay) => {
      let timer;
      timer = deps.timers.setTimeout(() => { pending.delete(timer); if (!settled) callback(); }, Math.max(0, delay));
      pending.add(timer); return timer;
    };
    const bind = (target, name, fn) => { target.on(name, fn); bindings.push([target, name, fn]); };
    const absorb = (target) => { if (emitter(target)) target.on('error', errorSink); };
    const finalize = () => {
      if (settled) return;
      settled = true;
      for (const timer of [...pending]) cancel(timer);
      for (const name of SIGNALS) deps.parentSignals.off(name, interrupted);
      request.signal?.removeEventListener('abort', interrupted);
      for (const stream of [child?.stdin, child?.stdout, child?.stderr, child]) absorb(stream);
      for (const [target, name, fn] of bindings) target.off(name, fn);
      for (const stream of [child?.stdin, child?.stdout, child?.stderr]) { try { stream?.destroy(); } catch { /* Never expose a teardown exception message. */ } }
      let outcome = primary ?? (cleanup === 'cleanup-unproved' ? cleanup : transport === 'close-timeout' ? transport : !exit ? 'exit-unobserved' : null);
      if (!outcome && (!close || exit.code !== close.code || exit.signal !== close.signal)) outcome = 'exit-close-mismatch';
      const base = { outcome, collected: false, primary, exit, close, flags: { ...flags }, transport, cleanup };
      if (!outcome && transport === 'closed' && ['group-exited', 'group-absent'].includes(cleanup)) {
        resolve({ ...base, ...projectResultTransport({ stdout, stderrBytes, exit, metadata: request.metadata }) });
      } else resolve(base);
      stdout = [];
    };
    const finishIfReady = () => {
      if (!cleanupDone || settled) return;
      if (close) { transport = 'closed'; finalize(); return; }
      if (closeTimer === undefined) closeTimer = schedule(() => { transport = 'close-timeout'; finalize(); }, limits.closeGraceMs);
    };
    const cleanupFinished = (status) => {
      if (settled || cleanupDone) return;
      cancel(waitTimer); cleanup = status; cleanupDone = true; finishIfReady();
    };
    const signalGroup = (signal) => {
      try {
        const status = deps.signalGroup(pgid, signal);
        if (!['sent', 'absent', 'failed'].includes(status)) { groupFailed = true; return 'failed'; }
        if (status === 'failed') groupFailed = true;
        return status;
      } catch { groupFailed = true; return 'failed'; }
    };
    const waitForCleanup = () => {
      const start = now();
      if (start === null) { cleanupFinished('cleanup-unproved'); return; }
      const deadline = start + limits.groupWaitMs;
      const watch = () => {
        const time = now();
        if (time === null || time >= deadline) cleanupFinished('cleanup-unproved');
        else waitTimer = schedule(watch, deadline - time);
      };
      waitTimer = schedule(watch, limits.groupWaitMs);
      Promise.resolve().then(() => deps.waitGroupExit(pgid, { timeoutMs: limits.groupWaitMs })).then((value) => {
        const time = now();
        cleanupFinished(value === true && !groupFailed && time !== null && time < deadline ? 'group-exited' : 'cleanup-unproved');
      }, () => cleanupFinished('cleanup-unproved'));
    };
    const teardownOnce = () => {
      if (settled || tearingDown || pgid === undefined) return;
      tearingDown = true; cancel(executionTimer);
      // Driver-owned outer watchdog also bounds rejecting or never-resolving cleanup dependencies.
      schedule(() => {
        if (!cleanupDone) { cleanup = 'cleanup-unproved'; cleanupDone = true; }
        transport = close ? 'closed' : 'close-timeout'; finalize();
      }, limits.killAfterMs + limits.groupWaitMs + limits.closeGraceMs);
      if (signalGroup('SIGTERM') === 'absent') { cleanupFinished('group-absent'); return; }
      schedule(() => { signalGroup('SIGKILL'); waitForCleanup(); }, limits.killAfterMs);
    };
    const stop = (reason) => {
      if (settled) return;
      primary ??= reason; stdout = [];
      teardownOnce();
    };
    function interrupted() { if (settled) return; flags.aborted = true; stop('interrupted'); }
    for (const name of SIGNALS) deps.parentSignals.on(name, interrupted);
    request.signal?.addEventListener('abort', interrupted);
    if (request.signal?.aborted || primary) { flags.aborted = true; primary = 'interrupted'; finalize(); return; }
    const start = now();
    if (start === null) { primary = 'lifecycle-clock-invalid'; finalize(); return; }
    try { child = deps.spawnChild(OPTIONS); }
    catch { primary = 'spawn-failed'; finalize(); return; }
    if (!emitter(child) || !Number.isSafeInteger(child.pid) || child.pid <= 1 || child.pid === process.pid ||
      ![child.stdin, child.stdout, child.stderr].every((stream) => emitter(stream) && typeof stream.destroy === 'function') || typeof child.stdin.end !== 'function') {
      primary = 'spawn-failed'; finalize(); return;
    }
    pgid = child.pid; transport = 'not-started';
    const observe = (kind, code, signal) => {
      const value = observedExit(code, signal);
      if (!value) { stop('lifecycle-event-invalid'); return; }
      if (kind === 'exit') { exit ??= value; cancel(executionTimer); }
      else close ??= value;
      teardownOnce(); finishIfReady();
    };
    bind(child, 'exit', (code, signal) => observe('exit', code, signal));
    bind(child, 'close', (code, signal) => observe('close', code, signal));
    for (const [name, stream] of [['stdin', child.stdin], ['stdout', child.stdout], ['stderr', child.stderr], ['child', child]]) {
      bind(stream, 'error', () => stop(`${name}-error`));
    }
    bind(child.stdout, 'data', (data) => {
      if (settled) return;
      let bytes;
      try { bytes = Buffer.from(data); } catch { stop('stdout-error'); return; }
      stdoutBytes = Math.min(limits.stdout + 1, stdoutBytes + bytes.length);
      if (stdoutBytes > limits.stdout) { flags.stdoutLimitHit = true; stop('stdout-limit'); }
      else if (!primary) stdout.push(bytes);
    });
    bind(child.stderr, 'data', (data) => {
      if (settled) return;
      try { stderrBytes = Math.min(limits.stderr + 1, stderrBytes + Buffer.byteLength(data)); }
      catch { stop('stderr-error'); return; }
      if (stderrBytes > limits.stderr) { flags.stderrLimitHit = true; stop('stderr-limit'); }
    });
    const deadline = start + limits.timeoutMs;
    const watchDeadline = () => {
      const time = now();
      if (time === null) { stop('lifecycle-clock-invalid'); return; }
      const left = deadline - time;
      if (!(left > 0)) { flags.timedOut = true; stop('timeout'); }
      else executionTimer = schedule(watchDeadline, Math.min(left, 2147483647));
    };
    if (primary) teardownOnce();
    else {
      watchDeadline();
      if (!primary) { try { child.stdin.end(request.input); } catch { stop('stdin-error'); } }
    }
  });
}
