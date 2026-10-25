import { expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
const names = process.platform === 'win32' ? ['日本語 空白'] : ['日本語 空白', 'tab\tname', 'line\nname'];

it.each(names)('[REQ-138] %jの違反でrun全体が停止し、コミットとタスクを進めない', async (name) => {
  const repo = makeRepo();
  try {
    const spec = `openspec/specs/${name}/spec.md`;
    const test = `tests/${name}.test.ts`;
    repo.write(spec, 'before\n');
    repo.write(test, "it('case', () => {});\n");
    repo.git('add', '-A');
    repo.git('commit', '-qm', '特殊文字のパス');
    const before = repo.git('rev-parse', 'HEAD');
    repo.plan([{ write: { [spec]: 'after\n' }, delete: [test] }]);
    const out: string[] = [];
    const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false,
      confirm: async () => false, stdout: (text) => out.push(text), fileExists: () => false });
    expect(code).toBe(1);
    expect(out.join('\n')).toContain(`${spec}：いまの仕様を変えました`);
    expect(out.join('\n')).toContain(`${test}：テストファイルを消しました`);
    expect(repo.calls()).toHaveLength(1);
    expect(repo.git('rev-parse', 'HEAD')).toBe(before);
    expect(repo.git('diff', '--cached', '--name-only')).toBe('');
    expect(readFileSync(join(repo.root, spec), 'utf8')).toBe('after\n');
    expect(existsSync(join(repo.root, test))).toBe(false);
    expect(readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 1.1');
  } finally {
    repo.cleanup();
  }
});
