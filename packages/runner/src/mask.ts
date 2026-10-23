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

/** チャンク境界をまたぐ診断のトークンを隠し、未確定な末尾も有限に保持する。 */
export function createDiagnosticRedactor(sink: (text: string) => void): { write: (text: string) => void; end: () => void } {
  let pending = '';
  let discarding = false;
  const maxPending = 4096;
  const longWord = new RegExp(`[A-Za-z0-9_-]{${maxPending + 1},}`, 'g');
  const tokenPrefix = /^(?:sk-|gh[pousr]_|github_pat_|AKIA)/;
  const write = (text: string) => {
    if (discarding) {
      const boundary = text.search(/[^A-Za-z0-9_-]/);
      if (boundary < 0) return;
      text = text.slice(boundary);
      discarding = false;
    }
    pending += text;
    const tail = pending.match(/[A-Za-z0-9_-]+$/)?.[0] ?? '';
    const ready = pending.slice(0, pending.length - tail.length);
    if (ready) sink(maskSecrets(ready.replace(longWord, '***')));
    pending = tail;
    if (pending.length > maxPending) {
      sink('***');
      pending = '';
      discarding = true;
    }
  };
  return {
    write,
    end: () => {
      if (pending) sink(tokenPrefix.test(pending) ? '***' : maskSecrets(pending));
      pending = '';
      discarding = false;
    },
  };
}
