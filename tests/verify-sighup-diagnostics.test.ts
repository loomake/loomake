import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it.runIf(process.platform !== 'win32')('SIGHUP smoke の実失敗を保ち、cleanup 前の identity を ready と比較できる', () => {
  const target = mkdtempSync(join(tmpdir(), 'loomake sighup failure '));
  const cli = join(target, 'consumer/node_modules/loomake/dist');
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, '../package.json'), '{"type":"module"}');
  const cliPid = join(target, 'fake-cli.pid');
  writeFileSync(join(cli, 'cli.js'), `
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(cliPid)}, String(process.pid));
spawn('openspec', [], { stdio: 'ignore', detached: true });
process.on('SIGHUP', () => process.exit(42));
setInterval(() => {}, 100);
`);
  const results = join(target, 'verify-sighup-results');
  let failure: unknown;
  try {
    const result = spawnSync(process.execPath, ['scripts/verify-sighup-smoke.mjs', target], { cwd: join(import.meta.dirname, '..'), encoding: 'utf8', timeout: 18000 });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toContain('SIGHUP後にopenspecまたは子が残りました');
    const diagnostic = JSON.parse(readFileSync(join(results, 'probes.json'), 'utf8')) as {
      identities: Array<{ pid: number; phase: string; command?: string; starttime?: string; lstart?: string; error?: string }>;
      events: Array<{ pid: number }>;
    };
    expect(diagnostic.identities).toHaveLength(4);
    expect(diagnostic.identities.map((entry) => entry.phase)).toEqual(['ready', 'ready', 'failure', 'failure']);
    const readyPids = diagnostic.identities.slice(0, 2).map((entry) => entry.pid);
    expect(diagnostic.identities.slice(2).map((entry) => entry.pid)).toEqual(readyPids);
    for (const entry of diagnostic.identities) {
      expect(entry.error).toBeUndefined();
      expect(entry.command).toEqual(expect.any(String));
      expect(entry.starttime ?? entry.lstart).toEqual(expect.any(String));
    }
    expect(diagnostic.events.length).toBeLessThanOrEqual(512);
    expect(diagnostic.events.every((entry) => readyPids.includes(entry.pid))).toBe(true);
    expect(existsSync(join(results, 'results.json'))).toBe(false);
  } catch (error) { failure = error; } finally {
    // この fixture が記録した自分のグループだけを片付ける。
    for (const file of [cliPid, join(results, 'leader.pid')]) {
      try {
        if (!existsSync(file)) continue;
        const pid = Number(readFileSync(file, 'utf8'));
        if (Number.isInteger(pid) && pid > 1) process.kill(-pid, 'SIGKILL');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure ??= error; }
    }
    try { rmSync(target, { recursive: true, force: true }); } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
}, 20000);
