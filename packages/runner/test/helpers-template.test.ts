import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { makeRepo, type Repo } from './helpers.js';

// makeRepo は git init の代わりに雛形を書き出す。雛形から作ったリポジトリの git の状態（HEAD・設定・履歴・origin）が、
// 従来の作り方（fresh）と同じで、試験どうしで共有されないことを確かめる。
const bare = (repo: Repo, ...args: string[]) => {
  const r = spawnSync('git', ['--git-dir', join(repo.base, 'origin.git'), ...args], { env: repo.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

// .git の木（パスと mode と、通常ファイルなら中身の SHA-256）。中身が試験ごとに変わる objects・logs・index・COMMIT_EDITMSG は除く。
// .git/config には origin の絶対パスが入るので、中身は base（と HEAD のコミットの SHA）を伏せてからハッシュする
const SKIPPED = new Set(['objects', 'logs', 'index', 'COMMIT_EDITMSG']);
function gitTree(dir: string, hide: (text: string) => string, path = ''): [string, number, string?][] {
  return readdirSync(join(dir, path)).sort().filter((name) => !(path === '' && SKIPPED.has(name))).flatMap((name) => {
    const child = join(path, name);
    const stat = statSync(join(dir, child));
    if (stat.isDirectory()) return [[child, stat.mode] as [string, number], ...gitTree(dir, hide, child)];
    const hash = createHash('sha256').update(hide(readFileSync(join(dir, child), 'utf8'))).digest('hex');
    return [[child, stat.mode, hash] as [string, number, string]];
  });
}

/** base の絶対パスを伏せた git の状態。2 つの作り方で同じになるはずのもの */
function gitState(repo: Repo) {
  // write-report.mjs の中のパスは JSON で 2 回逃がしてある（Windows ではパスの区切りが逃がされて形が変わる）。逃がした形も伏せる
  const once = JSON.stringify(repo.base).slice(1, -1);
  const forms = [JSON.stringify(once).slice(1, -1), once, repo.base];
  const hide = (text: string) => forms.reduce((value, form) => value.split(form).join('<base>'), text);
  // refs/heads/main などに入るコミットの SHA は、コミットの時刻で試験ごとに変わる。.git の木の中身では <head> に伏せる
  const headSha = repo.git('rev-parse', 'HEAD');
  const hideRepo = (text: string) => hide(text).split(headSha).join('<head>');
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
    gitTree: gitTree(join(repo.root, '.git'), hideRepo),
    originTree: gitTree(join(repo.base, 'origin.git'), hideRepo),
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
  }, 30_000);

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
  }, 30_000);
});
