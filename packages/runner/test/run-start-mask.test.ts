import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main } from '../../cli/src/main.js';
import { CHANGE, makeRepo } from './helpers.js';

const fault = vi.hoisted(() => ({ phase: '', stderr: '', hits: 0, heldLock: false }));
vi.mock('../../kit/src/runtime/process.js', async (original) => {
  const real = await original<typeof import('../../kit/src/runtime/process.js')>();
  return {
    ...real,
    runExternal: (...input: Parameters<typeof real.runExternal>) => {
      const [command, args, options] = input;
      const target = fault.phase === 'lock'
        ? args[0] === 'rev-parse' && args.includes('--absolute-git-dir')
        : fault.phase === 'prepare' && args[0] === 'status';
      if (command === 'git' && target) {
        fault.hits++;
        fault.heldLock = existsSync(join(options!.cwd!, '.git/loomake-run.lock'));
        return { status: 1, signal: null, stdout: '', stderr: fault.stderr };
      }
      return real.runExternal(...input);
    },
  };
});

const token = 'ghp_' + 'x'.repeat(24);
const bearer = 'Z'.repeat(24);
const ordinary = 'fatal: 合成の診断（秘密なし）Bearer の語だけ';
const cases = ['lock', 'prepare'].flatMap((phase) => [true, false].map((secret) => ({ phase, secret })));

describe('開始前のGit診断の表示', () => {
  it.each(cases)('[REQ-154][REQ-199][REQ-137] $phase の合成秘密=$secret で表示と停止を保つ', async ({ phase, secret }) => {
    const repo = makeRepo();
    const saved = { ...process.env };
    try {
      Object.assign(fault, { phase, stderr: secret ? `fatal: 合成の失敗 ${token}\nAuthorization: Bearer ${bearer}` : ordinary, hits: 0, heldLock: false });
      Object.assign(process.env, repo.env);
      const out: string[] = [];
      const err: string[] = [];
      const code = await main(['run', '--change', CHANGE], {
        cwd: repo.root, stdout: (text) => out.push(text), stderr: (text) => err.push(text),
      });
      const displayed = err.join('\n');
      expect(fault.hits).toBe(1);
      expect(fault.heldLock).toBe(phase === 'prepare');
      expect(code).toBe(2);
      expect(displayed).toContain('loomake run: git の操作に失敗しました：git ' + (phase === 'lock' ? 'rev-parse --absolute-git-dir' : 'status --porcelain --untracked-files=all'));
      expect(displayed).toContain('使い方: ');
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
      // calls()は実装本体だけを記録し、prepareのclaude --versionは含まない。
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.git/loomake-run.lock'))).toBe(false);
      expect(existsSync(join(repo.root, '.git/loomake-run.lock.recovery'))).toBe(false);
      if (secret) {
        expect(displayed).not.toContain(token);
        expect(displayed).not.toContain(bearer);
        expect(displayed).toContain('合成の失敗 ***');
        expect(displayed).toContain('Authorization: Bearer ***');
      } else {
        expect(displayed).toContain(ordinary);
        expect(displayed).not.toContain('***');
      }
      expect(out).toEqual([]);
    } finally {
      fault.phase = '';
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
      repo.cleanup();
    }
  });
});
