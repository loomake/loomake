import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { withBuildLock } from '../scripts/package-smoke.mjs';

const script = pathToFileURL(join(import.meta.dirname, '../scripts/package-smoke.mjs')).href;
const base = mkdtempSync(join(tmpdir(), 'loomake build lock '));
afterAll(() => rmSync(base, { recursive: true, force: true }));

// 子プロセスとして待ち手を動かす。中の処理に入ったときと出るときに log へ書き、
// 同期点は作業用のディレクトリのファイルで受け渡す（時間には頼らない）
const waiter = `
  import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
  import { join } from 'node:path';
  import { withBuildLock } from ${JSON.stringify(script)};
  const [role, lockDir, dir, mode] = process.argv.slice(1);
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const signal = (name) => writeFileSync(join(dir, name), '');
  const waitFor = (name) => { while (!existsSync(join(dir, name))) sleep(10); };
  const log = (text) => appendFileSync(join(dir, 'log'), text + ' ' + role + '\\n');
  let waited = false;
  withBuildLock(() => {
    log('enter');
    signal(role + '-inside');
    if (mode === 'hold') waitFor(role + '-release');
    else sleep(200);
    log('leave');
  }, { lockDir, pollMs: 10, hooks: {
    beforeTake: (generation) => { if (mode === 'pause-before-take') { signal(role + '-saw-free-' + generation); waitFor(role + '-go'); } },
    afterTake: (generation, taken) => { if (mode === 'pause-before-take') signal(role + '-took-' + generation + '-' + taken); },
    onWait: () => { if (!waited) { waited = true; signal(role + '-waiting'); } },
  } });
`;
const start = (role: string, lockDir: string, dir: string, mode = 'normal') => spawn(process.execPath, ['--input-type=module', '-e', waiter, role, lockDir, dir, mode], { stdio: 'inherit' });
const exited = (child: ChildProcess) => new Promise<number | null>((resolve) => child.on('exit', resolve));
const waitForFile = async (dir: string, name: string) => {
  const until = Date.now() + 20_000;
  while (!existsSync(join(dir, name))) {
    if (Date.now() > until) throw new Error(`${name} が作られませんでした`);
    await delay(10);
  }
};
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;
const writeGeneration = (lockDir: string, generation: number, owner: object) => {
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(join(lockDir, `${generation}.owner`), JSON.stringify(owner));
};
// enter と leave が、同じ待ち手の組で交互に並んでいれば、中の処理は重なっていない
const expectNoOverlap = (log: string, count: number) => {
  const lines = log.trim().split('\n');
  expect(lines).toHaveLength(count * 2);
  for (let i = 0; i < lines.length; i += 2) {
    const role = lines[i].split(' ')[1];
    expect(lines.slice(i, i + 2)).toEqual([`enter ${role}`, `leave ${role}`]);
  }
};

// Issue #34：試験の中の prepare が同時に pnpm -r build を動かすと、tsc が空にした .d.ts をほかの build が読んで落ちる
describe('配布物の準備で build と pack を 1 つずつ動かすロック', () => {
  it('別々のプロセスが同時に取ろうとしても、中の処理は重ならない', async () => {
    const dir = join(base, 'parallel');
    const lockDir = join(dir, 'lock');
    mkdirSync(dir);
    const children = ['P1', 'P2', 'P3', 'P4'].map((role) => exited(start(role, lockDir, dir)));
    expect(await Promise.all(children)).toEqual([0, 0, 0, 0]);
    expectNoOverlap(readFileSync(join(dir, 'log'), 'utf8'), 4);
  }, 30000);

  // PR #107 のレビュー：A と B が同じ古いロックを見て、B が取り直したあとに A が回収を続け、さらに C が来る順序
  it('古いロックを 2 つの待ち手が同時に回収しようとし、3 つ目の待ち手が来ても、中の処理は重ならない', async () => {
    const dir = join(base, 'recovery');
    const lockDir = join(dir, 'lock');
    mkdirSync(dir);
    writeGeneration(lockDir, 1, { pid: deadPid(), token: 'dead', acquiredAt: Date.now() });
    const children: ChildProcess[] = [];
    try {
      // A は持ち主の終わった 1 世代目を見て、次の世代を作る直前で止まる
      const a = start('A', lockDir, dir, 'pause-before-take');
      children.push(a);
      const aExit = exited(a);
      await waitForFile(dir, 'A-saw-free-2');
      // B も同じ古いロックを見て取り直し、中の処理に入ったまま止まる
      const b = start('B', lockDir, dir, 'hold');
      children.push(b);
      const bExit = exited(b);
      await waitForFile(dir, 'B-inside');
      // A が回収を続ける。B の世代はもうあるので、A は取れずに待つ
      writeFileSync(join(dir, 'A-go'), '');
      await waitForFile(dir, 'A-took-2-false');
      await waitForFile(dir, 'A-waiting');
      // C が来ても、B が中にいる間は待つ
      const c = start('C', lockDir, dir);
      children.push(c);
      const cExit = exited(c);
      await waitForFile(dir, 'C-waiting');
      expect(readFileSync(join(dir, 'log'), 'utf8')).toBe('enter B\n');
      writeFileSync(join(dir, 'B-release'), '');
      expect(await Promise.all([aExit, bExit, cExit])).toEqual([0, 0, 0]);
      expectNoOverlap(readFileSync(join(dir, 'log'), 'utf8'), 3);
    } finally {
      // 失敗したときに、止まったままの待ち手を残さない
      for (const child of children) if (child.exitCode === null) child.kill();
    }
  }, 60000);

  it('持ち主のプロセスが終わったロックは、次の世代を作って取り直す', () => {
    const lockDir = join(base, 'dead');
    writeGeneration(lockDir, 1, { pid: deadPid(), token: 'dead', acquiredAt: Date.now() });
    expect(withBuildLock(() => 'done', { lockDir, waitMs: 2000, pollMs: 20 })).toBe('done');
    expect(readdirSync(lockDir).sort()).toEqual(['2.owner', '2.released']);
  });

  it('取ってから期限を過ぎたロックは、持ち主が動いていても次の世代を作って取り直す', () => {
    const lockDir = join(base, 'expired');
    writeGeneration(lockDir, 1, { pid: process.pid, token: 'old', acquiredAt: Date.now() - 10_000 });
    expect(withBuildLock(() => 'done', { lockDir, waitMs: 2000, staleMs: 5000, pollMs: 20 })).toBe('done');
    expect(readdirSync(lockDir).sort()).toEqual(['2.owner', '2.released']);
  });

  it('動いている持ち主のロックは取らず、待つ時間を過ぎたら失敗する', () => {
    const lockDir = join(base, 'busy');
    const owner = JSON.stringify({ pid: process.pid, token: 'busy', acquiredAt: Date.now() });
    writeGeneration(lockDir, 1, JSON.parse(owner) as object);
    let ran = false;
    expect(() => withBuildLock(() => { ran = true; }, { lockDir, waitMs: 200, pollMs: 20 })).toThrow('build のロックを');
    expect(ran).toBe(false);
    expect(readdirSync(lockDir)).toEqual(['1.owner']);
    expect(readFileSync(join(lockDir, '1.owner'), 'utf8')).toBe(owner);
  });

  it('中の処理が失敗してもロックを解放し、次の待ち手が取れる', () => {
    const lockDir = join(base, 'failed');
    expect(() => withBuildLock(() => { throw new Error('build failed'); }, { lockDir })).toThrow('build failed');
    expect(existsSync(join(lockDir, '1.released'))).toBe(true);
    expect(withBuildLock(() => 'next', { lockDir, waitMs: 2000 })).toBe('next');
  });
});
