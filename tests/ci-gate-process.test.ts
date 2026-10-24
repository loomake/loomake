import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const gate = join(import.meta.dirname, '..', 'scripts', 'ci-gate.mjs');

function withProject(check: (project: {
  dir: string;
  commitFiles: (files: string[]) => void;
  run: (branch: string, body?: string, statuses?: Record<string, number>) => { status: number | null; stderr: string; calls: string[][] };
}) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-ci-process-'));
  const callsFile = join(dir, 'calls.jsonl');
  const git = (...args: string[]) => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=', ...args], { cwd: dir, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  };
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
    const cli = join(dir, 'packages', 'cli', 'dist', 'cli.js');
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(cli, `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.CI_CALLS_FILE, JSON.stringify(args) + '\\n');
const id = args.includes('--change') ? args[args.indexOf('--change') + 1] : 'quality';
process.exit(JSON.parse(process.env.CI_STATUSES)[id] ?? 0);
`);
    for (const id of ['c1', 'c2', 'setup-monorepo']) {
      const change = join(dir, 'openspec', 'changes', id);
      mkdirSync(change, { recursive: true });
      writeFileSync(join(change, 'tasks.md'), '- [x] baseline\n');
    }
    git('init', '-q');
    git('config', 'user.name', 'Loomake Test');
    git('config', 'user.email', 'test@example.invalid');
    git('add', '.');
    git('commit', '-qm', 'baseline');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    check({
      dir,
      commitFiles(files) {
        for (const file of files) {
          mkdirSync(dirname(join(dir, file)), { recursive: true });
          writeFileSync(join(dir, file), 'changed\n');
        }
        git('add', '-A');
        git('commit', '-qm', 'change');
      },
      run(branch, body = '', statuses = {}) {
        const result = spawnSync(process.execPath, [gate, branch], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, BASE_REF: 'main', PR_BODY: body, PR_NUMBER: '', CI_CALLS_FILE: callsFile, CI_STATUSES: JSON.stringify(statuses) },
        });
        const calls = existsSync(callsFile) ? readFileSync(callsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string[]) : [];
        return { status: result.status, stderr: result.stderr, calls };
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const done = (id: string) => ['verify', '--change', id, '--done'];

describe('実際のCIゲートの子プロセスの契約', () => {
  it.each(['setup-monorepo', 'loomake/c1'])('[REQ-010][REQ-054][REQ-132] ブランチ%sで指定どおりの完了ゲートを呼び、失敗を伝える', (branch) => {
    withProject(({ run }) => {
      const id = branch.replace(/^loomake\//, '');
      const result = run(branch, '', { [id]: 9 });
      expect(result.calls).toEqual([done(id)]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-010][REQ-132] 複数のchangeの明示で両方の完了ゲートを呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/a.ts']);
      const result = run('fix-typo', 'loomake-change: c1, c2');
      expect(result.calls).toEqual([done('c1'), done('c2')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] 最初のchangeが失敗しても次を検査し、全体を不合格にする', () => {
    withProject(({ run }) => {
      const result = run('fix-typo', 'loomake-change: c1, c2', { c1: 7 });
      expect(result.calls).toEqual([done('c1'), done('c2')]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-010][REQ-132] 明示したchangeがなければverifyを呼ぶ前に日本語で止まる', () => {
    withProject(({ run }) => {
      const result = run('fix-typo', 'loomake-change: nothing');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PR 本文の loomake-change: に書いた change がありません：nothing');
      expect(result.calls).toEqual([]);
    });
  });

  it('[REQ-010][REQ-132] noneの明示があればコードの変更でも品質コマンドだけを呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/a.ts']);
      const result = run('fix-typo', 'loomake-change: none');
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] 変更したchangeのファイルから完了ゲートを選ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c1/tasks.md', 'packages/a.ts']);
      const result = run('feature-x');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it.each([{ files: ['packages/a.ts'] }, { files: ['docs/usage.md', 'packages/a.ts'] }])('[REQ-010][REQ-132] 対象未指定のコードファイル$filesがあればverifyを呼ぶ前に止まる', ({ files }) => {
    withProject(({ commitFiles, run }) => {
      commitFiles(files);
      const result = run('fix-typo');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PR 本文に「loomake-change: <change-id>」の行を書いてください');
      expect(result.calls).toEqual([]);
    });
  });

  it.each([{ files: ['docs/usage.md'] }, { files: ['README.md', '.changeset/x.md'] }])('[REQ-010][REQ-132] 文書ファイル$filesの変更では品質コマンドだけを呼ぶ', ({ files }) => {
    withProject(({ commitFiles, run }) => {
      commitFiles(files);
      const result = run('fix-typo');
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] archive時の削除とarchive・specの追加では品質コマンドだけを呼ぶ', () => {
    withProject(({ dir, commitFiles, run }) => {
      rmSync(join(dir, 'openspec', 'changes', 'c1'), { recursive: true });
      commitFiles(['openspec/changes/archive/2026-10-24-c1/tasks.md', 'openspec/specs/x/spec.md']);
      const result = run('archive-c1');
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-132] 明示した選択を変更ファイルとブランチの選択より優先する', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c2/tasks.md']);
      const result = run('c2', 'loomake-change: c1');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-132] 変更ファイルとブランチの選択を合わせて両方のゲートを呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c1/tasks.md']);
      const result = run('c2');
      expect(result.calls).toEqual([done('c1'), done('c2')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] 品質コマンドだけの検査でも非ゼロ終了を伝える', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['README.md']);
      const result = run('fix-typo', '', { quality: 7 });
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(7);
    });
  });
});
