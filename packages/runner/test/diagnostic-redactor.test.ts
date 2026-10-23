import { describe, expect, it } from 'vitest';
import { createDiagnosticRedactor } from '../src/mask.js';

// すべて認証には使えない試験用の文字列。
const tokens = ['sk-' + 'x'.repeat(24), 'ghp_' + 'x'.repeat(24), 'github_pat_' + 'x'.repeat(24), 'AKIA' + 'X'.repeat(16)];

describe('診断ストリームの置換', () => {
  it.each(tokens.map((token, index) => ({ index, token })))('[REQ-153] 形式$indexの全チャンク境界で同じ結果を返す', ({ token }) => {
    for (let at = 1; at < token.length; at++) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((text) => out.push(text));
      redactor.write(`begin ${token.slice(0, at)}`);
      redactor.write(`${token.slice(at)} end\n`);
      redactor.end();
      expect(out.join('')).toBe('begin *** end\n');
    }
  });

  it('[REQ-153] 改行のない末尾と途中の接頭辞も置換する', () => {
    for (const text of [tokens[0], 'sk-' + 'x'.repeat(3)]) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((part) => out.push(part));
      redactor.write(text);
      redactor.end();
      expect(out.join('')).toBe('***');
    }
  });

  it('[REQ-153] 長い単語を省略した後も通常の診断に戻る', () => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((text) => out.push(text));
    for (let i = 0; i < 100; i++) redactor.write('x'.repeat(1000));
    redactor.write(' next 日本語\n');
    redactor.end();
    expect(out.join('')).toBe('*** next 日本語\n');
  });

  it('[REQ-153] 区切りを含む単一チャンクでも長い単語を省略する', () => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((text) => out.push(text));
    redactor.write(`${'x'.repeat(5000)} next\n`);
    redactor.end();
    expect(out.join('')).toBe('*** next\n');
  });

  it('[REQ-153] 短い通常の単語と日本語を維持する', () => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((text) => out.push(text));
    redactor.write('status ');
    redactor.write('日本語 ready');
    redactor.end();
    expect(out.join('')).toBe('status 日本語 ready');
  });
});
