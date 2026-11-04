import { JSON_LIMITS } from '../runtime/input.js';
import { ProcessLimitError, runExternalBytes } from '../runtime/process.js';

export type JobUnavailableReason = 'missing' | 'exit' | 'signal' | 'spawn' | 'json';
/** 宣言した CI の job の取得結果。value は gh の応答を JSON として解析しただけで、検証していない（REQ-415） */
export type JobFetch = { kind: 'fetched'; job: string; value: unknown } | { kind: 'unavailable'; job: string; reason: JobUnavailableReason };

// cmd.exe がコマンドを見つけられなかったときの終了コード
const WINDOWS_NOT_FOUND = 9009;

/** CI の job の数字（ASCII の 0〜9 の 1 文字以上）から先頭の 0 だけを除く。Number へ変換せず桁を保つ（REQ-415） */
export function jobDigits(digits: string): string {
  // m フラグのない $ は入力の末尾にだけ一致し、末尾の改行の手前には一致しない
  if (!/^[0-9]+$/.test(digits)) throw new Error('CI の job の数字ではありません');
  return digits.replace(/^0+(?=[0-9])/, '');
}

function ghCommand(job: string): [string, string[]] {
  const path = `repos/{owner}/{repo}/actions/jobs/${job}`;
  if (process.platform !== 'win32') return ['gh', ['api', path]];
  // 従来の gh.cmd も呼べるよう、Node の shell と同じ cmd へ、固定の文字と検証済みの数字だけの文字列を渡す
  return [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `gh api ${path}`]];
}

function classify(job: string, result: ReturnType<typeof runExternalBytes>): JobFetch {
  const unavailable = (reason: JobUnavailableReason): JobFetch => ({ kind: 'unavailable', job, reason });
  if (result.error) return unavailable(result.error.code === 'ENOENT' ? 'missing' : 'spawn');
  if (result.signal) return unavailable('signal');
  // cmd が gh を見つけられないと 9009 で終わる。gh 自身が 9009 で終わった場合とは区別できない
  if (result.status !== 0) return unavailable(process.platform === 'win32' && result.status === WINDOWS_NOT_FOUND ? 'missing' : 'exit');
  // 既存の読み取りと同じく UTF-8 の文字列にしてから解析し、値を検証しない
  try { return { kind: 'fetched', job, value: JSON.parse(result.stdout.toString('utf8')) as unknown }; } catch { return unavailable('json'); }
}

/** 宣言した CI の job を gh で 1 回取得し、返った出力のバイト数を添える。監視による停止は ProcessLimitError のまま投げる（REQ-415） */
export function fetchJob(root: string, digits: string, limit = JSON_LIMITS.maxFileBytes): { result: JobFetch; bytes: number } {
  const job = jobDigits(digits);
  // GH_REPO で別のリポジトリへ切り替えない。Windows の環境変数の名前は大文字と小文字を区別しない
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => (process.platform === 'win32' ? key.toUpperCase() : key) !== 'GH_REPO'));
  const output = runExternalBytes(...ghCommand(job), { cwd: root, env, maxBuffer: Math.min(JSON_LIMITS.maxFileBytes, limit) });
  // 制御用の領域も超えた native の受信は、取得不能にせず出力の上限として止める
  if (output.error?.code === 'ENOBUFS') throw new ProcessLimitError('output', 'gh');
  return { result: classify(job, output), bytes: output.stdout.length + output.stderr.length };
}
