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
  it('[REQ-199] JSONの終端が切れても改行に続く既知形式を置換する', () => {
    const token = 'ghp_' + 'x'.repeat(24);
    const raw = JSON.stringify({ message: 'before\n' + token + ' tail' }).slice(0, -3);
    const saved = maskSecrets(raw);
    expect(saved).not.toContain(token);
    expect(saved).toContain('***');
    expect(Buffer.byteLength(saved)).toBeLessThanOrEqual(Buffer.byteLength(raw));
  });
  it('[REQ-199] JSON文字列の改行に続く既知形式を値として置換する', () => {
    const payload = Object.values(tokens).join('\n') + '\nAuthorization: Bearer\n' + 'Z'.repeat(24);
    const saved = JSON.parse(maskSecrets(JSON.stringify({ payload })));
    for (const token of [...Object.values(tokens), 'Z'.repeat(24)]) expect(saved.payload).not.toContain(token);
    expect(saved.payload).toContain('Authorization: Bearer\n***');
  });

  it('[REQ-199] JSONのUnicodeエスケープを含むトークンも値として置換する', () => {
    const json = '{"token":"\\u0067hp_' + 'x'.repeat(24) + '"}';
    expect(JSON.parse(maskSecrets(json)).token).toBe('***');
  });
  it('[REQ-199] APIトークンが隣接しても秘密鍵のBEGINを壊さず本文全体を置換する', () => {
    const key = '-----BEGIN PRIVATE KEY-----\nFAKE_PRIVATE_BODY\n-----END PRIVATE KEY-----';
    expect(maskSecrets('sk-' + 'x'.repeat(24) + key)).toBe('******');
  });

  it('[REQ-199] 別形式に見えるヘッダでも秘密鍵のブロック全体を先に置換する', () => {
    const kind = 'AKIA' + 'X'.repeat(16) + ' PRIVATE KEY';
    const key = `-----BEGIN ${kind}-----\nFAKE_PRIVATE_BODY\n-----END ${kind}-----`;
    expect(maskSecrets(key)).toBe('***');
  });
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
