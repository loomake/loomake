import { resolve } from 'node:path';
import { runExternal } from '@loomake/kit';

/** git の操作の失敗。run を始める前なら使い方の誤り、始めたあとなら実行中の失敗として扱う（REQ-137） */
export class GitError extends Error {}

/** git を実行して標準出力を返す。失敗したら GitError を投げる */
// フックを動かす操作は、1 操作の期限ではなく run の残り時間で止める（REQ-182）
const RUNS_HOOKS = new Set(['commit', 'push']);

// 端末での入力が要る認証や署名で失敗したときの、git・ssh・gpg のエラーの文言（REQ-211）
const NEEDS_PROMPT = /could not read (Username|Password)|terminal prompts disabled|Permission denied \(publickey|passphrase|gpg failed to sign|failed to sign the data/i;
export const PROMPT_GUIDE =
  'run は git を端末なしで動かすので、端末での入力ができません。ssh-agent に鍵を登録するか、credential helper（gh auth setup-git など）や gpg-agent を設定して、入力なしで push・commit できるようにしてから、もう一度実行してください';

/** runner が渡すパスを git の式にせず扱い、端末での入力も求めない（REQ-109・REQ-138・REQ-211） */
export function gitEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1',
    GIT_GLOB_PATHSPECS: '0', GIT_NOGLOB_PATHSPECS: '0', GIT_ICASE_PATHSPECS: '0' };
}

export function git(root: string, env: NodeJS.ProcessEnv, args: string[]): string {
  // 端末での入力を求めず、すぐ失敗させる（REQ-211）
  const runsHooks = RUNS_HOOKS.has(args[0]);
  // フック内の git の glob と利用者の環境を保つ。commit・push 自体に pathspec は渡さない（REQ-198）。
  const childEnv = runsHooks ? { ...env, GIT_TERMINAL_PROMPT: '0' } : gitEnvironment(env);
  const r = runExternal('git', args, { cwd: root, env: childEnv, untilDeadline: runsHooks });
  if (r.error || r.status !== 0) {
    const detail = (r.stderr || r.error?.message || '').trim();
    const guide = RUNS_HOOKS.has(args[0]) && NEEDS_PROMPT.test(detail) ? `。${PROMPT_GUIDE}` : '';
    throw new GitError(`git の操作に失敗しました：git ${args.join(' ')}（${detail}）${guide}`);
  }
  return r.stdout;
}

/** 未コミットの変更。追跡していないファイルを含み、.gitignore で除外したものは含めない */
export const dirtyFiles = (root: string, env: NodeJS.ProcessEnv) =>
  git(root, env, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);

export const branchExists = (root: string, env: NodeJS.ProcessEnv, branch: string) =>
  runExternal('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root, env: gitEnvironment(env) }).status === 0;

/** git の設定の値。なければ空の文字列 */
export const gitConfig = (root: string, env: NodeJS.ProcessEnv, key: string) =>
  runExternal('git', ['config', '--get', key], { cwd: root, env: gitEnvironment(env) }).stdout.trim();

/** .gitignore で除外されているか。追跡しているファイルは除外されていないとみなす */
export const isIgnored = (root: string, env: NodeJS.ProcessEnv, path: string) =>
  runExternal('git', ['check-ignore', '-q', '--', path.startsWith(':') ? `./${path}` : path], {
    cwd: root,
    // check-ignore は literal magic を受け付けない。先頭の : は ./ でファイル名として渡す。
    env: { ...gitEnvironment(env), GIT_LITERAL_PATHSPECS: '0' },
  }).status === 0;

/** git の設定ファイルとフックのディレクトリの場所。`--git-path hooks` は core.hooksPath を反映する。HEAD のコミットがなくても読める */
export type GitPlaces = { config: string; hooks: string };

export function gitPlaces(root: string, env: NodeJS.ProcessEnv): GitPlaces {
  const [config, hooks] = git(root, env, ['rev-parse', '--git-path', 'config', '--git-path', 'hooks']).split(/\r?\n/);
  return { config: resolve(root, config), hooks: resolve(root, hooks) };
}

/** HEAD のコミットの SHA とブランチ名。コミットがなければ sha は空、detached なら branch は HEAD */
export type HeadRead = { sha: string; branch: string };

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/**
 * HEAD の SHA とブランチ名を、withPlaces なら設定ファイルとフックの場所も、1 回の git rev-parse で読む（REQ-348）。
 * 0 以外で終わったとき（HEAD のコミットがないときなど）や出力の形が合わないときは、項目ごとの呼び出しに戻して同じ値を返す。
 * 期限・出力の上限・中断による例外は、項目ごとの呼び出しを起動せずにそのまま渡す（REQ-349・REQ-180〜REQ-182）
 */
export function readHead(root: string, env: NodeJS.ProcessEnv): HeadRead;
export function readHead(root: string, env: NodeJS.ProcessEnv, withPlaces: true): HeadRead & GitPlaces;
export function readHead(root: string, env: NodeJS.ProcessEnv, withPlaces = false): HeadRead | (HeadRead & GitPlaces) {
  const paths = withPlaces ? ['--git-path', 'config', '--git-path', 'hooks'] : [];
  const r = runExternal('git', ['rev-parse', ...paths, 'HEAD', '--abbrev-ref', 'HEAD'], { cwd: root, env: gitEnvironment(env) });
  const lines = r.stdout.split(/\r?\n/);
  const n = paths.length / 2;
  if (!r.error && r.status === 0 && lines.length === n + 3 && lines[n + 2] === '' && SHA.test(lines[n]) && lines[n + 1]) {
    const head = { sha: lines[n], branch: lines[n + 1] };
    return withPlaces ? { ...head, config: resolve(root, lines[0]), hooks: resolve(root, lines[1]) } : head;
  }
  // 項目ごとの呼び出し。まとめる前の headState と同じく、終了コードを見ずに標準出力を使う
  const head = {
    sha: runExternal('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, env: gitEnvironment(env) }).stdout.trim(),
    branch: runExternal('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, env: gitEnvironment(env) }).stdout.trim(),
  };
  return withPlaces ? { ...head, ...gitPlaces(root, env) } : head;
}
