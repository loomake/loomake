import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { runExternal } from '@loomake/kit';
import { dirtyFiles, git } from './git.js';

/** 不正な直し方として見つけたもの */
export type GuardFinding = { file: string; reason: string };

// テストファイル
const isTestFile = (f: string) => /\.(test|spec)\./.test(f) || /(^|\/)(test|tests|__tests__)\//.test(f);
// skip・todo を足した行（A-17）。it.concurrent.skip のような修飾と、条件つきの skipIf・runIf も見る
const SKIP = /\b(it|test|describe|suite)(\.\w+)*\.(skip|todo|skipIf|runIf)\b|\bx(it|test|describe)\(/;
// 検査の行と、同じリテラルどうしを比べる必ず通る検査（REQ-201）
const ASSERTION = /\bexpect\(|\bassert\b/;
const LITERAL = String.raw`(true|false|null|undefined|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")`;
const TRIVIAL = new RegExp(
  String.raw`\bexpect\(\s*${LITERAL}\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)` +
    String.raw`|\bassert(?:\.\w+)?\(\s*${LITERAL}\s*,\s*\2\s*\)|\bassert(?:\.ok)?\(\s*true\s*\)`,
);
// lint・型・テストの設定ファイル（A-18）
const isConfigFile = (f: string) => {
  const name = f.split('/').pop() ?? '';
  return (
    f === 'loomake.config.json' ||
    /^eslint\.config\./.test(name) ||
    /^\.eslintrc/.test(name) ||
    /^tsconfig.*\.json$/.test(name) ||
    /^(vitest\.config|vitest\.workspace|vite\.config|jest\.config)\./.test(name)
  );
};
// いまの仕様と change の文書（A-19）。openspecDir は loomake.config.json の値
const openspecPrefix = (dir: string) => `${dir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')}/`;

// どの階層の package.json でも scripts を比べる
const isPackageJson = (f: string) => f.split('/').pop() === 'package.json';

const scriptsOf = (root: string, env: NodeJS.ProcessEnv, rev: string, file: string): string => {
  const r = runExternal('git', ['show', `${rev}:${file}`], { cwd: root, env });
  if (r.status !== 0) return '{}';
  try {
    return JSON.stringify((JSON.parse(r.stdout) as { scripts?: unknown }).scripts ?? {});
  } catch {
    return '{}';
  }
};

/**
 * エンジンの変更を index に載せ、HEAD との差分から不正な直し方を探す（REQ-109〜REQ-111）。
 * 見つけたら、その差分を返す。変更は index に載ったままなので、呼び出し側で戻すかコミットする
 */
export function findViolations(root: string, env: NodeJS.ProcessEnv, openspecDir = 'openspec'): { findings: GuardFinding[]; diff: string } {
  const prefix = openspecPrefix(openspecDir);
  const specsDir = `${prefix}specs/`;
  const changesDir = `${prefix}changes/`;
  git(root, env, ['add', '-A']);
  const findings: GuardFinding[] = [];
  const status = git(root, env, ['diff', '--cached', '--name-status', '--no-renames', '-z']).split('\0');
  for (let i = 0; i + 1 < status.length; i += 2) {
    const code = status[i];
    const file = status[i + 1];
    if (code === 'D' && isTestFile(file)) findings.push({ file, reason: 'テストファイルを消しました' });
    if (isConfigFile(file)) findings.push({ file, reason: '設定ファイルを変えました' });
    if (isPackageJson(file) && scriptsOf(root, env, 'HEAD', file) !== scriptsOf(root, env, '', file)) {
      findings.push({ file, reason: 'package.json の scripts を変えました' });
    }
    if (file.startsWith(specsDir)) findings.push({ file, reason: 'いまの仕様を変えました' });
    else if (file.startsWith(changesDir)) findings.push({ file, reason: file.endsWith('/trace.md') ? 'trace.md を変えました' : 'change の文書を変えました' });
    if (code !== 'D') {
      const lines = git(root, env, ['diff', '--cached', '-U0', '--', file]).split('\n');
      const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
      for (const l of added) if (SKIP.test(l)) findings.push({ file, reason: `skip・todo を足しました：${l.slice(1).trim()}` });
      if (isTestFile(file)) {
        for (const l of added) if (TRIVIAL.test(l)) findings.push({ file, reason: `必ず通る検査を足しました：${l.slice(1).trim()}` });
        const removed = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
        const count = (xs: string[]) => xs.filter((l) => ASSERTION.test(l)).length;
        if (code === 'M' && count(removed) > count(added)) findings.push({ file, reason: 'テストの検査を減らしました' });
      }
    }
  }
  const files = [...new Set(findings.map((f) => f.file))];
  const diff = files.length ? git(root, env, ['diff', '--cached', '--', ...files]) : '';
  return { findings, diff };
}

/** 止まったときに、人が承認するための手順 */
export const APPROVAL_GUIDE = [
  '変更はコミットせずに作業ツリーに残しました。',
  '承認するなら、差分を確かめたうえで tasks.md のそのタスクを完了にし、自分でコミットしてから、もう一度 loomake run を実行してください。',
  '承認しないなら、変更を元に戻してから、もう一度実行してください。',
].join('\n');

/** HEAD のコミットの SHA とブランチ名。コミットがなければ sha は空、detached なら branch は HEAD */
export type HeadState = { sha: string; branch: string };

export const headState = (root: string, env: NodeJS.ProcessEnv): HeadState => ({
  sha: (runExternal('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, env }).stdout ?? '').trim(),
  branch: (runExternal('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, env }).stdout ?? '').trim(),
});

/**
 * エンジンが自分でコミットしたかブランチを切り替えたかを、呼ぶ前の HEAD と比べて調べる（REQ-126）。
 * 変わっていれば、止まる理由と、人が確かめて戻すための表示を返す。run はエンジンのコミットを取り消さず、ブランチも戻さない
 */
export function findEngineMove(
  root: string,
  env: NodeJS.ProcessEnv,
  before: HeadState,
  changeBranch: string,
): { reason: string; report: string } | undefined {
  const after = headState(root, env);
  if (after.sha === before.sha && after.branch === before.branch) return undefined;
  const label = (s: HeadState) => `${s.branch} ${s.sha || '（コミットなし）'}`;
  const diff = before.sha && after.sha ? git(root, env, ['diff', before.sha, after.sha]) : '';
  const dirty = dirtyFiles(root, env);
  const report = [
    'エンジンが HEAD かブランチを変えました。run はエンジンのコミットを取り消さず、ブランチも戻していません。',
    `  呼ぶ前：${label(before)}`,
    `  呼んだ後：${label(after)}`,
    ...(diff ? ['', diff] : []),
    ...(dirty.length ? ['', 'コミットしていない変更：', ...dirty.map((l) => `  ${l}`)] : []),
    '',
    ...(before.sha && after.sha ? [`変更を確かめるには、git log --stat ${before.sha}..${after.sha} を実行してください。`] : []),
    `受け入れるなら、${changeBranch} のブランチで差分を確かめたうえで tasks.md のそのタスクを完了にし、自分でコミットしてから、もう一度 loomake run を実行してください。`,
    ...(before.sha
      ? [`元に戻すなら、git switch ${changeBranch} と git reset --hard ${before.sha} を実行してから、もう一度実行してください。エンジンの変更は消えます。`]
      : []),
  ].join('\n');
  return { reason: `エンジンが HEAD かブランチを変えました（${label(before)} → ${label(after)}）`, report };
}

/** git の設定ファイルとフックのディレクトリの場所。`--git-path hooks` は core.hooksPath を反映する */
const gitPath = (root: string, env: NodeJS.ProcessEnv, name: string) => resolve(root, git(root, env, ['rev-parse', '--git-path', name]).trim());

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)])).sort();

/** git の設定とフックの状態。エンジンを呼ぶ前後で比べる（REQ-198） */
export type GitInternals = { config: string; hooks: string; digest: string };

/** git の設定ファイルの中身と、フックのディレクトリのファイルの相対パスと中身から、比べるための SHA-256 を作る */
export function gitInternals(root: string, env: NodeJS.ProcessEnv): GitInternals {
  const config = gitPath(root, env, 'config');
  const hooks = gitPath(root, env, 'hooks');
  const hash = createHash('sha256');
  hash.update(existsSync(config) ? readFileSync(config) : '');
  if (existsSync(hooks) && statSync(hooks).isDirectory()) {
    for (const file of filesUnder(hooks)) hash.update(`\0${relative(hooks, file)}\0`).update(readFileSync(file)).update(String(statSync(file).mode & 0o111));
  }
  return { config, hooks, digest: hash.digest('hex') };
}

/**
 * エンジンが git の設定かフックを変えたかを調べる（REQ-198）。変えていれば、止まる理由と確かめる場所を返す。
 * run は書き換えを戻さず、このあとの git add・git commit も実行しない
 */
export function findInternalsChange(root: string, env: NodeJS.ProcessEnv, before: GitInternals): { reason: string; report: string } | undefined {
  const after = gitInternals(root, env);
  if (after.digest === before.digest) return undefined;
  const places = [...new Set([before.config, after.config, before.hooks, after.hooks])].map((p) => `  ${p}`);
  return {
    reason: 'エンジンが git の設定かフックを変えました',
    report: [
      'エンジンが git の設定かフックを変えました。run はフックや設定のコマンドを実行しないよう、git add・git commit をせずに止まります。書き換えは戻していません。',
      '確かめる場所：',
      ...places,
      '意図した変更でなければ元に戻し、変更は作業ツリーに残っているので差分を確かめてから、もう一度 loomake run を実行してください。',
    ].join('\n'),
  };
}
