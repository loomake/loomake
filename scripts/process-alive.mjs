import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * @typedef {{ platform?: string, kill?: (pid: number, signal: 0) => unknown,
 * readStat?: (pid: number) => string,
 * ps?: (pid: number) => { status: number | null, stdout: string | null | undefined, error?: Error },
 * onProbe?: (entry: Record<string, unknown>) => void }} AliveOptions
 */

/** 観測できない PID を停止済みとせず、smoke を失敗させる。 @param {AliveOptions} [options] */
export function createProcessAlive(options = {}) {
  const { platform = process.platform, kill = (pid, signal) => process.kill(pid, signal),
    readStat = (pid) => readFileSync(`/proc/${pid}/stat`, 'utf8'),
    ps = (pid) => spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', timeout: 1000, maxBuffer: 8192, killSignal: 'SIGKILL' }),
    onProbe = () => {},
  } = options;
  const record = (pid, source, details) => onProbe({ time: Date.now(), pid, source, ...details });
  function exists(pid, source) {
    try { kill(pid, 0); }
    catch (error) {
      record(pid, source, { result: error.code === 'ESRCH' ? 'missing' : 'error', code: error.code });
      if (error.code === 'ESRCH') return false;
      throw error;
    }
    record(pid, source, { result: 'present' });
    return true;
  }
  return function alive(pid) {
    if (!exists(pid, 'kill')) return false;
    if (platform === 'linux') {
      let stat;
      try { stat = readStat(pid); }
      catch (error) {
        record(pid, 'proc-stat', { result: error.code === 'ENOENT' ? 'missing' : 'error', code: error.code });
        if (error.code === 'ENOENT') return false;
        if (error.code === 'ESRCH' && !exists(pid, 'kill-recheck')) return false;
        throw error;
      }
      const zombie = /\) Z /.test(stat);
      record(pid, 'proc-stat', { result: zombie ? 'zombie' : 'running', raw: stat });
      return !zombie;
    }
    if (platform === 'darwin') {
      const result = ps(pid);
      record(pid, 'ps', { status: result.status, raw: result.stdout, code: result.error?.code });
      if (result.error) throw result.error;
      if (![0, 1].includes(result.status) || typeof result.stdout !== 'string') throw new Error(`PID ${pid} の ps の結果を確認できません`);
      const stat = result.stdout.trim();
      // kill と ps の間に zombie が回収される競合を、もう一度の kill で区別する。
      if (stat === '') return exists(pid, 'kill-recheck');
      if (result.status !== 0) throw new Error(`PID ${pid} の ps が異常終了しました：${result.status}`);
      return !/^Z/.test(stat);
    }
    return true;
  };
}

/**
 * ready と失敗直前の identity を、同じ追跡 PID について最大 2 時点で記録する。
 * @param {{ pids: () => number[], platform?: string, readStat?: (pid: number) => string,
 * ps?: (pid: number) => { status: number | null, stdout: string | null | undefined, error?: Error } }} options
 */
export function createProcessIdentityRecorder(options) {
  const { pids, platform = process.platform, readStat = (pid) => readFileSync(`/proc/${pid}/stat`, 'utf8'),
    ps = (pid) => spawnSync('ps', ['-ww', '-o', 'ppid=,pgid=,stat=,lstart=,command=', '-p', String(pid)], {
      encoding: 'utf8', timeout: 1000, maxBuffer: 8192, killSignal: 'SIGKILL', env: { ...process.env, LC_ALL: 'C' },
    }),
  } = options;
  const identities = [];
  const phases = new Set();
  let tracked;
  function capture(phase) {
    if (!['ready', 'failure'].includes(phase) || phases.has(phase)) return;
    phases.add(phase);
    tracked ??= pids().filter((pid) => Number.isInteger(pid) && pid > 1).slice(0, 2);
    for (const pid of tracked) {
      const identity = { time: Date.now(), pid, phase };
      try {
        if (platform === 'linux') {
          const raw = readStat(pid);
          const end = raw.lastIndexOf(')');
          const fields = raw.slice(end + 2).trim().split(/\s+/);
          if (end < 0 || fields.length < 20) throw new Error('proc の identity を確認できません');
          Object.assign(identity, { command: raw.slice(raw.indexOf('(') + 1, end), stat: fields[0], ppid: fields[1], pgid: fields[2], starttime: fields[19] });
        } else {
          const result = ps(pid);
          Object.assign(identity, { status: result.status, raw: result.stdout });
          if (result.error) throw result.error;
          if (result.status !== 0 || typeof result.stdout !== 'string') throw new Error('ps の identity を確認できません');
          const match = result.stdout.trimEnd().match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/);
          if (!match) throw new Error('ps の identity を確認できません');
          Object.assign(identity, { ppid: match[1], pgid: match[2], stat: match[3], lstart: match[4], command: match[5] });
        }
      } catch (error) { Object.assign(identity, { error: String(error?.code ?? error?.message ?? error) }); }
      for (const [key, value] of Object.entries(identity)) {
        if (typeof value === 'string' && value.length > 4096) {
          identity[key] = value.slice(0, 4096);
          identity[`${key}Truncated`] = true;
        }
      }
      identities.push(identity);
    }
  }
  return { identities, capture };
}
