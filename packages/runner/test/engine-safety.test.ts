import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { runClaude } from '../src/engine.js';
import { killOwnedProcess, processState } from './process-state.js';

vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
beforeEach(() => { vi.mocked(spawn).mockClear(); });

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

async function invoke(source: string, signal?: AbortSignal) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-engine-safety-'));
  const pid = (name: string) => {
    const file = join(root, name);
    if (!existsSync(file)) return undefined;
    const value = Number(readFileSync(file, 'utf8'));
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid fixture PID: ${name}`);
    return value;
  };
  try {
    const entry = join(root, 'claude');
    writeFileSync(entry, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync('engine.pid', String(process.pid));\n${source}\n`);
    chmodSync(entry, 0o755);
    writeFileSync(`${entry}.cmd`, '@node "%~dp0claude" %*\r\n');
    const start = Date.now();
    const result = await runClaude({
      cwd: root,
      env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH ?? ''}` },
      prompt: 'test', commands: [], skipPermissions: false, timeoutMs: 500, signal,
    });
    const enginePid = pid('engine.pid');
    const childPid = pid('child.pid');
    return {
      result, elapsed: Date.now() - start, started: existsSync(join(root, 'started')),
      enginePid, childPid, engineState: processState(enginePid), childState: processState(childPid),
      termReceived: existsSync(join(root, 'term-received')), spawnCount: vi.mocked(spawn).mock.calls.length,
    };
  } finally {
    for (const name of ['child.pid', 'engine.pid']) {
      killOwnedProcess(pid(name));
    }
    rmSync(root, { recursive: true, force: true });
  }
}

describe('エンジンの停止', () => {
  it('[REQ-139] 出力を継承した子も時間切れで停止する', async () => {
    const childSource = "require('node:fs').writeFileSync('child.pid', String(process.pid)); setTimeout(() => {}, 2500);";
    const { result, elapsed, enginePid, childPid, engineState, childState, spawnCount } = await invoke(`
const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: ['ignore', 1, 2] });
setTimeout(() => {}, 2500);`);
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(1800);
    expect(spawnCount).toBe(1);
    expect(enginePid).toBeGreaterThan(0);
    expect(childPid).toBeGreaterThan(0);
    expect(engineState).toBe('missing');
    // 戻った時点で子は消滅・ゾンビ・終了途中のいずれかで、利用者のコードを実行できない状態にある
    expect(['missing', 'zombie', 'exiting']).toContain(childState);
  });

  it('[REQ-139] 終了要求を無視するエンジンも強制終了する', async () => {
    const { result, elapsed, enginePid, engineState, termReceived, spawnCount } = await invoke(`
process.on('SIGTERM', () => { require('node:fs').writeFileSync('term-received', 'yes'); });
setTimeout(() => {}, 2500);`);
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(1800);
    expect(spawnCount).toBe(1);
    expect(enginePid).toBeGreaterThan(0);
    expect(engineState).toBe('missing');
    expect(result.exitCode).not.toBe(0);
    if (process.platform !== 'win32') expect(termReceived).toBe(true);
  });

  it('[REQ-139] 起動前に中断済みならエンジンを起動しない', async () => {
    const signal = AbortSignal.abort();
    const { result, started, enginePid, spawnCount } = await invoke("require('node:fs').writeFileSync('started', 'yes');", signal);
    expect(result.aborted).toBe(true);
    expect(started).toBe(false);
    expect(enginePid).toBeUndefined();
    expect(spawnCount).toBe(0);
  });
});
