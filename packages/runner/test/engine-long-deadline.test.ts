import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { runClaude } from '../src/engine.js';
import { CHANGE, makeRepo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
const MAX_TIMER_MS = 2_147_483_647;

async function invoke() {
  const repo = makeRepo();
  try {
    repo.plan([{ sleepMs: 300, output: '完了' }]);
    return await runClaude({ cwd: repo.root, env: repo.env, prompt: '試験', commands: [], skipPermissions: false, timeoutMs: MAX_TIMER_MS + 60_000 });
  } finally { repo.cleanup(); }
}

describe('エンジンのタイマーの上限', () => {
  it('[REQ-336] タイマーの上限を超える時間の上限でも、時間内に終えたエンジンの結果を保つ', async () => {
    const warnings: Error[] = [];
    const warning = (value: Error) => warnings.push(value);
    process.on('warning', warning);
    try {
      const result = await invoke();
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(result.text).toBe('完了');
      expect(warnings.filter((value) => value.name === 'TimeoutOverflowWarning')).toHaveLength(0);
    } finally { process.off('warning', warning); }
  });

  it('[REQ-336] 分割した待機が期限前に発火しても、残り時間を確かめて待ち直す', async () => {
    const nativeTimeout = globalThis.setTimeout;
    const nativeClearTimeout = globalThis.clearTimeout;
    const waits: number[] = [];
    const scheduled: NodeJS.Timeout[] = [];
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]) => {
      if (ms > 1000) {
        waits.push(ms);
        const handle = nativeTimeout(callback, waits.length <= 2 ? 1 : ms, ...args);
        scheduled.push(handle);
        return handle;
      }
      return nativeTimeout(callback, ms, ...args);
    }) as typeof setTimeout);
    let result;
    try {
      result = await invoke();
      expect(cleared).toHaveBeenCalledWith(scheduled.at(-1));
    } finally {
      timer.mockRestore();
      cleared.mockRestore();
      for (const handle of scheduled) nativeClearTimeout(handle);
    }
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.text).toBe('完了');
    expect(waits).toHaveLength(3);
    expect(waits.every((ms) => ms > 0 && ms <= MAX_TIMER_MS)).toBe(true);
  });

  it('[REQ-336] run.timeoutMinutes がタイマーの上限を超えても、エンジンをすぐに時間切れにしない', async () => {
    const repo = makeRepo({ run: { timeoutMinutes: 40_000 } });
    try {
      repo.plan([{ write: { 'impl.txt': '実装\n' }, sleepMs: 500 }, {}]);
      const output: string[] = [];
      const code = await runRun({ root: repo.root, env: repo.env, changeId: CHANGE, interactive: false, confirm: async () => false, fileExists: () => false, stdout: (text) => output.push(text) });
      const directory = join(repo.root, '.loomake/runs');
      const [run] = readdirSync(directory).filter((name) => name !== '.gitignore');
      const summary = JSON.parse(readFileSync(join(directory, run, 'summary.json'), 'utf8'));
      expect(code).toBe(0);
      expect(summary.status).toBe('completed');
      expect(repo.git('log', '--format=%s')).toContain('run(c1): 1.1');
      expect(output.join('\n')).not.toContain('実行時間の上限');
    } finally { repo.cleanup(); }
  });
});
