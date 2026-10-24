import { describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { runClaude, type EngineResult } from '../src/engine.js';

function state(pid: number): 'missing' | 'zombie' | 'running' {
  try { process.kill(pid, 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return 'missing'; throw error; }
  if (process.platform === 'linux') {
    try { if (/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return 'zombie'; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing'; throw error; }
  }
  return 'running';
}

function killOwnedChild(root: string): void {
  const file = join(root, 'child.pid');
  if (!existsSync(file)) return;
  const pid = Number(readFileSync(file, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0 || state(pid) !== 'running') return;
  try { process.kill(pid, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}

async function withEngine(source: string, check: (root: string, result: EngineResult, elapsed: number) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-engine-normal-exit-'));
  try {
    const entry = join(root, 'claude');
    writeFileSync(entry, `#!/usr/bin/env node\n${source}\n`);
    chmodSync(entry, 0o755);
    const started = Date.now();
    const result = await runClaude({
      cwd: root, env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH ?? ''}` },
      prompt: 'normal exit', commands: [], skipPermissions: false, timeoutMs: 2000,
    });
    await check(root, result, Date.now() - started);
  } finally {
    killOwnedChild(root);
    rmSync(root, { recursive: true, force: true });
  }
}

function parentSource(ignoreTerm: boolean, inheritOutput: boolean): string {
  const child = `const fs = require('node:fs');
process.on('SIGTERM', () => { fs.writeFileSync('term-received', 'yes'); ${ignoreTerm ? '' : 'process.exit(0);'} });
fs.writeFileSync('child.pid', String(process.pid));
fs.writeFileSync('child.ready', 'ready');
setTimeout(() => fs.writeFileSync('delayed-marker', 'late write'), 900);
setInterval(() => {}, 1000);`;
  return `const fs = require('node:fs');
const child = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(child)}], { stdio: ${inheritOutput ? "['ignore', 1, 2]" : "'ignore'"}, detached: false });
const ready = setInterval(() => {
  if (!fs.existsSync('child.ready')) return;
  clearInterval(ready);
  process.stdout.write(JSON.stringify({ result: 'normal result' }), () => process.exit(0));
}, 5);`;
}

function expectNormal(result: EngineResult, exitCode: number, raw: string, text: string) {
  expect(result.exitCode).toBe(exitCode);
  expect(result.raw).toBe(raw);
  expect(result.text).toBe(text);
  expect(result.timedOut).toBe(false);
  expect(result.aborted).toBe(false);
  expect(result.outputLimitExceeded).toBe(false);
}

// 今回追加する保証はPOSIXに限り、対応しない環境ではskipとして報告する。
describe.runIf(process.platform !== 'win32')('POSIXエンジンの正常終了後の後処理', () => {
  it.each([
    { name: '標準入出力を共有しない子', ignoreTerm: false, inheritOutput: false },
    { name: 'SIGTERMを無視し標準入出力を共有しない子', ignoreTerm: true, inheritOutput: false },
    { name: 'SIGTERMを無視し出力を共有する子', ignoreTerm: true, inheritOutput: true },
  ])('[REQ-207] 戻る前に $name を停止し、遅延書き込みを防ぐ', async ({ ignoreTerm, inheritOutput }) => {
    await withEngine(parentSource(ignoreTerm, inheritOutput), async (root, result) => {
      expect(readFileSync(join(root, 'child.ready'), 'utf8')).toBe('ready');
      const pid = Number(readFileSync(join(root, 'child.pid'), 'utf8'));
      expect(Number.isSafeInteger(pid)).toBe(true);
      expect(pid).toBeGreaterThan(0);
      const stateAtReturn = state(pid);
      const markerAtReturn = existsSync(join(root, 'delayed-marker'));
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const markerAfterReturn = existsSync(join(root, 'delayed-marker'));
      expect(['missing', 'zombie']).toContain(stateAtReturn);
      expect(markerAtReturn).toBe(false);
      expect(markerAfterReturn).toBe(false);
      expect(readFileSync(join(root, 'term-received'), 'utf8')).toBe('yes');
      expectNormal(result, 0, '{"result":"normal result"}', 'normal result');
    });
  });

  it('[REQ-207] 通常のJSON出力と終了コード0を保ち、停止フラグを付けない', async () => {
    await withEngine("process.stdout.write('{\"result\":\"control\"}', () => process.exit(0));", async (_root, result) => {
      expectNormal(result, 0, '{"result":"control"}', 'control');
    });
  });

  it('[REQ-207] 非ゼロの終了コードと生の出力を保ち、停止フラグを付けない', async () => {
    await withEngine("process.stdout.write('plain failure', () => process.exit(1));", async (_root, result) => {
      expectNormal(result, 1, 'plain failure', 'plain failure');
    });
  });
});
