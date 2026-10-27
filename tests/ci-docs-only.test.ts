import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { decideDocsOnly, isDocumentPath, parseNameStatus } from '../scripts/ci-docs-only.mjs';

const script = join(import.meta.dirname, '..', 'scripts', 'ci-docs-only.mjs');

// 差分を返すだけの偽の git。呼ばれた引数を記録する
const fakeGit = (stdout: string, status = 0, stderr = '') => {
  const calls: string[][] = [];
  const git = (args: string[]) => {
    calls.push(args);
    return { status, stdout, stderr };
  };
  return { git, calls };
};
const nameStatus = (...entries: string[][]) => entries.map((entry) => entry.join('\0') + '\0').join('');
const decide = (stdout: string, status = 0) => decideDocsOnly({ eventName: 'pull_request', baseRef: 'main', git: fakeGit(stdout, status).git });

describe('文書として扱うファイル', () => {
  it('[REQ-270] 直下・docs/・openspec/ の .md、change の spec-gate.txt、changeset の本文は文書として扱う', () => {
    for (const path of [
      'README.md',
      'CONTRIBUTING.md',
      'docs/worklog/2026-10-27.md',
      'docs/quality/scenario-audit.md',
      'openspec/specs/monorepo/spec.md',
      'openspec/changes/c1/tasks.md',
      'openspec/changes/c1/specs/monorepo/spec.md',
      'openspec/changes/c1/spec-gate.txt',
      'openspec/changes/archive/2026-10-27-c1/proposal.md',
      '.changeset/c1.md',
    ]) expect(isDocumentPath(path), path).toBe(true);
  });

  it('[REQ-270] コードと配布する Markdown は文書として扱わない', () => {
    for (const path of ['packages/kit/src/verify/run.ts', 'packages/kit/templates/AGENTS.md', 'packages/cli/README.md']) expect(isDocumentPath(path), path).toBe(false);
  });

  it('[REQ-270] 設定と実行用のファイルは、文書の置き場所にあっても文書として扱わない', () => {
    for (const path of [
      '.changeset/config.json',
      'openspec/config.yaml',
      'docs/wbs/initial-status.yaml',
      'docs/quality/scenarios.json',
      'docs/site.yml',
      'scripts/ci-gate.mjs',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/workflows/ci.yml',
      'openspec/changes/archive/2026-10-24-c1/check.mjs',
      'openspec/changes/c1/notes.txt',
      '.changeset/nested/c1.md',
      'package.json',
    ]) expect(isDocumentPath(path), path).toBe(false);
  });

  it('[REQ-270] tests/ の下の試験用データは、.md でも文書として扱わない', () => {
    expect(isDocumentPath('tests/fixtures/verify-project/openspec/changes/sample/tasks.md')).toBe(false);
    expect(isDocumentPath('tests/fixtures/README.md')).toBe(false);
  });

  it('[REQ-270] 読めないパスは文書として扱わない', () => {
    for (const path of ['', 'docs\\a.md', 'docs/../packages/a.md', './README.md', 'docs//a.md']) expect(isDocumentPath(path), path).toBe(false);
  });
});

describe('文書だけかの判定', () => {
  it('[REQ-270] 変えたファイルがすべて文書なら、文書だけと判定する', () => {
    const { git, calls } = fakeGit(nameStatus(['M', 'docs/worklog/2026-10-27.md'], ['A', 'openspec/changes/c1/tasks.md'], ['A', '.changeset/c1.md']));
    expect(decideDocsOnly({ eventName: 'pull_request', baseRef: 'main', git })).toMatchObject({ docsOnly: true });
    // ベースから PR の先頭までの差分を、名前の変更を検出して読む
    expect(calls).toEqual([['diff', '--name-status', '-z', '-M', 'origin/main...HEAD']]);
  });

  it('[REQ-270] コード・配布する Markdown・設定・試験用データを 1 つでも含めば、文書だけと判定しない', () => {
    for (const path of ['packages/kit/src/verify/run.ts', 'packages/kit/templates/AGENTS.md', '.changeset/config.json', 'openspec/config.yaml', 'docs/wbs/initial-status.yaml', 'scripts/ci-gate.mjs', 'tests/fixtures/verify-project/openspec/changes/sample/tasks.md']) {
      const result = decide(nameStatus(['M', 'docs/usage.md'], ['M', path]));
      expect(result.docsOnly, path).toBe(false);
      expect(result.reason, path).toContain(path);
    }
  });

  it('[REQ-270] 名前を変えたファイルは、変更前のパスも判定する', () => {
    expect(decide(nameStatus(['R100', 'scripts/notes.md', 'docs/notes.md']))).toMatchObject({ docsOnly: false });
    expect(decide(nameStatus(['R087', 'docs/old.md', 'docs/new.md']))).toMatchObject({ docsOnly: true });
    expect(decide(nameStatus(['C100', 'packages/kit/templates/AGENTS.md', 'docs/agents.md']))).toMatchObject({ docsOnly: false });
    expect(parseNameStatus(nameStatus(['R100', 'scripts/notes.md', 'docs/notes.md'], ['D', 'docs/gone.md']))).toEqual(['scripts/notes.md', 'docs/notes.md', 'docs/gone.md']);
  });

  it('[REQ-270] 差分を取れないときは、文書だけと判定しない', () => {
    const result = decide(nameStatus(['M', 'docs/a.md']), 128);
    expect(result.docsOnly).toBe(false);
    expect(decideDocsOnly({ eventName: 'pull_request', baseRef: 'main', git: () => ({ status: null, error: new Error('spawn git ENOENT') }) })).toMatchObject({ docsOnly: false });
    expect(decideDocsOnly({ eventName: 'pull_request', baseRef: '', git: fakeGit(nameStatus(['M', 'docs/a.md'])).git })).toMatchObject({ docsOnly: false });
  });

  it('[REQ-270] 差分を解釈できないときは、文書だけと判定しない', () => {
    for (const stdout of [
      'M\tdocs/a.md\n', // -z でない出力
      nameStatus(['X', 'docs/a.md']), // 知らない状態
      nameStatus(['U', 'docs/a.md']), // 衝突
      'R100\0docs/a.md\0', // 名前の変更で、変更後のパスがない
      nameStatus(['M', 'docs/a.md']).slice(0, -1), // NUL で終わらない
      '', // 変えたファイルがない
    ]) expect(decide(stdout).docsOnly, JSON.stringify(stdout)).toBe(false);
    expect(() => parseNameStatus('X\0docs/a.md\0')).toThrow('解釈できない差分の状態です');
  });

  it('[REQ-270] PR のマージ先が main でないときは、差分によらず文書だけと判定しない', () => {
    const { git, calls } = fakeGit(nameStatus(['M', 'docs/notes.md']));
    const result = decideDocsOnly({ eventName: 'pull_request', baseRef: 'feature-x', git });
    expect(result).toMatchObject({ docsOnly: false });
    expect(result.reason).toContain('feature-x');
    expect(calls).toEqual([]);
  });

  it('[REQ-270] main への push では、差分によらず文書だけと判定しない', () => {
    const { git, calls } = fakeGit(nameStatus(['M', 'docs/a.md']));
    expect(decideDocsOnly({ eventName: 'push', baseRef: '', git })).toMatchObject({ docsOnly: false });
    expect(decideDocsOnly({ eventName: 'push', baseRef: 'main', git })).toMatchObject({ docsOnly: false });
    expect(calls).toEqual([]);
  });
});

describe('文書だけかの判定（git の差分から）', () => {
  // 一時的なリポジトリで、ベースのあとに PR のコミットを重ね、スクリプトを実行する
  function withRepo(check: (repo: { git: (...args: string[]) => void; write: (files: Record<string, string>) => void; commit: (files: Record<string, string>, renames?: [string, string][]) => void; run: (env?: Record<string, string>) => { status: number | null; output: string; stderr: string } }) => void) {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-docs-only-'));
    const git = (...args: string[]) => {
      const result = spawnSync('git', ['-c', 'core.hooksPath=', ...args], { cwd: dir, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    };
    const write = (files: Record<string, string>) => {
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), text);
      }
    };
    try {
      git('init', '-q');
      git('config', 'user.name', 'Loomake Test');
      git('config', 'user.email', 'test@example.invalid');
      write({ 'README.md': 'base\n', 'scripts/notes.md': '名前を変える前の文書\n'.repeat(20), 'packages/kit/src/a.ts': 'export const a = 1;\n' });
      git('add', '-A');
      git('commit', '-qm', 'base');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      check({
        git,
        write,
        commit(files, renames = []) {
          for (const [from, to] of renames) {
            mkdirSync(dirname(join(dir, to)), { recursive: true });
            git('mv', from, to);
          }
          write(files);
          git('add', '-A');
          git('commit', '-qm', 'change');
        },
        run(env = {}) {
          const outputFile = join(dir, 'github-output.txt');
          writeFileSync(outputFile, '');
          const result = spawnSync(process.execPath, [script], {
            cwd: dir,
            encoding: 'utf8',
            env: { ...process.env, EVENT_NAME: 'pull_request', BASE_REF: 'main', GITHUB_OUTPUT: outputFile, ...env },
          });
          return { status: result.status, output: readFileSync(outputFile, 'utf8'), stderr: result.stderr };
        },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('[REQ-270] 文書だけの PR では docs_only=true を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'docs/worklog/2026-10-27.md': '記録\n', 'openspec/changes/c1/tasks.md': '- [ ] 1.1\n', '.changeset/c1.md': '---\n---\n' });
      expect(repo.run()).toMatchObject({ status: 0, output: 'docs_only=true\n' });
    });
  });

  it('[REQ-270] 前のコミットでコードを変えた PR では、最後のコミットが文書だけでも docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'packages/kit/src/a.ts': 'export const a = 2;\n' });
      repo.commit({ 'docs/notes.md': 'メモ\n' });
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('packages/kit/src/a.ts');
    });
  });

  it('[REQ-270] 名前を変えたファイルは、変更前のパスが文書でなければ docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commit({}, [['scripts/notes.md', 'docs/notes.md']]);
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('scripts/notes.md');
    });
  });

  it('[REQ-270] 差分を取れないときは、失敗にせず docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'docs/a.md': '文書\n' });
      // 向き先のブランチ（origin/main）がない
      repo.git('update-ref', '-d', 'refs/remotes/origin/main');
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('調べられなかった');
    });
  });

  it('[REQ-270] マージ先が main でない PR では docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.git('update-ref', 'refs/remotes/origin/feature-x', 'refs/remotes/origin/main');
      repo.commit({ 'docs/notes.md': 'メモ\n' });
      // 同じ差分でも、マージ先が main なら文書だけになる
      expect(repo.run()).toMatchObject({ status: 0, output: 'docs_only=true\n' });
      const result = repo.run({ BASE_REF: 'feature-x' });
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('マージ先が main ではない');
    });
  });

  it('[REQ-270] main への push では docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'docs/a.md': '文書\n' });
      expect(repo.run({ EVENT_NAME: 'push', BASE_REF: '' })).toMatchObject({ status: 0, output: 'docs_only=false\n' });
    });
  });
});
