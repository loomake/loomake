import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { EXTERNAL_OUTPUT_BYTES, ProcessLimitError, runExternal, UsageError } from '@loomake/kit';
import { dirtyFiles, git, gitMeasured, GitError } from './git.js';

/** 不正な直し方として見つけたもの */
export type GuardFinding = { file: string; reason: string };

// テストファイル
const isTestFile = (f: string) => /\.(test|spec)\./.test(f) || /(^|\/)(test|tests|__tests__)\//.test(f);
// skip・todo を足した行（A-17）。it.concurrent.skip のような修飾と、条件つきの skipIf・runIf も見る
const SKIP = /\b(it|test|describe|suite)(\.\w+)*\.(skip|todo|skipIf|runIf)\b|\bx(it|test|describe)\(/;
// 検査の行と、同じリテラルどうしを比べる必ず通る検査（REQ-201）
const ASSERTION = /\bexpect\(|\bassert(?:\.\w+)?\(/;
// コメントと import・require の行は、検査の行として数えない（REQ-201）
const NOT_ASSERTION = /^[+-]\s*(?:\/\/|\/\*|\*|import\b|(?:const|let|var)\b.*\brequire\()/;
const LITERAL = String.raw`(true|false|null|undefined|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")`;
const TRIVIAL = new RegExp(
  String.raw`\bexpect\(\s*${LITERAL}\s*\)\s*\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)` +
    String.raw`|\bassert(?:\.\w+)?\(\s*${LITERAL}\s*,\s*\2\s*\)|\bassert(?:\.ok)?\(\s*true\s*\)`,
);

// アサーションとテストの宣言の呼び出し。直前が . か英数字の呼び出し（/x/.test(s)・submit(）は含めない（guard-test-weakening の仮定 A-01）
const TEST_LINE = /(?<![.\w])(expect|assert|it|test|describe)(\.\w+)*\s*\(/;
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

type GuardLimits = { maxPathspecChars: number; maxOutputBytes: number };
const DEFAULT_GUARD_LIMITS: GuardLimits = { maxPathspecChars: 8192, maxOutputBytes: EXTERNAL_OUTPUT_BYTES };
const PATCH_OPTIONS = ['--no-renames', '--no-color', '--no-ext-diff', '--submodule=short', '--src-prefix=a/', '--dst-prefix=b/'];

/** 連続する群。単独の長いパスは切り捨てず、そのまま従来の起動境界へ渡す。 */
export function groupPaths(paths: readonly string[], limit = 8192): string[][] {
  const groups: string[][] = [];
  let group: string[] = []; let weight = 0;
  for (const path of paths) {
    const size = JSON.stringify(path).length + 1;
    if (group.length && weight + size > limit) { groups.push(group); group = []; weight = 0; }
    group.push(path); weight += size;
  }
  if (group.length) groups.push(group);
  return groups;
}

function patchError(file: string): never {
  throw new GitError(`git の操作に失敗しました：git diff --cached（差分のファイルの区切りか完全性を確かめられません：${file}）`);
}

function unquotePath(quoted: string): string | undefined {
  const bytes: number[] = [];
  const escapes: Partial<Record<string, number>> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '\\': 92, '"': 34 };
  for (let i = 0; i < quoted.length;) {
    if (quoted[i] !== '\\') {
      const point = quoted.codePointAt(i); if (point === undefined) return undefined;
      const char = String.fromCodePoint(point);
      bytes.push(...Buffer.from(char)); i += char.length; continue;
    }
    const octal = quoted.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(octal)) { bytes.push(parseInt(octal, 8)); i += 4; continue; }
    const escaped = escapes[quoted[i + 1]];
    if (escaped === undefined) return undefined;
    bytes.push(escaped); i += 2;
  }
  const buffer = Buffer.from(bytes); const text = buffer.toString('utf8');
  return Buffer.from(text).equals(buffer) ? text : undefined;
}

function patchPath(header: string, candidates: readonly string[]): string | undefined {
  const exact = candidates.find((file) => header === `a/${file} b/${file}`);
  if (exact !== undefined) return exact;
  const quoted = header.match(/^"((?:\\.|[^"\\])*)" "((?:\\.|[^"\\])*)"$/);
  if (!quoted) return undefined;
  const before = unquotePath(quoted[1]); const after = unquotePath(quoted[2]);
  return before?.startsWith('a/') && after === `b/${before.slice(2)}` ? before.slice(2) : undefined;
}

/** Git の完結した unified patch だけを受ける。header の個数だけでは切断を検出できない。 */
function completePatch(text: string, file: string): void {
  if (!text.endsWith('\n')) patchError(file);
  const lines = text.split('\n').slice(1, -1);
  let hunk: { old: number; next: number } | undefined;
  let oldPath = false; let newPath = false; let contentLine = false;
  let metadata = false;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (hunk && (hunk.old !== 0 || hunk.next !== 0)) patchError(file);
      const match = line.match(/^@@ -(\d+(?:,\d+)?) \+(\d+(?:,\d+)?) @@[^\n]*$/);
      if (!match || !oldPath || !newPath) patchError(file);
      const [oldPosition, oldCount = '1'] = match[1].split(',');
      const [newPosition, newCount = '1'] = match[2].split(',');
      const old = Number(oldCount); const next = Number(newCount);
      if (![Number(oldPosition), Number(newPosition), old, next].every(Number.isSafeInteger) || old + next === 0) patchError(file);
      hunk = { old, next }; contentLine = false; continue;
    }
    if (hunk) {
      if (line === '\\ No newline at end of file') {
        if (!contentLine) patchError(file);
        contentLine = false; continue;
      }
      const lead = line[0];
      if (lead === ' ' || lead === '-') hunk.old--;
      if (lead === ' ' || lead === '+') hunk.next--;
      if (![' ', '-', '+'].includes(lead) || hunk.old < 0 || hunk.next < 0) patchError(file);
      contentLine = true; continue;
    }
    if (line.startsWith('--- ')) { if (oldPath) patchError(file); oldPath = true; continue; }
    if (line.startsWith('+++ ')) { if (!oldPath || newPath) patchError(file); newPath = true; continue; }
    if (/^(?:old mode|new mode|deleted file mode|new file mode) [0-7]{6}$/.test(line) || /^Binary files .+ differ$/.test(line)) { metadata = true; continue; }
    if (/^index [0-9a-f]+\.\.[0-9a-f]+(?: [0-7]{6})?$/.test(line)) continue;
    patchError(file);
  }
  if ((!metadata && !hunk) || (hunk && (hunk.old !== 0 || hunk.next !== 0)) || oldPath !== newPath || (oldPath && !hunk)) patchError(file);
}

type StagedPatch = { byPath: Map<string, string[]>; ordered: { path: string; text: string }[] };
/** 非公開の純粋 parser。未知の区切り、欠落、切れた hunk を成功へ補わない。 */
export function splitStagedPatch(
  output: string, files: readonly string[], codes: ReadonlyMap<string, string>, allowExtra: (path: string) => boolean = () => false,
  allowEmptyModified = false,
): StagedPatch {
  const markers = [...output.matchAll(/^diff --git ([^\n]*)\n/gm)];
  if (output.slice(0, markers[0]?.index ?? output.length).replace(/\n/g, '') !== '') patchError(files[0] ?? '');
  const wanted = new Set(files); const byPath = new Map<string, string[]>();
  const ordered: StagedPatch['ordered'] = []; const candidates = [...codes.keys()];
  for (let i = 0; i < markers.length; i++) {
    const path = patchPath(markers[i][1], candidates);
    if (path === undefined || !codes.has(path)) patchError(files[0] ?? '');
    const text = output.slice(markers[i].index, markers[i + 1]?.index ?? output.length);
    completePatch(text, path);
    if (!wanted.has(path)) { if (!allowExtra(path)) patchError(path); continue; }
    const parts = byPath.get(path) ?? []; parts.push(text); byPath.set(path, parts); ordered.push({ path, text });
  }
  for (const file of files) {
    const code = codes.get(file); const expected = code === 'T' ? 2 : ['A', 'M', 'D'].includes(code ?? '') ? 1 : 0;
    // textconv が旧新を同じ表現にする M は、正常な Git 出力でも区切りがない。
    // 非曖昧な batchOutput を通った consumer だけが許可する。
    if (allowEmptyModified && code === 'M' && !byPath.has(file)) { byPath.set(file, []); continue; }
    if (!expected || byPath.get(file)?.length !== expected) patchError(file);
  }
  return { byPath, ordered };
}

function* stagedContentDiff(
  root: string, env: NodeJS.ProcessEnv, files: string[], codes: ReadonlyMap<string, string>, limits: GuardLimits,
): Generator<Map<string, string[]>> {
  let output: string | undefined;
  try {
    output = batchOutput(root, env, ['--literal-pathspecs', 'diff', '--cached', '-U0', ...PATCH_OPTIONS, '--', ...files], limits.maxOutputBytes).stdout;
  }
  catch (error) {
    if (!(error instanceof ProcessLimitError) || error.kind !== 'output' || files.length === 1) throw error;
  }
  // error の大きい部分出力は catch を抜けて解放し、子の群を lazy に読む。
  if (output === undefined) {
    const middle = Math.floor(files.length / 2);
    yield* stagedContentDiff(root, env, files.slice(0, middle), codes, limits);
    yield* stagedContentDiff(root, env, files.slice(middle), codes, limits);
    return;
  }
  const extra = (path: string) => codes.get(path) === 'D' && files.some((file) => path.startsWith(`${file}/`));
  yield splitStagedPatch(output, files, codes, extra, true).byPath;
}

/** UTF-8 prefix の末尾で StringDecoder が保留し得る最大3byteを安全側へ課金する。 */
export function chargedOutputBytes(bytes: number, room: number): number {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > room) throw new ProcessLimitError('output', 'git');
  return bytes >= room - 3 ? room : bytes;
}

function batchOutput(root: string, env: NodeJS.ProcessEnv, args: string[], room: number): ReturnType<typeof gitMeasured> {
  const result = gitMeasured(root, env, args, { maxBuffer: room });
  // U+FFFD は正常な本文にも存在する。上限近傍では復号後の切断と区別できないため停止する。
  if ((result.bytes >= room - 3 && result.hasReplacementCharacter) || (room <= 3 && result.stdout === '')) {
    throw new ProcessLimitError('output', 'git', '', '', '上限近傍で差分の完全性を確認できない');
  }
  return result;
}

/** 表示用。filter で捨てる差分も stderr も、先に合計予算へ数える。index からは公開しない。 */
export function stagedDisplayDiff(
  root: string, env: NodeJS.ProcessEnv, files: readonly string[], codes: ReadonlyMap<string, string>, limits: GuardLimits = DEFAULT_GUARD_LIMITS,
): string {
  let used = 0; const output: string[] = [];
  for (const group of groupPaths(files, limits.maxPathspecChars)) {
    const room = limits.maxOutputBytes - used;
    if (room <= 0) throw new ProcessLimitError('output', 'git');
    const result = batchOutput(root, env, ['--literal-pathspecs', 'diff', '--cached', ...PATCH_OPTIONS, '--', ...group], room);
    used += chargedOutputBytes(result.bytes, room);
    const extra = (path: string) => codes.has(path) && group.some((file) => path.startsWith(`${file}/`));
    const patch = splitStagedPatch(result.stdout, group, codes, extra, true);
    output.push(...patch.ordered.map((part) => part.text));
  }
  return output.join('');
}

/**
 * エンジンの変更を index に載せ、HEAD との差分から不正な直し方を探す（REQ-109〜REQ-111、仮定 A-20）。
 * テストファイルの削除、skip・todo の追加、HEAD にあったアサーションとテストの宣言の書き換え・削除を見る。
 * 見つけたら、その差分を返す。変更は index に載ったままなので、呼び出し側で戻すかコミットする
 */
export function findViolations(root: string, env: NodeJS.ProcessEnv, openspecDir = 'openspec'): { findings: GuardFinding[]; diff: string } {
  return findViolationsWithLimits(root, env, openspecDir);
}

/** 試験用の内部入口。index から公開しない。 */
export function findViolationsWithLimits(root: string, env: NodeJS.ProcessEnv, openspecDir = 'openspec', limits: GuardLimits = DEFAULT_GUARD_LIMITS): { findings: GuardFinding[]; diff: string } {
  const prefix = openspecPrefix(openspecDir);
  const specsDir = `${prefix}specs/`;
  const changesDir = `${prefix}changes/`;
  git(root, env, ['add', '-A']);
  const findings: GuardFinding[] = [];
  const statusOutput = git(root, env, ['diff', '--cached', '--name-status', '--no-renames', '-z']);
  const status = statusOutput.split('\0');
  if (statusOutput !== '' && (!statusOutput.endsWith('\0') || status.length % 2 !== 1)) {
    throw new GitError('git の操作に失敗しました：git diff --cached --name-status（パス一覧の終端か項目を確かめられません）');
  }
  const codes = new Map<string, string>();
  for (let i = 0; i + 1 < status.length; i += 2) {
    const code = status[i]; const file = status[i + 1];
    if (!code || !file || codes.has(file)) {
      throw new GitError('git の操作に失敗しました：git diff --cached --name-status（パス一覧の欠損か復号後の重複を検出しました）');
    }
    codes.set(file, code);
  }
  const groups = groupPaths([...codes.keys()].filter((file) => codes.get(file) !== 'D'), limits.maxPathspecChars);
  const batches = (function* () { for (const group of groups) yield* stagedContentDiff(root, env, group, codes, limits); })();
  let patches = new Map<string, string[]>();
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
      if (!patches.has(file)) { const next = batches.next(); if (next.done) patchError(file); patches = next.value; }
      const patch = patches.get(file); if (!patch) patchError(file);
      const lines = patch.join('').split('\n');
      const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
      for (const l of added) if (SKIP.test(l)) findings.push({ file, reason: `skip・todo を足しました：${l.slice(1).trim()}` });
      if (isTestFile(file)) {
        for (const l of added) if (TRIVIAL.test(l)) findings.push({ file, reason: `必ず通る検査を足しました：${l.slice(1).trim()}` });
        const removed = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
        const count = (xs: string[]) => xs.filter((l) => ASSERTION.test(l) && !NOT_ASSERTION.test(l)).length;
        if (code === 'M' && count(removed) > count(added)) findings.push({ file, reason: 'テストの検査を減らしました' });
      }
      // HEAD にあったテストファイルのアサーションとテストの宣言を、消すか書き換えたら止まる。同じ内容の行を足していれば、移しただけとみなす（REQ-109）
      if (code === 'M' && isTestFile(file)) {
        const kept = new Set(added.map((l) => l.slice(1).trim()));
        for (const l of lines.filter((x) => x.startsWith('-') && !x.startsWith('---'))) {
          const text = l.slice(1).trim();
          if (TEST_LINE.test(text) && !kept.has(text)) findings.push({ file, reason: `アサーションかテストを消すか書き換えました：${text}` });
        }
      }
    }
  }
  const files = [...new Set(findings.map((f) => f.file))];
  const diff = stagedDisplayDiff(root, env, files, codes, limits);
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
  sha: runExternal('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, env }).stdout.trim(),
  branch: runExternal('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, env }).stdout.trim(),
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

// シンボリックリンクはたどらない（REQ-204）。リンク先のないリンクでも落ちない
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() && !e.isSymbolicLink() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]))
    .sort();

const entryDigest = (file: string) => {
  const stat = lstatSync(file);
  if (stat.isSymbolicLink()) return `link:${readlinkSync(file)}`;
  if (!stat.isFile()) throw new UsageError(`Gitフック内の特殊ファイルは読み取れません。通常のファイルかシンボリックリンクにしてください：${file}`);
  return `${String(stat.mode & 0o111)}:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
};

/** git の設定とフックの状態。エンジンを呼ぶ前後で比べる（REQ-198） */
export type GitInternals = { config: string; hooks: string; digest: string };

/** git の設定ファイルの中身と、フックのディレクトリのファイルの相対パスと中身から、比べるための SHA-256 を作る */
export function gitInternals(root: string, env: NodeJS.ProcessEnv, places?: { config: string; hooks: string }): GitInternals {
  const config = places?.config ?? gitPath(root, env, 'config');
  const hooks = places?.hooks ?? gitPath(root, env, 'hooks');
  const hash = createHash('sha256');
  hash.update(existsSync(config) ? readFileSync(config) : '');
  // include の先・利用者全体・システム全体・worktree の設定も含めて、git が実際に使う設定を比べる（REQ-204）
  hash.update('\0config\0').update(runExternal('git', ['config', '--list', '--show-origin', '-z'], { cwd: root, env }).stdout);
  if (existsSync(hooks) && statSync(hooks).isDirectory()) {
    for (const file of filesUnder(hooks)) hash.update(`\0${relative(hooks, file)}\0${entryDigest(file)}`);
  }
  return { config, hooks, digest: hash.digest('hex') };
}

/**
 * エンジンが git の設定かフックを変えたかを調べる（REQ-198）。変えていれば、止まる理由と確かめる場所を返す。
 * run は書き換えを戻さず、このあとの git add・git commit も実行しない
 */
export function findInternalsChange(root: string, env: NodeJS.ProcessEnv, before: GitInternals): { reason: string; report: string } | undefined {
  // 呼ぶ前と同じ場所を読む。core.hooksPath を変えれば設定ファイルの中身が変わるので、場所を求め直さなくても見つかる
  const after = gitInternals(root, env, before);
  if (after.digest === before.digest) return undefined;
  const places = [before.config, before.hooks].map((p) => `  ${p}`);
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
