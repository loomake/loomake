import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { runClaude } from '../src/engine.js';

async function invoke(source: string, maxOutputBytes = 64) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-output-'));
  const stderr: string[] = [];
  try {
    writeFileSync(join(root, 'claude'), `#!/usr/bin/env node\n${source}`);
    chmodSync(join(root, 'claude'), 0o755);
    writeFileSync(join(root, 'claude.cmd'), '@node "%~dp0claude" %*\r\n');
    const result = await runClaude({
      cwd: root, env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH ?? ''}` },
      prompt: '', commands: [], skipPermissions: false, timeoutMs: 2000, maxOutputBytes,
      onStderr: (text) => stderr.push(text),
    });
    return { result, stderr: stderr.join('') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('エンジンの出力予算', () => {
  it('[REQ-151] 成功の終了コードでも上限を超えたstdoutを制限する', async () => {
    const { result } = await invoke("process.stdout.write('x'.repeat(200));");
    expect(result.outputLimitExceeded).toBe(true);
    expect(Buffer.byteLength(result.raw)).toBeLessThanOrEqual(64);
    expect(result.timedOut).toBe(false);
  });

  it('[REQ-151] stdoutとstderrの合計を制限する', async () => {
    const { result, stderr } = await invoke("process.stdout.write('a'.repeat(32)); process.stderr.write('b'.repeat(80));");
    expect(result.outputLimitExceeded).toBe(true);
    expect(Buffer.byteLength(result.raw) + Buffer.byteLength(stderr)).toBeLessThanOrEqual(64);
    expect(stderr).not.toBe('');
  });

  it('[REQ-151] UTF-8の途中で切れる文字を保持しない', async () => {
    const { result } = await invoke("process.stdout.write('あ'.repeat(100));");
    expect(result.outputLimitExceeded).toBe(true);
    expect(result.raw).toBe('あ'.repeat(21));
    expect(result.raw).not.toContain('\uFFFD');
  });

  it('[REQ-151] 上限ちょうどと通常の失敗は従来どおり返す', async () => {
    const exact = await invoke("process.stdout.write('x'.repeat(64));");
    expect(exact.result.outputLimitExceeded).toBe(false);
    expect(exact.result.raw.length).toBe(64);
    const failed = await invoke("process.stdout.write('failure'); process.exitCode = 3;");
    expect(failed.result.exitCode).toBe(3);
    expect(failed.result.outputLimitExceeded).toBe(false);
  });
});

describe('エンジンのstderrの保護', () => {
  it('[REQ-153] チャンクをまたぐトークンを転送前に置換する', async () => {
    const token = 'ghp_' + 'x'.repeat(24);
    const source = `process.stderr.write(${JSON.stringify('before ' + token.slice(0, 10))}); setTimeout(() => process.stderr.write(${JSON.stringify(token.slice(10) + ' after\n')}), 20);`;
    const { stderr } = await invoke(source);
    expect(stderr).toBe('before *** after\n');
    expect(stderr).not.toContain(token);
  });
});
