import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { processState } from './process-state.js';

/** ゾンビの孫を持ったまま止まる子を起動し、孫のPIDを返す。子はSIGCHLDを処理できないので、孫は回収されずゾンビのまま残る */
async function zombieHolder(): Promise<{ holder: ChildProcess; zombie: number }> {
  const source = `const { spawn } = require('node:child_process');
const grandchild = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 200)']);
process.stdout.write(String(grandchild.pid));
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);`;
  const holder = spawn(process.execPath, ['-e', source], { stdio: ['ignore', 'pipe', 'inherit'] });
  const [data] = (await once(holder.stdout!, 'data')) as [Buffer];
  const zombie = Number(data.toString());
  expect(Number.isSafeInteger(zombie) && zombie > 0).toBe(true);
  // 孫が終わるのを待つ
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { holder, zombie };
}

/** Linux 以外の判定経路を Linux で試すため、process.platform を一時的に差し替える */
function withPlatform<T>(platform: NodeJS.Platform, action: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  try { return action(); } finally { Object.defineProperty(process, 'platform', original); }
}

// ps の stat の先頭文字は、macOS でも Linux と同じ意味を持つ。手元は Linux だけなので、Linux で ps の経路を強制して確かめる
describe.runIf(process.platform !== 'win32')('試験用の子プロセスの状態判定', () => {
  const children: ChildProcess[] = [];
  afterEach(async () => {
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
    }
  });

  it('[REQ-207] ps の経路は、回収されていないゾンビを zombie と判定する', async () => {
    const { holder, zombie } = await zombieHolder();
    children.push(holder);
    expect(withPlatform('darwin', () => processState(zombie))).toBe('zombie');
    expect(processState(zombie)).toBe('zombie');
  });

  it('[REQ-207] ps の経路は、終了して回収済みの PID を missing と判定する', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    await once(child, 'exit');
    expect(withPlatform('darwin', () => processState(child.pid))).toBe('missing');
  });

  it('[REQ-207] ps の経路は、動作中のプロセスを running と判定する', () => {
    expect(withPlatform('darwin', () => processState(process.pid))).toBe('running');
    expect(processState(undefined)).toBe('not-started');
  });
});
