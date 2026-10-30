import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** 試験が観測する子プロセスの状態。exiting は、強制終了が届いたか、アドレス空間を手放して利用者のコードを実行できない終了途中の状態 */
export type ProcessState = 'not-started' | 'missing' | 'zombie' | 'exiting' | 'running';

// SIGKILL（9）が保留中かを示すビット。/proc の SigPnd・ShdPnd は 1 ビット目がシグナル 1 に対応する
const SIGKILL_PENDING = 1n << 8n;

/**
 * PID の状態を調べる。Linux では /proc を読み、SIGKILL が保留中かアドレス空間を手放した終了途中の子を exiting と区別する。
 * CPU が 1 つの環境では、呼び出しが戻った直後に子がまだ do_exit の途中で R のまま見えることがあるため、R だけで running と判定しない。
 * Linux 以外の POSIX では ps の stat で判定する。ゾンビは Z で始まり、終了途中はここでは区別できない
 */
export function processState(pid: number | undefined): ProcessState {
  if (pid === undefined) return 'not-started';
  try { process.kill(pid, 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return 'missing'; throw error; }
  if (process.platform !== 'linux') return psState(pid);
  let status: string;
  try { status = readFileSync(`/proc/${pid}/status`, 'utf8'); }
  catch (error) {
    // 開いた後に対象が消えると、read も ESRCH を返すことがある
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ESRCH') return 'missing';
    throw error;
  }
  if (/^State:\s+[ZX]/m.test(status)) return 'zombie';
  const killPending = [...status.matchAll(/^(?:SigPnd|ShdPnd):\s+([0-9a-f]+)$/gm)].some(([, mask]) => (BigInt(`0x${mask}`) & SIGKILL_PENDING) !== 0n);
  // VmSize は mm を持つプロセスにだけ現れる。exit_mm のあとは利用者のコードを実行できない
  if (killPending || !/^VmSize:/m.test(status)) return 'exiting';
  return 'running';
}

/** ps の stat で判定する。プロセスがなければ ps は何も出力せず 0 以外で終わる */
function psState(pid: number): ProcessState {
  const result = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  if (result.error) throw result.error;
  const stat = result.stdout.trim();
  if (stat === '') return 'missing';
  return stat.startsWith('Z') ? 'zombie' : 'running';
}

/** 試験が起動した子が動いたままなら強制終了する。終了途中・ゾンビ・消滅済みは触らない */
export function killOwnedProcess(pid: number | undefined): void {
  if (processState(pid) !== 'running') return;
  try { process.kill(pid!, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}
