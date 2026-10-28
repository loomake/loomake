import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBuildLock } from '../scripts/package-smoke.mjs';

const script = pathToFileURL(join(import.meta.dirname, '../scripts/package-smoke.mjs')).href;
const base = mkdtempSync(join(tmpdir(), 'loomake build lock '));
afterAll(() => rmSync(base, { recursive: true, force: true }));

// Issue #34：試験の中の prepare が同時に pnpm -r build を動かすと、tsc が空にした .d.ts をほかの build が読んで落ちる
describe('配布物の準備で build と pack を 1 つずつ動かすロック', () => {
  it('別々のプロセスが同時に取ろうとしても、中の処理は重ならない', async () => {
    const lockDir = join(base, 'parallel', 'build.lock');
    const log = join(base, 'parallel.log');
    writeFileSync(log, '');
    const code = `
      import { appendFileSync } from 'node:fs';
      import { withBuildLock } from ${JSON.stringify(script)};
      const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      withBuildLock(() => {
        appendFileSync(${JSON.stringify(log)}, 'enter ' + process.pid + '\\n');
        sleep(300);
        appendFileSync(${JSON.stringify(log)}, 'leave ' + process.pid + '\\n');
      }, { lockDir: ${JSON.stringify(lockDir)}, pollMs: 20 });
    `;
    const children = Array.from({ length: 4 }, () => new Promise<number | null>((resolve) => {
      spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: 'inherit' }).on('exit', resolve);
    }));
    expect(await Promise.all(children)).toEqual([0, 0, 0, 0]);
    const lines = readFileSync(log, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(8);
    for (let i = 0; i < lines.length; i += 2) {
      const pid = lines[i].split(' ')[1];
      expect(lines.slice(i, i + 2)).toEqual([`enter ${pid}`, `leave ${pid}`]);
    }
    expect(existsSync(lockDir)).toBe(false);
  }, 30000);

  it('持ち主のプロセスが終わったロックは外して取り直す', () => {
    const lockDir = join(base, 'dead', 'build.lock');
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: dead, token: 'dead', acquiredAt: Date.now() }));
    expect(withBuildLock(() => 'done', { lockDir, waitMs: 2000, pollMs: 20 })).toBe('done');
    expect(existsSync(lockDir)).toBe(false);
  });

  it('取ってから期限を過ぎたロックは、持ち主が動いていても外して取り直す', () => {
    const lockDir = join(base, 'expired', 'build.lock');
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'old', acquiredAt: Date.now() - 10_000 }));
    expect(withBuildLock(() => 'done', { lockDir, waitMs: 2000, staleMs: 5000, pollMs: 20 })).toBe('done');
    expect(existsSync(lockDir)).toBe(false);
  });

  it('動いている持ち主のロックは外さず、待つ時間を過ぎたら失敗する', () => {
    const lockDir = join(base, 'busy', 'build.lock');
    mkdirSync(lockDir, { recursive: true });
    const owner = JSON.stringify({ pid: process.pid, token: 'busy', acquiredAt: Date.now() });
    writeFileSync(join(lockDir, 'owner.json'), owner);
    let ran = false;
    expect(() => withBuildLock(() => { ran = true; }, { lockDir, waitMs: 200, pollMs: 20 })).toThrow('build のロックを');
    expect(ran).toBe(false);
    expect(readFileSync(join(lockDir, 'owner.json'), 'utf8')).toBe(owner);
  });

  it('中の処理が失敗してもロックを外す', () => {
    const lockDir = join(base, 'failed', 'build.lock');
    expect(() => withBuildLock(() => { throw new Error('build failed'); }, { lockDir })).toThrow('build failed');
    expect(existsSync(lockDir)).toBe(false);
  });
});
