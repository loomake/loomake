import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

/** 後処理の待機の上限。SIGKILL を受けた子は普通はすぐに終了処理を終えるが、カーネル内で待ち続ける子で run 全体を止めないための上限 */
export const GROUP_EXIT_TIMEOUT_MS = 1000;

/** グループの確認の設定。timeoutMs は ps を待つ上限（後処理の残り時間）、psCommand はテストで ps を差し替えるためのコマンド */
export interface GroupCheckOptions {
  timeoutMs?: number;
  psCommand?: string;
}

/**
 * 同じプロセスグループで、まだ終了処理を終えていないメンバーの PID を返す（REQ-212）。
 * ゾンビは利用者のコードを実行できず、親が回収するまで残るだけなので数えない。
 * Linux は /proc を読み、ほかの POSIX は ps の stat を見る。どちらも読めなければ（ps が上限までに戻らない場合を含む）、グループへのシグナル 0 で存否だけを見る
 */
export function activeGroupMembers(pgid: number, platform: NodeJS.Platform = process.platform, options: GroupCheckOptions = {}): number[] {
  const { timeoutMs = GROUP_EXIT_TIMEOUT_MS, psCommand = 'ps' } = options;
  const members = platform === 'linux' ? procMembers(pgid) : psMembers(pgid, psCommand, timeoutMs);
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

/** ps の pid・pgid・stat の列を読む。stat の先頭文字は Linux と macOS で同じ意味を持つ。ps が timeoutMs までに戻らなければ強制終了し、読めなかったとして扱う */
function psMembers(pgid: number, psCommand: string, timeoutMs: number): number[] | undefined {
  const timeout = Math.max(1, Math.ceil(timeoutMs));
  const result = spawnSync(psCommand, ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 });
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

/** 待機の設定。timeoutMs は待機全体の上限、intervalMs は確認の間隔、platform と psCommand は確認の経路を差し替えるため（テスト用） */
export interface GroupExitOptions extends GroupCheckOptions {
  intervalMs?: number;
  platform?: NodeJS.Platform;
}

/**
 * 同じプロセスグループのメンバーがすべて終了処理を終える（消滅かゾンビになる）まで待つ。
 * 上限までに終わらなければ false を返す。グループの確認（ps の待ち時間を含む）にも残り時間を渡し、
 * 期限が過ぎたあとは新しい確認を始めず、期限を過ぎてから届いた確認結果も採用しない
 */
export async function waitForGroupExit(pgid: number, options: GroupExitOptions = {}): Promise<boolean> {
  const { timeoutMs = GROUP_EXIT_TIMEOUT_MS, intervalMs = 10, platform, psCommand } = options;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    const members = activeGroupMembers(pgid, platform, { timeoutMs: remaining, psCommand });
    if (Date.now() >= deadline) return false;
    if (members.length === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
}
