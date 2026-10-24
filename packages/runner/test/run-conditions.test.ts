import { describe, expect, it } from 'vitest';
import { readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

async function run(repo: Repo) {
  const output: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false, confirm: async () => false, stdout: (text) => output.push(text), fileExists: () => false });
  return { code, output: output.join('\n') };
}

describe('開始拒否とカスタムの仕様ディレクトリ', () => {
  it('[REQ-094] 未追跡のファイル名を表示し、ブランチとコミットを作らずエンジンを呼ばない', async () => {
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD');
      repo.write('untracked-note.txt', '作業中\n');
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.output).toContain('untracked-note.txt');
      expect(repo.calls()).toEqual([]);
      expect(repo.git('branch', '--list', `loomake/${CHANGE}`)).toBe('');
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
    } finally { repo.cleanup(); }
  });

  it('[REQ-111] openspecDirがspecでもrun全体が仕様変更で停止し、変更とタスクを未コミットのまま残す', async () => {
    const repo = makeRepo();
    try {
      renameSync(join(repo.root, 'openspec'), join(repo.root, 'spec'));
      const config = JSON.parse(readFileSync(join(repo.root, 'loomake.config.json'), 'utf8'));
      repo.write('loomake.config.json', JSON.stringify({ ...config, openspecDir: 'spec' }));
      const path = 'spec/specs/x/spec.md';
      const original = readFileSync(join(repo.root, `spec/changes/${CHANGE}/specs/x/spec.md`), 'utf8');
      repo.write(path, original);
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'カスタムの仕様ディレクトリ');
      const before = repo.git('rev-parse', 'HEAD');
      repo.plan([{ write: { [path]: `${original}\n変更\n` } }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.output).toContain(path);
      expect(result.output).toContain('不正な直し方');
      expect(repo.calls()).toHaveLength(1);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.git('status', '--porcelain')).toContain(path);
      expect(readFileSync(join(repo.root, path), 'utf8')).toBe(`${original}\n変更\n`);
      expect(readFileSync(join(repo.root, `spec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 1.1');
    } finally { repo.cleanup(); }
  });
});
