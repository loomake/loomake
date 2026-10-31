import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../src/index.js';

describe('sha256Hex', () => {
  it('[REQ-319] 既知の値と同じ SHA-256 を小文字の 16 進で返す', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
