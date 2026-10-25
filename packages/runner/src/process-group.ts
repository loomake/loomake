import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

/** 後処理の待機の上限。SIGKILL を受けた子は普通はすぐに終了処理を終えるが、カーネル内で待ち続ける子で run 全体を止めないための上限 */
export const GROUP_EXIT_TIMEOUT_MS = 1000;

/**
 * 同じプロセスグループで、まだ終了処理を終えていないメンバーの PID を返す（REQ-212）。
 * ゾンビは利用者のコードを実行できず、親が回収するまで残るだけなので数えない。
 * Linux は /proc を読み、ほかの POSIX は ps の stat を見る。どちらも読めなければ、グループへのシグナル 0 で存否だけを見る
 */
export function activeGroupMembers(pgid: number, platform: NodeJS.Platform = process.platform): number[] {
  const members = platform === 'linux' ? procMembers(pgid) : psMembers(pgid);
  if (members !== undefined) return members;
  try {
    process.kill(-pgid, 0);
    return [pgid];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return [];
    return [pgid];
  }
}

/** /proc/<pid>/stat の「) 」より後ろは、状態・親 PID・プロセスグループの順に並ぶ */
function procMembers(pgid: number): number[] | undefined {
  let entries: string[];
  try { entries = readdirSync('/proc'); } catch { return undefined; }
  const members: number[] = [];
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    let stat: string;
    try { stat = readFileSync(`/proc/${name}/stat`, 'utf8'); } catch { continue; }
    const [state, , group] = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (Number(group) !== pgid || state === 'Z' || state === 'X') continue;
    members.push(Number(name));
  }
  return members;
}

/** ps の pid・pgid・stat の列を読む。stat の先頭文字は Linux と macOS で同じ意味を持つ */
function psMembers(pgid: number): number[] | undefined {
  const result = spawnSync('ps', ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) return undefined;
  const members: number[] = [];
  for (const line of result.stdout.split('\n')) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 3) continue;
    const [pid, group, stat] = columns;
    if (Number(group) !== pgid || stat.startsWith('Z')) continue;
    members.push(Number(pid));
  }
  return members;
}

/**
 * 同じプロセスグループのメンバーがすべて終了処理を終える（消滅かゾンビになる）まで待つ。
 * 上限までに終わらなければ false を返す
 */
export async function waitForGroupExit(pgid: number, options: { timeoutMs?: number; intervalMs?: number; platform?: NodeJS.Platform } = {}): Promise<boolean> {
  const { timeoutMs = GROUP_EXIT_TIMEOUT_MS, intervalMs = 10, platform } = options;
  const deadline = Date.now() + timeoutMs;
  while (activeGroupMembers(pgid, platform).length > 0) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return true;
}
