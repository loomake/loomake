import { describe, it, expect, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, noChange } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });

/**
 * 品質コマンドは同期的に動くので、そのあいだに届いた信号の処理は、イベントループに戻るまで実行されない。
 * when に一致する進捗が出た時点で setImmediate で中断を予約し、この遅れをまねる
 */
async function abortDuring(when: (text: string, count: number) => boolean, lookup = false) {
  const repo = makeRepo();
  try {
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
    const controller = new AbortController();
    let count = 0;
    // lookup のときは、偽の gh が PR を検索した記録を見て中断を予約する。検索は同期的に動くので、記録を見られるのは検索のあと
    const watcher = lookup ? setInterval(() => { if (existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)) controller.abort(); }, 1) : undefined;
    const out: string[] = [];
    const code = await runRun({
      root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, env: repo.env, fileExists: () => false,
      stdout: (t) => out.push(t),
      progress: (t) => { if (t.startsWith('… test') && when(t, ++count)) setImmediate(() => controller.abort()); },
      signal: controller.signal,
    });
    clearInterval(watcher);
    const runs = join(repo.root, '.loomake/runs');
    const [run] = readdirSync(runs).filter((n) => n !== '.gitignore');
    const summary = JSON.parse(readFileSync(join(runs, run, 'summary.json'), 'utf8'));
    const pushed = repo.git('ls-remote', '--heads', 'origin').trim();
    return { code, stdout: out.join('\n'), summary, prs: repo.prs(), pushed };
  } finally {
    repo.cleanup();
  }
}

describe('同期の処理のあいだに届いた中断', () => {
  it('[REQ-208] 完了ゲートの品質コマンドのあいだに届いた中断で、証拠の記録・push・PR の作成に進まない', async () => {
    const r = await abortDuring((_t, count) => count === 1);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
    expect(r.pushed).toBe('');
  });

  it('[REQ-208] 証拠の記録の品質コマンドのあいだに届いた中断で、push と PR の作成に進まない', async () => {
    const r = await abortDuring((_t, count) => count === 2);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
    expect(r.pushed).toBe('');
  });

  it('[REQ-208] 既存の PR の検索のあいだに届いた中断で、PR を作らない', async () => {
    const r = await abortDuring(() => false, true);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
  });
});
