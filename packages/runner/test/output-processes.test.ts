import { expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { runClaude } from '../src/engine.js';

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return process.platform !== 'linux' || !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH' || (error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

it.each(['stdout', 'stderr'] as const)('[REQ-151] %sの上限超過でエンジンと終了要求を無視する子を停止する', async (stream) => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-output-process-'));
  const pidFiles = ['engine.pid', 'child.pid'].map((file) => join(root, file));
  try {
    const childSource = "process.on('SIGTERM', () => {}); require('node:fs').writeFileSync('child.pid', String(process.pid)); setTimeout(() => {}, 10000);";
    writeFileSync(join(root, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs');
process.on('SIGTERM', () => {});
fs.writeFileSync('engine.pid', String(process.pid));
require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: ['ignore', 1, 2] });
const poll = setInterval(() => {
  if (fs.existsSync('child.pid')) { clearInterval(poll); process.${stream}.write('x'.repeat(4096)); }
}, 5);
setTimeout(() => { clearInterval(poll); }, 10000);
`);
    chmodSync(join(root, 'claude'), 0o755);
    writeFileSync(join(root, 'claude.cmd'), '@node "%~dp0claude" %*\r\n');
    let stderrBytes = 0;
    const started = Date.now();
    const result = await runClaude({ cwd: root, env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH ?? ''}` }, prompt: '', commands: [], skipPermissions: false, timeoutMs: 15000, maxOutputBytes: 64, onStderr: (text) => { stderrBytes += Buffer.byteLength(text); } });
    expect(result.outputLimitExceeded).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(Buffer.byteLength(result.raw) + stderrBytes).toBeLessThanOrEqual(64);
    expect(Date.now() - started).toBeLessThan(5000);
    for (const file of pidFiles) {
      const pid = Number(readFileSync(file, 'utf8'));
      expect(pid).toBeGreaterThan(0);
      expect(alive(pid)).toBe(false);
    }
  } finally {
    for (const file of pidFiles) {
      if (existsSync(file)) {
        const pid = Number(readFileSync(file, 'utf8'));
        if (pid > 0 && alive(pid)) process.kill(pid, 'SIGKILL');
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 22000);
