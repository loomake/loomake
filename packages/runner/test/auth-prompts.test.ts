import { describe, it, expect, vi } from 'vitest';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });

/** pre-push のフックで message を標準エラーに出して失敗させ、GIT_TERMINAL_PROMPT の値を記録する */
async function pushFailsWith(message: string) {
  const repo: Repo = makeRepo();
  try {
    const hook = join(repo.root, '.git', 'hooks', 'pre-push');
    writeFileSync(hook, `#!/bin/sh\necho "\${GIT_TERMINAL_PROMPT:-unset}" > "${join(repo.base, 'prompt.txt')}"\necho "${message}" >&2\nexit 1\n`);
    chmodSync(hook, 0o755);
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, {}]);
    const out: string[] = [];
    const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (t) => out.push(t), env: repo.env, fileExists: () => false });
    return { code, stdout: out.join('\n'), prompt: readFileSync(join(repo.base, 'prompt.txt'), 'utf8').trim() };
  } finally {
    repo.cleanup();
  }
}

describe('認証や署名の入力による失敗の案内', () => {
  it("[REQ-211] push が認証の入力で失敗したら、git のエラーと credential helper などの案内を理由に添える", async () => {
    const r = await pushFailsWith("fatal: could not read Username for 'https://example.com': terminal prompts disabled");
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('could not read Username');
    expect(r.stdout).toContain('端末での入力ができません');
    expect(r.stdout).toContain('gh auth setup-git');
    expect(r.prompt).toBe('0');
  });

  it('[REQ-211] 認証と関係のない理由で失敗したら、認証の案内は添えない', async () => {
    const r = await pushFailsWith('error: フックで止めました');
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('フックで止めました');
    expect(r.stdout).not.toContain('端末での入力ができません');
  });
});
