import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRun, type RunOptions } from '@loomake/runner';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

// run.test.ts と run-timeout.test.ts が共有する、run を呼ぶ試験の補助

export async function run(repo: Repo, opts: Partial<RunOptions> = {}) {
  const out: string[] = [];
  const code = await runRun({
    root: repo.root,
    changeId: CHANGE,
    interactive: false,
    confirm: async () => false,
    stdout: (t) => out.push(t),
    env: repo.env,
    fileExists: () => false,
    ...opts,
  });
  return { code, stdout: out.join('\n') };
}

export const tasksMd = (repo: Repo) => readFileSync(join(repo.root, 'openspec/changes', CHANGE, 'tasks.md'), 'utf8');

export async function withRepo(fn: (repo: Repo) => Promise<void>, init?: Parameters<typeof makeRepo>[0]) {
  const repo = makeRepo(init);
  try {
    await fn(repo);
  } finally {
    repo.cleanup();
  }
}
