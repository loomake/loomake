// よく知られた API キーやトークンの形（add-run-loop の仮定 A-13）。すべての秘密情報は見分けられないので、記録する範囲も絞る
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

/** 記録する前に、秘密情報らしい文字列を *** に置き換える（REQ-118） */
export function maskSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((t, re) => t.replace(re, '***'), text);
}
