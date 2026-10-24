import { createPrivateKeyFilter } from './private-key-stream.js';
// よく知られた API キーやトークンの形。すべての秘密情報は見分けられないので、記録する範囲も絞る
const SECRET_PATTERNS = [
  // 他の形式の置換でBEGINやENDを壊す前に、ブロック全体を隠す。
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  // npm・Slack・GitLab・Google のトークン、JWT、秘密鍵のブロック（REQ-199）
  /\bnpm_[A-Za-z0-9]{36}\b/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];
// Bearer の語は残し、続くトークンだけを置き換える（REQ-199）
const BEARER = /\b(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/g;

function maskPlainText(text: string): string {
  return SECRET_PATTERNS.reduce((t, re) => t.replace(re, '***'), text).replace(BEARER, '$1***');
}

/** 記録する前に置換する。JSON文字列の値も、構文を保って扱う（REQ-118・REQ-199）。 */
export function maskSecrets(text: string): string {
  if (!text.includes('"')) return maskPlainText(text);
  const parts: string[] = [];
  let copied = 0; let at = 0;
  while (at < text.length) {
    const start = text.indexOf('"', at);
    if (start < 0) break;
    let end = start + 1;
    while (end < text.length) {
      if (text[end] === '\\') end += 2;
      else if (text[end] === '"') break;
      else end++;
    }
    if (end >= text.length) {
      const tail = text.slice(start);
      // 出力上限で切れたJSON文字列も、末尾の不完全なエスケープを除いて扱う。
      for (let trim = 0; trim <= Math.min(6, tail.length - 1); trim++) {
        try {
          const value: unknown = JSON.parse(tail.slice(0, tail.length - trim) + '"');
          if (typeof value === 'string') {
            const output: string[] = [];
            const redactor = createDiagnosticRedactor((part) => output.push(part));
            redactor.write(value); redactor.end();
            const masked = output.join('');
            if (masked !== value) {
              parts.push(text.slice(copied, start), JSON.stringify(masked).slice(0, -1), tail.slice(tail.length - trim));
              copied = text.length;
            }
          }
          break;
        } catch { /* 末尾の途中のエスケープだけを最大6文字まで切り分ける。 */ }
      }
      break;
    }
    try {
      const value: unknown = JSON.parse(text.slice(start, end + 1));
      if (typeof value === 'string') {
        const masked = maskPlainText(value);
        if (masked !== value) { parts.push(text.slice(copied, start), JSON.stringify(masked)); copied = end + 1; }
      }
    } catch { /* 通常の引用文は、そのまま平文の置換へ渡す。 */ }
    at = end + 1;
  }
  parts.push(text.slice(copied));
  return maskPlainText(parts.join(''));
}

/** チャンク境界をまたぐ診断のトークンを隠し、未確定な末尾も有限に保持する。 */
export function createDiagnosticRedactor(sink: (text: string) => void): { write: (text: string) => void; end: () => void } {
  let pending = '';
  let discarding = false;
  let discardedTail = '';
  let bearerWaiting = false;
  let escapePending = false;
  let output: string[] = [];
  const emit = (text: string) => { if (text) output.push(text); };
  const forward = () => { const ready = output.join(''); output = []; if (ready) sink(ready); };
  const maxPending = 4096;
  const tokenPrefix = /^(?:sk-|gh[pousr]_|github_pat_|AKIA|npm_|xox[abposr]-|glpat-|AIza|eyJ)/;
  const flush = (end = false) => {
    if (!pending) return;
    const masked = end && tokenPrefix.test(pending) ? '***'
      : bearerWaiting ? maskSecrets(`Bearer ${pending}`).slice(7) : maskSecrets(pending);
    bearerWaiting = masked === pending && /\bBearer$/.test(pending);
    emit(masked); pending = '';
  };
  const separator = (part: string) => {
    if (discarding) { bearerWaiting = /\bBearer$/.test(discardedTail); discardedTail = ''; discarding = false; }
    else flush();
    emit(part);
    if (/\S/.test(part) && !/^\\[nrtf]$/.test(part)) bearerWaiting = false;
  };
  const words = (input: string) => {
    let text = input;
    if (escapePending) {
      escapePending = false;
      if (/^[nrtbf]/.test(text)) { separator('\\' + text[0]); text = text.slice(1); }
      else separator('\\');
    }
    if (text.endsWith('\\')) { escapePending = true; text = text.slice(0, -1); }
    for (const match of text.matchAll(/\\[nrtbf]|\\|[A-Za-z0-9_.~+/=-]+|[^A-Za-z0-9_.~+/=\\-]+/g)) {
      const part = match[0];
      if (/^[A-Za-z0-9_.~+/=-]/.test(part)) {
        if (discarding) { discardedTail = (discardedTail + part).slice(-7); continue; }
        pending += part;
        if (pending.length > maxPending) {
          discardedTail = pending.slice(-7); pending = ''; discarding = true; bearerWaiting = false; emit('***');
        }
      } else {
        separator(part);
      }
    }
  };
  const privateKeys = createPrivateKeyFilter(words);
  return {
    write: (text) => { privateKeys.write(text); forward(); },
    end: () => {
      privateKeys.end();
      if (escapePending) separator('\\');
      flush(true); forward();
      pending = ''; discarding = false; discardedTail = ''; bearerWaiting = false; escapePending = false;
    },
  };
}
