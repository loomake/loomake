import type { EffortRecord, EffortMinutes, EffortCost } from '@loomake/core';
import { UsageError, maskValue, CHANGE_ID } from '@loomake/kit';
const categories = ['instruct', 'review', 'rework', 'run', 'wait'] as const;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const duration = (value: unknown): value is number => count(value) && value <= 100000;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const noteValid = (value: unknown): value is string => typeof value === 'string' && Array.from(value).length <= 500 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value);
export class EffortInputFailure extends UsageError {
  constructor(message: string, readonly reason: 'input' | 'size') { super(message); }
}
const invalid = () => new EffortInputFailure('実作業時間の入力が不正です。時間・区分・回数・費用・メモの書式を確認してください。', 'input');
const safeInteger = (digits: string): number => {
  const trimmed = digits.replace(/^0+/, '') || '0';
  if (trimmed.length > 16) throw invalid();
  const value = Number(trimmed);
  if (!count(value)) throw invalid();
  return value;
};
/** m または h を、丸めず0〜100000の整数分へ変換する。 */
export function parseDuration(text: string): number {
  if (typeof text !== 'string' || /\s/.test(text)) throw invalid();
  let value: number;
  if (/^(0|[1-9]\d{0,5})m$/.test(text)) value = Number(text.slice(0, -1));
  else {
    const match = /^(0|[1-9]\d{0,3})(?:\.(\d{1,2}))?h$/.exec(text);
    if (!match) throw invalid();
    const hundredths = Number(match[1]) * 100 + Number((match.at(2) ?? '').padEnd(2, '0'));
    if (hundredths * 60 % 100 !== 0) throw invalid();
    value = hundredths * 60 / 100;
  }
  if (!duration(value)) throw invalid();
  return value;
}
export type EffortAmount = { totalMinutes: number } | { minutes: EffortMinutes };
/** 総計と区分の排他、省略と0、searchの内数を保持する。 */
export function parseEffortOption(text: string): EffortAmount {
  if (typeof text !== 'string' || /\s/.test(text)) throw invalid();
  if (!text.includes('=')) return { totalMinutes: parseDuration(text) };
  const minutes: EffortMinutes = {};
  for (const part of text.split(',')) {
    const match = /^(instruct|review|rework|run|wait|search)=([^=]+)$/.exec(part);
    if (!match) throw invalid();
    const category = match[1] as keyof EffortMinutes;
    if (Object.hasOwn(minutes, category)) throw invalid();
    minutes[category] = parseDuration(match[2]);
  }
  const known = categories.reduce((sum, key) => sum + (minutes[key] ?? 0), 0);
  if (!categories.some((key) => minutes[key] !== undefined) || (minutes.search ?? 0) > known) throw invalid();
  return { minutes };
}
/** USDを整数centsへ変換し、tokensと別のkindとして保持する。 */
export function parseCost(text: string): EffortCost[] {
  if (typeof text !== 'string' || /\s/.test(text)) throw invalid();
  const kinds = new Set<string>();
  return text.split(',').map((part): EffortCost => {
    const match = /^(actual-usd|estimated-usd|tokens):([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(part);
    if (!match || kinds.has(match[1])) throw invalid();
    const kind = match[1]; kinds.add(kind);
    if (kind === 'tokens') {
      if (match.at(3) !== undefined) throw invalid();
      return { kind, count: safeInteger(match[2]) };
    }
    return { kind: kind as 'actual-usd' | 'estimated-usd', cents: safeInteger(match[2] + (match.at(3) ?? '').padEnd(2, '0')) };
  });
}
function dateValid(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match.at(6) ?? '0') > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
function problem(value: unknown): string | null {
  if (!object(value)) return 'レコードはobjectにしてください';
  const allowed = ['schemaVersion', 'kind', 'change', 'sha', 'recordedAt', 'totalMinutes', 'minutes', 'decisions', 'attempts', 'cost', 'note'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return '未知の項目があります';
  if (value.schemaVersion !== 1 || value.kind !== 'loomake-effort') return 'Effort 1の識別が不正です';
  if (typeof value.change !== 'string' || !CHANGE_ID.test(value.change) || /\s/.test(value.change) || value.change === 'archive') return 'change-idが不正です';
  if (typeof value.sha !== 'string' || ![40, 64].includes(value.sha.length) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.sha)) return 'SHAが不正です';
  if (!dateValid(value.recordedAt)) return '記録日時が不正です';
  if (Object.hasOwn(value, 'totalMinutes') === Object.hasOwn(value, 'minutes')) return '総計と区分はどちらか一方にしてください';
  if (Object.hasOwn(value, 'totalMinutes') && !duration(value.totalMinutes)) return '総計の範囲が不正です';
  if (Object.hasOwn(value, 'minutes')) {
    const m = value.minutes;
    if (!object(m) || Object.keys(m).some((key) => ![...categories, 'search'].includes(key) || !duration(m[key]))) return '区分の値が不正です';
    if (!categories.some((key) => Object.hasOwn(m, key))) return '時間の区分を指定してください';
    const known = categories.reduce((sum, key) => { const v = m[key]; return sum + (typeof v === 'number' ? v : 0); }, 0);
    if (typeof m.search === 'number' && m.search > known) return 'searchが既知の合計を超えています';
  }
  for (const key of ['decisions', 'attempts']) if (value[key] !== undefined && !count(value[key])) return '回数は非負の安全な整数にしてください';
  if (value.cost !== undefined) {
    if (!Array.isArray(value.cost) || value.cost.length === 0 || value.cost.length > 3) return '費用は配列にしてください';
    const kinds = new Set<string>();
    for (const item of value.cost as unknown[]) {
      if (!object(item) || typeof item.kind !== 'string' || kinds.has(item.kind)) return '費用の区分が不正です';
      kinds.add(item.kind);
      const key = item.kind === 'tokens' ? 'count' : 'cents';
      if (!['tokens', 'actual-usd', 'estimated-usd'].includes(item.kind) || Object.keys(item).length !== 2 || !count(item[key])) return '費用の値が不正です';
    }
  }
  if (value.note !== undefined && !noteValid(value.note)) return 'メモは改行・制御文字を含まない500文字以内にしてください';
  return null;
}
/** 生の入力を診断へ複写せず、構造と値を同期検査する。 */
export function effortProblem(value: unknown): string | null {
  try {
    const masked: unknown = maskValue(value);
    const descriptor = object(value) ? Object.getOwnPropertyDescriptor(value, 'note') : undefined;
    if (descriptor && (!('value' in descriptor) || !noteValid(descriptor.value))) return '元のメモが不正です';
    return problem(masked);
  } catch { return '実績データの構造が不正です'; }
}
/** 入力不変の共通置換後に検査し、整形JSONと末尾改行を64KiB以下で返す。 */
export function serializeEffort(value: unknown, maxBytes = 65536): string {
  if (!count(maxBytes) || maxBytes === 0 || maxBytes > 65536) throw invalid();
  try {
    const masked: unknown = maskValue(value);
    if (object(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, 'note');
      if (descriptor && (!('value' in descriptor) || !noteValid(descriptor.value))) throw invalid();
    }
    if (problem(masked)) throw invalid();
    const json = JSON.stringify(masked, null, 2) + '\n';
    if (Buffer.byteLength(json, 'utf8') > maxBytes) throw new EffortInputFailure(`実績記録の上限は${maxBytes}バイトです。記録していません。`, 'size');
    if (problem(JSON.parse(json))) throw invalid();
    return json;
  } catch (error) {
    if (error instanceof EffortInputFailure && error.reason === 'size') throw error;
    throw invalid();
  }
}
/** 型の導出元はcore、I/Oの適合性検査は同期のeffortProblemを使う。 */
export type { EffortRecord };
