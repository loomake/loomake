import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExternal, withProcessBudget } from '../src/runtime/process.js';

describe('タイマーの上限を超える有限の期限', () => {
  it.each(['qualityCommand', 'untilDeadline'] as const)('[REQ-180][REQ-182] %sで上限を超える残り時間を短縮せず、通常の結果を保つ', (kind) => {
    const duration = 2_147_483_647 + 60_000;
    const result = withProcessBudget({ timeoutMs: duration, maxOperationMs: 1 }, () =>
      runExternal(process.execPath, ['-e', 'setTimeout(()=>{console.log("期限内");process.exitCode=7},50)'], { [kind]: true, timeoutMs: duration }));
    expect(result.status).toBe(7);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe('期限内\n');
    expect(result.stderr).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('[REQ-180][REQ-182] 分割した待機が期限前に発火しても、残り時間を確認して待ち直す', () => {
    const directory = mkdtempSync(join(tmpdir(), 'loomake-long-deadline '));
    try {
      const log = join(directory, 'waits.json');
      const preload = join(directory, 'early-timer.cjs');
      writeFileSync(preload, `if (process.argv[1]?.endsWith('supervisor.cjs')) {
        const fs = require('node:fs');
        const nativeTimeout = global.setTimeout;
        const waits = [];
        global.setTimeout = (callback, ms, ...args) => {
          if (ms > 1000) {
            waits.push(ms); fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(waits));
            return nativeTimeout(callback, waits.length <= 2 ? 1 : ms, ...args);
          }
          return nativeTimeout(callback, ms, ...args);
        };
      }`);
      const result = runExternal(process.execPath, ['-e', 'setTimeout(()=>console.log("期限内"),50)'], {
        untilDeadline: true, timeoutMs: 2_147_483_647 + 60_000,
        env: { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('期限内\n');
      expect(result.stderr).toBe('');
      const waits = JSON.parse(readFileSync(log, 'utf8')) as number[];
      expect(waits).toHaveLength(3);
      expect(waits.every((ms) => ms > 0 && ms <= 2_147_483_647)).toBe(true);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
