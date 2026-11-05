import { describe, expect, it } from 'vitest';
import { createDiagnosticRedactor, maskSecrets } from '../src/mask.js';
import { createPrivateKeyFilter } from '../src/private-key-stream.js';

// 鍵として使えないダミー文字列のみを使う。
const dummyBody = 'NOT_A_REAL_PRIVATE_KEY_BODY';
const pgp = `-----BEGIN PGP PRIVATE KEY BLOCK-----\n${dummyBody}\n-----END PGP PRIVATE KEY BLOCK-----`;
const privateKinds = ['PRIVATE KEY', 'RSA PRIVATE KEY', 'OPENSSH PRIVATE KEY', 'PGP PRIVATE KEY BLOCK'];

type Filter = { write: (text: string) => void; end: () => void };
function filtered(create: (sink: (part: string) => void) => Filter, chunks: string[]): string {
  const output: string[] = [];
  const filter = create((part) => output.push(part));
  for (const chunk of chunks) filter.write(chunk);
  filter.end();
  return output.join('');
}

for (const [label, create] of [['直接の秘密鍵フィルター', createPrivateKeyFilter], ['診断ストリーム', createDiagnosticRedactor]] as const) {
  describe(label, () => {
    it('[REQ-199] PGP の秘密鍵ブロックを全チャンク境界と1文字ずつの転送で隠す', () => {
      const text = `before ${pgp} after\n`;
      const expected = 'before *** after\n';
      expect(filtered(create, [text])).toBe(expected);
      for (let at = 1; at < text.length; at++) {
        expect(filtered(create, [text.slice(0, at), text.slice(at)]), `境界 ${at}`).toBe(expected);
      }
      expect(filtered(create, [...text])).toBe(expected);
      expect(maskSecrets(text)).toBe(expected);
    });

    it.each(privateKinds)('[REQ-199] END 行のない %s を平文と同じように隠す', (kind) => {
      const text = `before -----BEGIN ${kind}-----\n${dummyBody}`;
      const expected = 'before ***';
      expect(filtered(create, [...text])).toBe(expected);
      expect(maskSecrets(text)).toBe(expected);
    });

    it('[REQ-199] PGP PUBLIC KEY BLOCK はチャンクを分けても隠さない', () => {
      const text = 'before -----BEGIN PGP PUBLIC KEY BLOCK-----\nNOT_A_REAL_PUBLIC_KEY\n-----END PGP PUBLIC KEY BLOCK----- after\n';
      expect(filtered(create, [...text])).toBe(text);
      expect(maskSecrets(text)).toBe(text);
    });

    it.each([4096, 4097])('[REQ-199] 長い秘密鍵の見出しでもヘッダ上限 %s 付近で本文を保持せず終端後に戻る', (length) => {
      const kind = 'X'.repeat(length - ' PGP PRIVATE KEY BLOCK'.length) + ' PGP PRIVATE KEY BLOCK';
      const text = `before -----BEGIN ${kind}-----\n${dummyBody}\n-----END PGP PRIVATE KEY BLOCK----- after\n`;
      expect(filtered(create, [...text])).toBe('before *** after\n');
    });
  });
}

describe('平文と JSON の秘密鍵', () => {
  it('[REQ-199][REQ-118] PGP の秘密鍵ブロックを平文の記録で隠す', () => {
    expect(maskSecrets(`前\n${pgp}\n後`)).toBe('前\n***\n後');
  });

  it.each(privateKinds)('[REQ-199] JSON の値にある %s を END 行なしでも隠す', (kind) => {
    const payload = `before -----BEGIN ${kind}-----\n${dummyBody}`;
    expect(JSON.parse(maskSecrets(JSON.stringify({ payload })))).toEqual({ payload: 'before ***' });
  });

  it('[REQ-199] 完全な PGP の後に END 行のない秘密鍵があっても両方を隠す', () => {
    const text = `before ${pgp} between -----BEGIN RSA PRIVATE KEY-----\n${dummyBody}`;
    expect(maskSecrets(text)).toBe('before *** between ***');
    expect(filtered(createPrivateKeyFilter, [...text])).toBe('before *** between ***');
  });

  it('[REQ-199] 切断された JSON の PGP 値でも本文を隠す', () => {
    const raw = JSON.stringify({ payload: `before ${pgp}` }).split('-----END')[0];
    expect(maskSecrets(raw)).toBe('{"payload":"before ***');
    expect(maskSecrets(raw)).not.toContain(dummyBody);
  });
});
