import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { decideDocsOnly, isDocumentPath, parseRawDiff } from '../scripts/ci-docs-only.mjs';

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
// `git diff --raw -z` の形の差分。[状態, パス...] を渡すと、通常のファイル（100644）の差分にする。
// 足したファイルの変更前と、消したファイルの変更後は、ファイルがない（000000）
const regularModes = (status: string) => (status === 'A' ? '000000 100644' : status === 'D' ? '100644 000000' : '100644 100644');
const rawEntry = (modes: string, status: string, ...paths: string[]) => [`:${modes} 1111111 2222222 ${status}`, ...paths].join('\0') + '\0';
const nameStatus = (...entries: string[][]) => entries.map(([status, ...paths]) => rawEntry(regularModes(status!), status!, ...paths)).join('');
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

  it('[REQ-281] Windows で使えない文字と制御文字を含む名前は文書として扱わない', () => {
    for (const path of ['docs/a:b.md', 'docs/a\npackages.md', 'docs/a?.md', 'docs/a<b.md', 'docs/a>b.md', 'docs/a"b.md', 'docs/a|b.md', 'docs/a*.md', 'docs/a\tb.md', 'docs/a\u0000b.md', 'docs/a\u001fb.md', 'docs/x:y/a.md'])
      expect(isDocumentPath(path), JSON.stringify(path)).toBe(false);
  });

  it('[REQ-281] 末尾がドットか空白の部分と、Windows の予約名の部分を含む名前は文書として扱わない', () => {
    for (const path of ['docs/notes./a.md', 'docs/notes /a.md', 'docs/a.md ', 'docs/aux.md', 'docs/Com1.md', 'docs/nul/a.md', 'CON.md', 'docs/prn.tar.md', 'docs/LPT9.md', 'openspec/changes/aux/tasks.md'])
      expect(isDocumentPath(path), JSON.stringify(path)).toBe(false);
    // 予約名に似ているだけの名前は文書として扱う
    for (const path of ['docs/auxiliary.md', 'docs/com10.md', 'docs/con-notes.md', 'docs/lpt.md', 'docs/a.b.md']) expect(isDocumentPath(path), path).toBe(true);
  });

  it('[REQ-281] UTF-8 として正しくないバイトを含む名前は文書として扱わない', () => {
    // git の出力を UTF-8 として読むと、正しくないバイトは U+FFFD になる
    expect(isDocumentPath('docs/�x.md')).toBe(false);
    expect(isDocumentPath(Buffer.from([...Buffer.from('docs/'), 0xff, ...Buffer.from('x.md')]).toString('utf8'))).toBe(false);
    expect(isDocumentPath('docs/日本語の名前.md')).toBe(true);
  });
});

describe('文書だけかの判定', () => {
  it('[REQ-270] 変えたファイルがすべて文書なら、文書だけと判定する', () => {
    const { git, calls } = fakeGit(nameStatus(['M', 'docs/worklog/2026-10-27.md'], ['A', 'openspec/changes/c1/tasks.md'], ['A', '.changeset/c1.md']));
    expect(decideDocsOnly({ eventName: 'pull_request', baseRef: 'main', git })).toMatchObject({ docsOnly: true });
    // ベースから PR の先頭までの差分を、名前の変更を検出して読む。ベースは同じ名前のタグと取り違えないよう refs/remotes/ から書く
    // そのあとで、大文字と小文字だけが違うパスを探すため、PR の先頭のツリーを読む（REQ-281）
    // 差分は --raw で読み、モードも判定に使う（REQ-282）
    expect(calls).toEqual([['diff', '--raw', '-z', '-M', 'refs/remotes/origin/main...HEAD'], ['ls-tree', '-r', '-z', '--name-only', 'HEAD']]);
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
    expect(parseRawDiff(nameStatus(['R100', 'scripts/notes.md', 'docs/notes.md'], ['D', 'docs/gone.md'])).flatMap((entry) => entry.paths)).toEqual(['scripts/notes.md', 'docs/notes.md', 'docs/gone.md']);
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
      ':100644 100644 1111111 2222222 R100\0docs/a.md\0', // 名前の変更で、変更後のパスがない
      'M\0docs/a.md\0', // --raw でない（モードのない）出力
      nameStatus(['M', 'docs/a.md']).slice(0, -1), // NUL で終わらない
      '', // 変えたファイルがない
    ]) expect(decide(stdout).docsOnly, JSON.stringify(stdout)).toBe(false);
    expect(() => parseRawDiff(':100644 100644 1111111 2222222 X\0docs/a.md\0')).toThrow('解釈できない差分の状態です');
  });

  it('[REQ-270] 判定のスクリプトとワークフローを変えた PR は、文書だけと判定しない', () => {
    // どちらも許可リストの外なので、PR に入っている版のスクリプトで判定しても、その PR の quality は飛ばない
    for (const path of ['scripts/ci-docs-only.mjs', '.github/workflows/ci.yml']) {
      expect(isDocumentPath(path), path).toBe(false);
      const result = decide(nameStatus(['M', 'docs/usage.md'], ['M', path]));
      expect(result.docsOnly, path).toBe(false);
      expect(result.reason, path).toContain(path);
    }
  });

  it('[REQ-270] コードのファイルを消した PR は、文書だけと判定しない', () => {
    const result = decide(nameStatus(['D', 'packages/kit/src/a.ts'], ['M', 'docs/notes.md']));
    expect(result).toMatchObject({ docsOnly: false });
    expect(result.reason).toContain('packages/kit/src/a.ts');
  });

  it('[REQ-282] 変更前か変更後が通常のファイルでないものは、.md の名前でも文書だけと判定しない', () => {
    for (const [modes, status, name] of [
      ['000000 120000', 'A', 'シンボリックリンク'],
      ['000000 160000', 'A', 'サブモジュール'],
      ['100644 100755', 'M', '実行できるファイル'],
      ['100755 100644', 'M', '実行できるファイル'],
      ['100644 120000', 'T', 'シンボリックリンク'],
      ['120000 000000', 'D', 'シンボリックリンク'],
      ['100664 100664', 'M', 'モード 100664'],
      ['000000 000000', 'M', 'モードなし'],
    ] as const) {
      const result = decide(rawEntry(modes, status, 'docs/link.md') + nameStatus(['M', 'docs/usage.md']));
      expect(result.docsOnly, modes).toBe(false);
      expect(result.reason, modes).toContain(`docs/link.md（${name}）`);
    }
    // 名前の変更では、変更後のパスを示す
    expect(decide(rawEntry('100644 120000', 'R100', 'docs/a.md', 'docs/b.md')).reason).toContain('docs/b.md（シンボリックリンク）');
    // 通常のファイルを足し、変え、消すだけなら文書だけになる
    expect(decide(nameStatus(['A', 'docs/notes.md'], ['M', 'README.md'], ['D', 'docs/old.md'], ['R100', 'docs/x.md', 'docs/y.md'])).docsOnly).toBe(true);
  });

  // 差分と PR の先頭のツリーを、引数で分けて返す偽の git
  const treeOf = (...paths: string[]) => paths.map((path) => path + '\0').join('');
  const decideWithTree = (diff: string, tree: string, treeStatus = 0) => {
    const calls: string[][] = [];
    const git = (args: string[]) => {
      calls.push(args);
      if (args[0] === 'ls-tree') return { status: treeStatus, stdout: tree, stderr: treeStatus ? 'fatal: not a tree object' : '' };
      return { status: 0, stdout: diff, stderr: '' };
    };
    return { result: decideDocsOnly({ eventName: 'pull_request', baseRef: 'main', git }), calls };
  };

  it('[REQ-281] PR の先頭のツリーに大文字と小文字の違いだけで同じになる別のパスがあれば、文書だけと判定しない', () => {
    const collide = decideWithTree(nameStatus(['A', 'docs/Notes.md']), treeOf('README.md', 'docs/Notes.md', 'docs/notes.md'));
    expect(collide.result.docsOnly).toBe(false);
    expect(collide.result.reason).toContain('docs/Notes.md');
    // ディレクトリの名前だけが違う場合も、同じパスになる
    expect(decideWithTree(nameStatus(['A', 'docs/Guide/a.md']), treeOf('docs/Guide/a.md', 'docs/guide/a.md')).result.docsOnly).toBe(false);
    // 重ならなければ文書だけになる。ツリーは PR の先頭（HEAD）から読む
    const ok = decideWithTree(nameStatus(['A', 'docs/Notes.md']), treeOf('README.md', 'docs/Notes.md', 'docs/notes-old.md'));
    expect(ok.result.docsOnly).toBe(true);
    expect(ok.calls.find((args) => args[0] === 'ls-tree')).toEqual(['ls-tree', '-r', '-z', '--name-only', 'HEAD']);
  });

  it('[REQ-281] PR の先頭のツリーのパスを読めないときは、文書だけと判定しない', () => {
    const failed = decideWithTree(nameStatus(['M', 'docs/notes.md']), '', 128).result;
    expect(failed.docsOnly).toBe(false);
    expect(failed.reason).toContain('not a tree object');
    // NUL で終わらない出力は解釈できない
    expect(decideWithTree(nameStatus(['M', 'docs/notes.md']), 'docs/notes.md').result.docsOnly).toBe(false);
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
  // commitIndex は、作業ツリーを通さずに索引へ項目を足してコミットする。Windows で作れない名前・シンボリックリンク・サブモジュールも、
  // OS によらず同じ形で作れる。作業ツリーと索引がずれるので、commit より後にだけ使う
  type IndexEntry = { mode: string; path: string | Buffer; content?: string; object?: string };
  function withRepo(check: (repo: { git: (...args: string[]) => void; commit: (files: Record<string, string>, renames?: [string, string][]) => void; commitIndex: (entries: IndexEntry[]) => void; run: (env?: Record<string, string>) => { status: number | null; output: string; stderr: string } }) => void) {
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
      // Windows の git は、既定（core.protectNTFS=true）で Windows で扱えない名前をコミットさせない。
      // ほかの OS で作られた PR と同じ状態を作るため、一時的なリポジトリでだけ外す
      git('config', 'core.protectNTFS', 'false');
      write({ 'README.md': 'base\n', 'scripts/notes.md': '名前を変える前の文書\n'.repeat(20), 'packages/kit/src/a.ts': 'export const a = 1;\n' });
      git('add', '-A');
      git('commit', '-qm', 'base');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      check({
        git,
        commit(files, renames = []) {
          for (const [from, to] of renames) {
            mkdirSync(dirname(join(dir, to)), { recursive: true });
            git('mv', from, to);
          }
          write(files);
          git('add', '-A');
          git('commit', '-qm', 'change');
        },
        commitIndex(entries) {
          const lines = entries.map(({ mode, path, content = '', object }) => {
            let id = object;
            if (!id) {
              const hashed = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: dir, input: content, encoding: 'utf8' });
              expect(hashed.status, hashed.stderr).toBe(0);
              id = hashed.stdout.trim();
            }
            return Buffer.concat([Buffer.from(`${mode} ${id}\t`), Buffer.isBuffer(path) ? path : Buffer.from(path), Buffer.from([0])]);
          });
          const updated = spawnSync('git', ['update-index', '-z', '--index-info'], { cwd: dir, input: Buffer.concat(lines) });
          expect(updated.status, updated.stderr?.toString()).toBe(0);
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

  it.each(['refs/tags/origin/main', 'refs/heads/origin/main'])('[REQ-270] ベースと同じ名前の参照 %s が PR のコミットの途中を指していても、ベースとの差分で判定して docs_only=false を書く', (name) => {
    withRepo((repo) => {
      repo.commit({ 'packages/kit/src/a.ts': 'export const a = 2;\n' });
      repo.git('update-ref', name, 'HEAD');
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

  it('[REQ-270] main が進んだあとのマージコミットでは、PR の変更分だけで判定する', () => {
    withRepo((repo) => {
      // PR のブランチは文書だけを変える
      repo.commit({ 'docs/notes.md': 'メモ\n' });
      repo.git('branch', 'pr');
      // PR を作ったあとで、main にコードの変更が入る
      repo.git('checkout', '-q', '-b', 'mainline', 'refs/remotes/origin/main');
      repo.commit({ 'packages/kit/src/a.ts': 'export const a = 2;\n' });
      repo.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      // CI と同じく、main に PR のブランチをマージしたコミットを HEAD にする
      repo.git('checkout', '-q', '--detach', 'mainline');
      repo.git('merge', '-q', '--no-ff', '--no-edit', 'pr');
      expect(repo.run()).toMatchObject({ status: 0, output: 'docs_only=true\n' });
    });
  });

  it('[REQ-270] コードのファイルを消した PR では docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.git('rm', '-q', 'packages/kit/src/a.ts');
      repo.commit({ 'docs/notes.md': 'メモ\n' });
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('packages/kit/src/a.ts');
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

  it.each([
    ['docs/a:b.md', 'docs/a:b.md'],
    ['改行を含む名前', 'docs/a\npackages.md'],
    ['UTF-8 として正しくない名前', Buffer.from([...Buffer.from('docs/'), 0xff, ...Buffer.from('x.md')])],
    ['予約名', 'docs/aux.md'],
    ['末尾が空白の部分', 'docs/notes /a.md'],
  ])('[REQ-281] Windows で扱えない名前（%s）を足した PR では docs_only=false を書く', (_name, path) => {
    withRepo((repo) => {
      repo.commitIndex([{ mode: '100644', path, content: '文書\n' }]);
      expect(repo.run()).toMatchObject({ status: 0, output: 'docs_only=false\n' });
    });
  });

  it('[REQ-281] ベースにある名前と大文字と小文字だけが違う名前を足した PR では docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commitIndex([{ mode: '100644', path: 'docs/notes.md', content: 'メモ\n' }]);
      repo.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      repo.commitIndex([{ mode: '100644', path: 'docs/Notes.md', content: '別のメモ\n' }]);
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain('docs/Notes.md');
    });
  });

  it.each([
    ['シンボリックリンク', { mode: '120000', path: 'docs/link.md', content: '../packages/kit/src/a.ts' }],
    ['サブモジュール', { mode: '160000', path: 'docs/sub.md', object: '0123456789abcdef0123456789abcdef01234567' }],
    ['モードだけの変更', { mode: '100755', path: 'README.md', content: 'base\n' }],
  ])('[REQ-282] 通常のファイルでないもの（%s）を .md の名前で足した PR では docs_only=false を書く', (_name, entry) => {
    withRepo((repo) => {
      repo.commitIndex([entry]);
      const result = repo.run();
      expect(result).toMatchObject({ status: 0, output: 'docs_only=false\n' });
      expect(result.stderr).toContain(entry.path);
    });
  });

  it('[REQ-282] 通常のファイルの文書を足し、変え、消した PR では docs_only=true を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'docs/old.md': '古いメモ\n' });
      repo.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      repo.git('rm', '-q', 'docs/old.md');
      repo.commit({ 'docs/notes.md': 'メモ\n', 'README.md': 'changed\n' });
      expect(repo.run()).toMatchObject({ status: 0, output: 'docs_only=true\n' });
    });
  });

  it('[REQ-270] main への push では docs_only=false を書く', () => {
    withRepo((repo) => {
      repo.commit({ 'docs/a.md': '文書\n' });
      expect(repo.run({ EVENT_NAME: 'push', BASE_REF: '' })).toMatchObject({ status: 0, output: 'docs_only=false\n' });
    });
  });
});
