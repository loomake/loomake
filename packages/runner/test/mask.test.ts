import { describe, expect, it } from 'vitest';
import { createDiagnosticRedactor, maskSecrets } from '../src/mask.js';

// すべて認証には使えない試験用の文字列。
const tokens = {
  npm: 'npm_' + 'a'.repeat(36),
  slack: 'xoxb-' + '1'.repeat(12) + '-' + 'a'.repeat(24),
  gitlab: 'glpat-' + 'a'.repeat(20),
  google: 'AIza' + 'a'.repeat(35),
  jwt: ['eyJ' + 'a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)].join('.'),
};

describe('置換する秘密情報の形', () => {
  it.each(Object.entries(tokens))('[REQ-199] %s のトークンを置き換える', (_name, token) => {
    expect(maskSecrets(`前 ${token} 後`)).toBe('前 *** 後');
  });

  it('[REQ-199] 複数行の秘密鍵のブロックを BEGIN から END まで置き換える', () => {
    const key = ['-----BEGIN OPENSSH PRIVATE KEY-----', 'a'.repeat(64), 'b'.repeat(64), '-----END OPENSSH PRIVATE KEY-----'].join('\n');
    expect(maskSecrets(`前\n${key}\n後`)).toBe('前\n***\n後');
  });

  it('[REQ-199] Bearer は残し、続くトークンだけを置き換える', () => {
    expect(maskSecrets(`Authorization: Bearer ${'a'.repeat(32)}`)).toBe('Authorization: Bearer ***');
  });

  it('[REQ-199] 短い文字列や通常の文は置き換えない', () => {
    const text = 'npm_install と AIza だけ。Bearer は認証の方式です。eyJ.a.b';
    expect(maskSecrets(text)).toBe(text);
  });

  it.each(Object.entries(tokens))('[REQ-199] 診断のストリームでも、チャンクの境目にある %s のトークンを置き換える', (_name, token) => {
    for (const at of [1, Math.floor(token.length / 2), token.length - 1]) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((text) => out.push(text));
      redactor.write(`begin ${token.slice(0, at)}`);
      redactor.write(`${token.slice(at)} end\n`);
      redactor.end();
      expect(out.join('')).toBe('begin *** end\n');
    }
  });
});
