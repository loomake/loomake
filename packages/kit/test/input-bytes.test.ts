import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, truncateSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createByteInputReader, createInputReader, JSON_LIMITS, readInputBytes, InputReadFailure, UsageError } from '../src/index.js';

const interception = vi.hoisted(() => ({ loop: false, fifo: false, denied: false }));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, lstatSync: (...args: Parameters<typeof fs.lstatSync>) => interception.fifo
    ? { isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false } : fs.lstatSync(...args), openSync: (...args: Parameters<typeof fs.openSync>) => {
    if (interception.denied) throw Object.assign(new Error('不読'), { code: 'EACCES' });
    if (interception.loop) throw Object.assign(new Error('差替え'), { code: 'ELOOP' });
    return fs.openSync(...args);
  } };
});
const roots: string[] = [];
const temporary = () => { const root = mkdtempSync(join(tmpdir(), 'loomake-raw-input-')); roots.push(root); return root; };
afterEach(() => { interception.loop = false; interception.fifo = false; interception.denied = false; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('元bytesを読む安全な入口', () => {
  it('[REQ-462] 不正UTF8もrawのまま返し、文字列readと入力ファイルを変更しない', () => {
    const file = join(temporary(), 'raw'); const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x80, 0xe3, 0x81]); writeFileSync(file, bytes);
    const first = readInputBytes(file); expect(first).toEqual(bytes);
    first.fill(0); expect(readInputBytes(file)).toEqual(bytes); expect(readFileSync(file)).toEqual(bytes);
    expect(createInputReader().read(file)).toBe(bytes.toString('utf8'));
    expect(Object.keys(createInputReader())).toEqual(['read', 'readHead', 'entries', 'walk']);
  });
  it('[REQ-462] default 64MiBちょうどを受け付け、1byte超と実読取予算を拒否する', () => {
    const file = join(temporary(), 'boundary'); writeFileSync(file, ''); truncateSync(file, JSON_LIMITS.maxFileBytes);
    expect(readInputBytes(file).length).toBe(JSON_LIMITS.maxFileBytes);
    truncateSync(file, JSON_LIMITS.maxFileBytes + 1); expect(() => readInputBytes(file)).toThrow(UsageError);
    writeFileSync(file, 'abc'); expect(() => readInputBytes(file, { maxFileBytes: 2 })).toThrow(/ファイルの上限は2/);
    expect(() => readInputBytes(file, { maxFileBytes: 3, maxTotalBytes: 2 })).toThrow(/読み取り合計の上限は2/);
    expect(readInputBytes(file, { maxFileBytes: 3 })).toEqual(Buffer.from('abc'));
  });
  it('[REQ-462] 通常ディレクトリとリンクを拒否する', () => {
    const root = temporary(); const directory = join(root, 'directory'); mkdirSync(directory);
    expect(() => readInputBytes(directory)).toThrow(/通常のファイル/);
    const link = join(root, 'link'); symlinkSync(directory, link, 'junction'); expect(() => readInputBytes(link)).toThrow(/シンボリックリンク/);
  });
  it('[REQ-462] FIFO等の非通常ファイルをopen前に拒否して待機しない', () => {
    const file = join(temporary(), 'fifo'); writeFileSync(file, ''); interception.fifo = true; interception.loop = true;
    expect(() => readInputBytes(file)).toThrow(/通常のファイル/);
  });
  it('[REQ-462] OS不読は公開InputReadFailureで入力拒否と区別できる', () => {
    const file = join(temporary(), 'raw'); writeFileSync(file, 'abc'); interception.denied = true;
    expect(() => readInputBytes(file)).toThrow(InputReadFailure);
    expect(() => readInputBytes(file)).toThrow(UsageError);
  });
  it('[REQ-462] lstat後の差替えELOOPでもUsageErrorの分類を保つ', () => {
    const file = join(temporary(), 'raw'); writeFileSync(file, 'abc'); interception.loop = true;
    expect(() => readInputBytes(file)).toThrow(UsageError);
    expect(() => readInputBytes(file)).toThrow(/差替え/);
  });
});

describe('予算を共有する bytes reader', () => {
  it('[REQ-171] bytes と文字列の読取りが同じ合計の予算を使い、超えたら止まる', () => {
    const root = temporary(); writeFileSync(join(root, 'a'), 'xxxxxx'); writeFileSync(join(root, 'b'), 'yyyyyy');
    const reader = createByteInputReader({ maxTotalBytes: 10 });
    expect(reader.readBytes(join(root, 'a')).toString()).toBe('xxxxxx');
    expect(() => reader.read(join(root, 'b'))).toThrow(/合計の上限は10バイト/);
  });
  it('[REQ-171] 返す bytes は原本と一致し、書き換えても原本と次の読取りに影響しない', () => {
    const file = join(temporary(), 'raw'); const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x80, 0xe3, 0x81]); writeFileSync(file, bytes);
    const reader = createByteInputReader();
    const first = reader.readBytes(file); expect(first).toEqual(bytes); first.fill(0);
    expect(reader.readBytes(file)).toEqual(bytes);
  });
  it('[REQ-171] リンクと通常のファイル以外は拒否し、既存の reader の形は変えない', () => {
    const root = temporary(); writeFileSync(join(root, 'a'), 'a'); symlinkSync(join(root, 'a'), join(root, 'link'));
    expect(() => createByteInputReader().readBytes(join(root, 'link'))).toThrow(UsageError);
    expect(Object.keys(createInputReader())).toEqual(['read', 'readHead', 'entries', 'walk']);
    expect(Object.keys(createByteInputReader())).toEqual(['read', 'readHead', 'entries', 'walk', 'readBytes']);
  });
});
