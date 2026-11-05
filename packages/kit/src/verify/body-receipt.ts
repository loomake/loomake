import { createHash } from 'node:crypto';
import { checkArtifactBody, type ArtifactBodyCheck } from './artifact-body.js';

export type BodyReceiptCheck = ArtifactBodyCheck;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hash = (v: unknown): boolean => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const sha = (v: unknown): boolean => typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(v);
const count = (v: unknown): boolean => Number.isSafeInteger(v) && (v as number) >= 0;
const ci = (v: unknown): v is Record<string, unknown> & { runId: string; runAttempt: string } => object(v) && typeof v.runId === 'string' && /^\d+$/.test(v.runId)
  && typeof v.runAttempt === 'string' && /^[1-9]\d*$/.test(v.runAttempt) && Number.isSafeInteger(Number(v.runAttempt));
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const mismatch = (reason: string): BodyReceiptCheck => ({ matches: false, reason });

/** raw bytesだけを結び付ける純粋照合。取得・真正性・品質判定は作らない（REQ-471）。 */
export function checkBodyReceipt(summaryBytes: Uint8Array, receipt: unknown, bodyBytes?: Uint8Array): BodyReceiptCheck {
  try {
    if (!(summaryBytes instanceof Uint8Array) || !object(receipt) || receipt.indexVersion !== 1) return mismatch('要約または索引の型が不正です');
    const { summary: s, body: b, execution: e, locator: l, archive: a } = receipt;
    if (!object(s) || !hash(s.sha256) || !count(s.bytes) || !sha(s.sha) || typeof s.change !== 'string' || !ci(s.ci)
      || !object(b) || b.kind !== 'test-report' || !hash(b.sha256) || !count(b.bytes)
      || !object(e) || !sha(e.checkoutSha) || !ci(e) || !object(l) || !ci(l)
      || !object(a) || !hash(a.sha256) || typeof a.apiDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(a.apiDigest)) return mismatch('照合する索引の欄が不正です');
    if (s.sha256 !== digest(summaryBytes) || s.bytes !== summaryBytes.byteLength) return mismatch('要約のハッシュまたはバイト数が索引と一致しません');
    const summary: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(summaryBytes));
    if (!object(summary) || summary.summaryVersion !== 1 || !sha(summary.sha) || typeof summary.change !== 'string' || !ci(summary.ci)
      || !Array.isArray(summary.artifacts) || !summary.artifacts.every((v) => object(v) && v.kind === 'test-report' && hash(v.sha256) && count(v.bytes))) return mismatch('要約の版または照合欄が不正です');
    if (summary.change !== s.change || summary.sha !== s.sha || summary.sha !== e.checkoutSha) return mismatch('要約の対象と実checkoutが索引と一致しません');
    const summaryCi = summary.ci;
    if (![s.ci, l, e].every((v) => v.runId === summaryCi.runId && v.runAttempt === summaryCi.runAttempt)) return mismatch('要約と索引のCI実行または試行が一致しません');
    if (summary.artifacts.filter((v) => v.sha256 === b.sha256 && v.bytes === b.bytes).length !== 1) return mismatch('本体に一致する要約の参照が一意ではありません');
    if (a.sha256 !== a.apiDigest.slice(7)) return mismatch('ZIPのハッシュがAPIのdigestと一致しません');
    if (bodyBytes !== undefined) {
      const checked = checkArtifactBody(b, bodyBytes);
      if (!checked.matches) return checked;
    }
    return { matches: true, reason: '固定要約と本体参照の結び付けが一致しました。取得・真正性・品質合格は未確認です' };
  } catch { return mismatch('要約または索引を照合できません'); }
}
