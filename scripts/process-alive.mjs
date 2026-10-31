import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * @typedef {{ platform?: string, kill?: (pid: number, signal: 0) => unknown,
 * readStat?: (pid: number) => string,
 * ps?: (pid: number) => { status: number | null, stdout: string | null | undefined, error?: Error },
 * onProbe?: (entry: Record<string, unknown>) => void }} AliveOptions
 */

/** @param {AliveOptions} [options] */
export function createProcessAlive(options = {}) {
  const { platform = process.platform, kill = (pid, signal) => process.kill(pid, signal),
    readStat = (pid) => readFileSync(`/proc/${pid}/stat`, 'utf8'),
    ps = (pid) => spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }),
  } = options;
  return function alive(pid) {
    try {
      kill(pid, 0);
      if (platform === 'linux') return !/\) Z /.test(readStat(pid));
      if (platform === 'darwin') return !/^Z/.test(ps(pid).stdout.trim());
      return true;
    } catch { return false; }
  };
}
