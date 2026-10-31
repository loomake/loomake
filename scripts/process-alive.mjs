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
