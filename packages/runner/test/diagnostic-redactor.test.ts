import { describe, expect, it, vi } from 'vitest';
import { createDiagnosticRedactor } from '../src/mask.js';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import ts from 'typescript';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

// すべて認証には使えない試験用の文字列。
const tokens = [
  'sk-' + 'x'.repeat(24), 'ghp_' + 'x'.repeat(24), 'github_pat_' + 'x'.repeat(24), 'AKIA' + 'X'.repeat(16),
  ...['gho_', 'ghu_', 'ghs_', 'ghr_'].map((prefix) => prefix + 'x'.repeat(24)),
  'npm_' + 'x'.repeat(36), 'xoxb-' + 'x'.repeat(24), 'glpat-' + 'x'.repeat(24), 'AIza' + 'X'.repeat(35),
  'eyJ' + 'x'.repeat(12) + '.' + 'y'.repeat(12) + '.' + 'z'.repeat(12),
];

describe('診断ストリームの置換', () => {
  it.each(['\n', '\r', '\t'])('[REQ-153] JSONの区切り %j の後のトークンも全チャンク境界で保護する', (space) => {
    const text = JSON.stringify({ message: `before${space}${tokens[1]} after Authorization: Bearer${space}${'Z'.repeat(24)}` });
    const expected = JSON.stringify({ message: `before${space}*** after Authorization: Bearer${space}***` });
    for (let at = 1; at < text.length; at++) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((part) => out.push(part));
      redactor.write(text.slice(0, at)); redactor.write(text.slice(at)); redactor.end();
      expect(out.join(''), `境界${at}`).toBe(expected);
    }
  });
  it.each([
    { text: 'Authorization: Bearer sk-xxx', expected: 'Authorization: Bearer ***' },
    { text: 'Authorization: Bearer ' + 'Z'.repeat(24), expected: 'Authorization: Bearer ***' },
    { text: 'before -----BEGIN PRIVATE KEY-----\nFAKE_PRIVATE_BODY', expected: 'before ***' },
  ])('[REQ-153] 改行のない末尾 $text も保護する', ({ text, expected }) => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((part) => out.push(part));
    for (const char of text) redactor.write(char);
    redactor.end(); expect(out.join('')).toBe(expected);
  });
  it.each([
    'status Bearer short ready\n',
    'before -----BEGIN CERTIFICATE-----\nPUBLIC_DATA\n-----END CERTIFICATE----- after\n',
    'before -----BEGIN NOT A KEY----- plain -----END NOT A KEY----- after\n',
    'before -----BEGIN RSA PRIVATE',
  ])('[REQ-153] 秘密情報でない短い診断 %j をチャンク分割しても維持する', (text) => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((part) => out.push(part));
    for (const char of text) redactor.write(char);
    redactor.end(); expect(out.join('')).toBe(text);
  });
  it.each([
    { label: 'Bearer', text: `before Authorization: Bearer ${'Z'.repeat(24)}+/~_-.${'A'.repeat(20)}== after\n`, expected: 'before Authorization: Bearer *** after\n' },
    ...['PRIVATE KEY', 'RSA PRIVATE KEY'].map((kind) => ({ label: kind, text: `before -----BEGIN ${kind}-----\nFAKE_PRIVATE_BODY\nNOT_A_REAL_KEY\n-----END ${kind}----- after\n`, expected: 'before *** after\n' })),
  ])('[REQ-153] $label を全チャンク境界と1文字ずつの転送で置換する', ({ text, expected }) => {
    for (let at = 1; at < text.length; at++) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((part) => out.push(part));
      redactor.write(text.slice(0, at)); redactor.write(text.slice(at)); redactor.end();
      expect(out.join(''), `境界${at}`).toBe(expected);
    }
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((part) => out.push(part));
    for (const char of text) redactor.write(char);
    redactor.end(); expect(out.join('')).toBe(expected);
  });
  it.each(tokens.map((token, index) => ({ index, token })))('[REQ-153] 形式$index の全チャンク境界で同じ結果を返す', ({ token }) => {
    for (let at = 1; at < token.length; at++) {
      const out: string[] = [];
      const redactor = createDiagnosticRedactor((text) => out.push(text));
      redactor.write(`begin ${token.slice(0, at)}`);
      redactor.write(`${token.slice(at)} end\n`);
      redactor.end();
      expect(out.join('')).toBe('begin *** end\n');
    }
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((text) => out.push(text));
    for (const char of `begin ${token} end\n`) redactor.write(char);
    redactor.end(); expect(out.join('')).toBe('begin *** end\n');
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

  it.each([4096, 4097])('[REQ-153] 未確定の単語%s文字の境界を守る', (length) => {
    const out: string[] = [];
    const redactor = createDiagnosticRedactor((text) => out.push(text));
    redactor.write('x'.repeat(length)); redactor.end();
    expect(out.join('')).toBe(length === 4096 ? 'x'.repeat(4096) : '***');
  });

  it('[REQ-153] old spaceを32MiBに制限して64MiBの区切りのない診断を処理し通常の出力へ戻る', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'loomake-redactor-module-'));
    try {
      writeFileSync(join(fixture, 'package.json'), '{"type":"module"}');
      for (const name of ['mask', 'private-key-stream']) {
        const source = readFileSync(join(import.meta.dirname, '../src', `${name}.ts`), 'utf8');
        writeFileSync(join(fixture, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
    const module = pathToFileURL(join(fixture, 'mask.js')).href;
    const checked = spawnSync(process.execPath, ['--max-old-space-size=32', '--experimental-strip-types', '--input-type=module', '-e', `
import { createDiagnosticRedactor } from ${JSON.stringify(module)};

let output = '';
const redactor = createDiagnosticRedactor((text) => { output += text; });
const chunk = 'x'.repeat(4096);
for (let i = 0; i < 16384; i++) redactor.write(chunk);
redactor.write(' next 日本語\\n'); redactor.end();
console.log(JSON.stringify({ output, heapUsed: process.memoryUsage().heapUsed }));
`], { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(checked.stdout);
    expect(result.output).toBe('*** next 日本語\n');
    expect(result.heapUsed).toBeLessThan(32 * 1024 * 1024);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  }, 18000);
});
