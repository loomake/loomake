import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, type Repo } from './helpers.js';

// makeRepo は git init の代わりに雛形を書き出す。雛形から作ったリポジトリの git の状態（HEAD・設定・履歴・origin）が、
// 従来の作り方（fresh）と同じで、試験どうしで共有されないことを確かめる。
const bare = (repo: Repo, ...args: string[]) => {
  const r = spawnSync('git', ['--git-dir', join(repo.base, 'origin.git'), ...args], { env: repo.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

// .git の木（パスと mode）。中身が試験ごとに変わる objects・logs・index・COMMIT_EDITMSG は除く
const SKIPPED = new Set(['objects', 'logs', 'index', 'COMMIT_EDITMSG']);
function gitTree(dir: string, path = ''): [string, number][] {
  return readdirSync(join(dir, path)).sort().filter((name) => !(path === '' && SKIPPED.has(name))).flatMap((name) => {
    const child = join(path, name);
    const stat = statSync(join(dir, child));
    return [[child, stat.mode] as [string, number], ...(stat.isDirectory() ? gitTree(dir, child) : [])];
  });
}

/** base の絶対パスを伏せた git の状態。2 つの作り方で同じになるはずのもの */
function gitState(repo: Repo) {
  const hide = (text: string) => text.split(repo.base).join('<base>');
  const files = repo.git('ls-tree', '-r', '--name-only', 'HEAD').split('\n');
  return {
    head: repo.git('symbolic-ref', 'HEAD'),
    commits: repo.git('rev-list', '--count', 'HEAD'),
    log: repo.git('log', '--format=%s|%an|%ae|%cn|%ce|%P'),
    reflog: repo.git('reflog', '--format=%gs'),
    tree: repo.git('ls-tree', '-r', 'HEAD').split('\n').map((line) => line.replace(/ [0-9a-f]{40,64}\t/, '\t')),
    contents: Object.fromEntries(files.map((file) => [file, hide(repo.git('show', `HEAD:${file}`))])),
    status: repo.git('status', '--porcelain', '--ignored'),
    branches: repo.git('branch', '--format=%(refname)'),
    config: hide(repo.git('config', '--local', '--list')),
    url: hide(repo.git('config', '--get', 'remote.origin.url')),
    gitTree: gitTree(join(repo.root, '.git')),
    originTree: gitTree(join(repo.base, 'origin.git')),
    hooks: readdirSync(join(repo.root, '.git/hooks')).sort().map((hook) => [hook, statSync(join(repo.root, '.git/hooks', hook)).mode]),
    originBare: bare(repo, 'rev-parse', '--is-bare-repository'),
    originHead: bare(repo, 'symbolic-ref', 'HEAD'),
    originRefs: repo.git('ls-remote', 'origin'),
    originConfig: bare(repo, 'config', '--local', '--list'),
  };
}

describe('makeRepo の雛形', () => {
  it('雛形から作った repo の HEAD・設定・履歴・origin が、git init から作った repo と同じ', () => {
    const fresh = makeRepo({ fresh: true, run: { maxFixes: 1 } });
    const copied = makeRepo({ run: { maxFixes: 1 } });
    try {
      const expected = gitState(fresh);
      expect(expected.head).toBe('refs/heads/main');
      expect(expected.commits).toBe('1');
      expect(expected.url).toBe(join('<base>', 'origin.git'));
      expect(gitState(copied)).toEqual(expected);
      expect(copied.git('config', '--get', 'remote.origin.url')).toBe(join(copied.base, 'origin.git'));
      expect(readFileSync(join(copied.root, '.git/config'), 'utf8')).not.toContain('loomake-run-template-');
    } finally { fresh.cleanup(); copied.cleanup(); }
  });

  it('雛形から作った repo と origin は試験ごとに別で、片方の変更がもう片方と雛形に及ばない', () => {
    const first = makeRepo();
    const second = makeRepo();
    try {
      first.write('only-first.txt', 'first\n');
      first.git('add', 'only-first.txt');
      first.git('commit', '-q', '-m', 'first');
      first.git('push', '-q', 'origin', 'main');
      first.git('config', 'loomake.test', 'first');
      expect(first.git('ls-remote', 'origin')).toContain('refs/heads/main');
      expect(second.git('ls-remote', 'origin')).toBe('');
      expect(second.git('rev-list', '--count', 'HEAD')).toBe('1');
      expect(spawnSync('git', ['config', '--get', 'loomake.test'], { cwd: second.root, env: second.env }).status).toBe(1);
      const third = makeRepo();
      try {
        expect(gitState(third)).toEqual(gitState(second));
      } finally { third.cleanup(); }
    } finally { first.cleanup(); second.cleanup(); }
  });
});
