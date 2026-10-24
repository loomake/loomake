import { describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { runClaude } from '../src/engine.js';

async function invoke(source: string, signal?: AbortSignal) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-engine-safety-'));
  try {
    const entry = join(root, 'claude');
    writeFileSync(entry, `#!/usr/bin/env node\n${source}\n`);
    chmodSync(entry, 0o755);
    writeFileSync(`${entry}.cmd`, '@node "%~dp0claude" %*\r\n');
    const start = Date.now();
    const result = await runClaude({
      cwd: root,
      env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH ?? ''}` },
      prompt: 'test', commands: [], skipPermissions: false, timeoutMs: 500, signal,
    });
    return { result, elapsed: Date.now() - start, started: existsSync(join(root, 'started')) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('エンジンの停止', () => {
  it('[REQ-139] 出力を継承した子も時間切れで停止する', async () => {
    const { result, elapsed } = await invoke(`
const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', 'setTimeout(() => {}, 2500)'], { stdio: ['ignore', 1, 2] });
setTimeout(() => {}, 2500);`);
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(1800);
  });

  it('[REQ-139] 終了要求を無視するエンジンも強制終了する', async () => {
    const { result, elapsed } = await invoke(`
process.on('SIGTERM', () => {});
setTimeout(() => {}, 2500);`);
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(1800);
  });

  it('[REQ-139] 起動前に中断済みならエンジンを起動しない', async () => {
    const signal = AbortSignal.abort();
    const { result, started } = await invoke("require('node:fs').writeFileSync('started', 'yes');", signal);
    expect(result.aborted).toBe(true);
    expect(started).toBe(false);
  });
});
