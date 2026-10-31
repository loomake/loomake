import { createHash } from 'node:crypto';

/** 文字列を UTF-8 にした SHA-256 を、小文字の 16 進で返す。判定関数（policy）は node:* を読めないので、呼び出し側がこれを渡す */
export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
