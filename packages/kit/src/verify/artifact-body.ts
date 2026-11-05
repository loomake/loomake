import { createHash } from 'node:crypto';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export type ArtifactBodyCheck = { matches: boolean; reason: string };
export type ArtifactRetentionResult = {
  retention: 'satisfied' | 'insufficient' | 'unverified';
  current: 'available' | 'expired' | 'unverified';
  retentionReason: string;
  currentReason: string;
};

/** 渡されたraw viewの範囲だけを照合する。取得・真正性・品質合格は判定しない（REQ-463）。 */
export function checkArtifactBody(ref: unknown, bytes: Uint8Array): ArtifactBodyCheck {
  if (!object(ref) || typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256)
    || !Number.isSafeInteger(ref.bytes) || (ref.bytes as number) < 0 || !(bytes instanceof Uint8Array)) {
    return { matches: false, reason: '本体または参照の型が不正です' };
  }
  if (ref.bytes !== bytes.byteLength || ref.sha256 !== createHash('sha256').update(bytes).digest('hex')) return { matches: false, reason: '本体のハッシュまたはバイト数が参照と一致しません' };
  return { matches: true, reason: '本体のハッシュとバイト数が参照に一致しました' };
}

const daysInMonth = (year: number, month: number) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
function instant(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return undefined;
  const month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(Number(match[1]), month - 1)) return undefined;
  const time = Date.parse(value); return Number.isFinite(time) ? time : undefined;
}
function cutoff(created: number, policy: unknown): number | undefined {
  if (typeof policy !== 'string') return undefined;
  const match = /^([1-9]\d*)([dwy])$/.exec(policy); if (!match) return undefined;
  const n = Number(match[1]); if (!Number.isSafeInteger(n)) return undefined;
  const date = new Date(created);
  if (match[2] === 'y') {
    const day = date.getUTCDate(); date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + n);
    date.setUTCDate(Math.min(day, daysInMonth(date.getUTCFullYear(), date.getUTCMonth())));
  } else {
    const interval = n * (match[2] === 'w' ? 7 : 1) * 86_400_000;
    if (!Number.isSafeInteger(interval)) return undefined;
    date.setTime(created + interval);
  }
  return Number.isFinite(date.getTime()) ? date.getTime() : undefined;
}

/** 実参照location.createdAt/expiresAtと、明示nowだけを使い、当時と現在を分ける。 */
export function artifactRetention(ref: unknown, policy: unknown, now: string | Date): ArtifactRetentionResult {
  const created = object(ref) && object(ref.location) ? instant(ref.location.createdAt) : undefined;
  const expires = object(ref) ? instant(ref.expiresAt) : undefined;
  const currentTime = now instanceof Date ? now.getTime() : instant(now);
  const desired = created === undefined ? undefined : cutoff(created, policy);
  const retention = created === undefined || expires === undefined || expires < created || desired === undefined ? 'unverified' : expires >= desired ? 'satisfied' : 'insufficient';
  const current = expires === undefined || currentTime === undefined || !Number.isFinite(currentTime) ? 'unverified' : currentTime >= expires ? 'expired' : 'available';
  return { retention, current,
    retentionReason: retention === 'unverified' ? '実保持期間か方針期間を確認できません' : retention === 'satisfied' ? '当時の実保持期間は方針を満たしています' : '当時の実保持期間は方針より短いです',
    currentReason: current === 'unverified' ? '実期限か現在時刻を確認できません' : current === 'expired' ? '実期限を過ぎています' : '実期限より前です。取得権限や本体の存在は未確認です' };
}
