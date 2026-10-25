// run のテスト用に、一時ディレクトリに git のリポジトリと偽の claude コマンドを作る
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reportJson, specMd, traceMd } from '../../kit/test/project.js';
import { attachProcessDiagnostics } from './process-diagnostics.js';

export const CHANGE = 'c1';

/** 偽の claude が 1 回の呼び出しですること */
export type FakeStep = {
  /** プロジェクトのルートからのパス → 中身 */
  write?: Record<string, string>;
  delete?: string[];
  /** write のあとに実行権限を付けるパス（フックの書き換えの再現） */
  chmod?: string[];
  /** write・delete のあとに実行する git のコマンドの引数（エンジン自身のコミットやブランチの切り替え） */
  git?: string[][];
  /** 標準出力の JSON の result に入れる文 */
  output?: string;
  sleepMs?: number;
  pidFile?: string;
  /** 終了コード。省くと 0 */
  exitCode?: number;
};

// 呼ばれた回数に応じて台本の手順を行い、引数と指示を記録する。台本が尽きたら何もしない
const FAKE_CLAUDE = `#!/usr/bin/env node
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('fake'); process.exit(0); }
const prompt = readFileSync(0, 'utf8');
const log = process.env.FAKE_LOG;
const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\\n').filter(Boolean).length : 0;
appendFileSync(log, JSON.stringify({ args, prompt }) + '\\n');
const plan = JSON.parse(readFileSync(process.env.FAKE_PLAN, 'utf8'));
const step = plan[calls] ?? {};
if (step.pidFile) writeFileSync(step.pidFile, String(process.pid));
if (step.sleepMs) await new Promise((r) => setTimeout(r, step.sleepMs));
for (const [p, text] of Object.entries(step.write ?? {})) { mkdirSync(dirname(join(process.cwd(), p)), { recursive: true }); writeFileSync(join(process.cwd(), p), text); }
for (const p of step.chmod ?? []) chmodSync(join(process.cwd(), p), 0o755);
for (const p of step.delete ?? []) rmSync(join(process.cwd(), p), { force: true });
for (const a of step.git ?? []) spawnSync('git', a, { stdio: 'ignore' });
console.log(JSON.stringify({ type: 'result', result: step.output ?? '終えました' }));
process.exitCode = step.exitCode ?? 0;
`;

// PRの検索・作成と、作成前後の失敗を再現する。prs()は作成の記録だけを返す。
const FAKE_GH = `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === 'auth') {
  const status = process.env.FAKE_GH_AUTH === 'fail' || existsSync(join(process.cwd(), '..', 'gh-logout')) ? 1 : 0;
  if (process.env.FAKE_GH_AUTH_LOG) appendFileSync(process.env.FAKE_GH_AUTH_LOG, JSON.stringify({ args, status }) + '\\n');
  process.exit(status);
}
if (args[0] === 'pr' && args[1] === 'list') {
  appendFileSync(process.env.FAKE_GH_LOOKUP_LOG, JSON.stringify(args) + '\\n');
  if (process.env.FAKE_GH_LOOKUP === 'fail') { console.error('検索できません'); process.exit(1); }
  console.log(process.env.FAKE_GH_RESULT ?? (existsSync(process.env.FAKE_GH_STATE) ? readFileSync(process.env.FAKE_GH_STATE, 'utf8') : '[]'));
  process.exit(0);
}
const i = args.indexOf('--body-file');
let snapshot;
if (process.env.FAKE_GH_SNAPSHOT === '1') {
  const git = (...args) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'Git snapshot failed');
    return result.stdout.trim();
  };
  snapshot = {
    head: git('rev-parse', 'HEAD'),
    files: git('show', '--name-only', '--format=', 'HEAD').split('\\n'),
    remoteHead: git('ls-remote', 'origin', 'refs/heads/' + args[args.indexOf('--head') + 1]).split('\\t')[0],
  };
}
appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ args, body: readFileSync(args[i + 1], 'utf8'), snapshot }) + '\\n');
if (process.env.FAKE_GH_CREATE === 'before') { console.error('作成前に失敗'); process.exit(1); }
const url = 'https://github.com/example/repo/pull/1';
writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify([{ url, baseRefName: args[args.indexOf('--base') + 1], headRefName: args[args.indexOf('--head') + 1], isCrossRepository: false }]));
if (process.env.FAKE_GH_CREATE === 'after') { console.error('作成後に応答を失いました'); process.exit(1); }
console.log(url);
`;

const TASKS = ['## 1. 実装', '- [ ] 1.1 一つ目のタスク（REQ-012）', '- [ ] 1.2 二つ目のタスク', '', '## 3. 確認', '- [ ] 3.1 `pnpm -s verify --change c1 --done` を通す', ''].join('\n');

export type Repo = {
  root: string;
  env: NodeJS.ProcessEnv;
  write: (p: string, text: string) => void;
  /** 台本を決める */
  plan: (steps: FakeStep[]) => void;
  /** 偽の claude が呼ばれた記録 */
  calls: () => { args: string[]; prompt: string }[];
  /** 偽の gh pr create が呼ばれた記録 */
  prs: () => { args: string[]; body: string; snapshot?: { head: string; files: string[]; remoteHead: string } }[];
  base: string;
  git: (...args: string[]) => string;
  cleanup: () => void;
};

/**
 * change c1 を持つ git のリポジトリを作ってコミットする。
 * test コマンドは impl.txt があれば [REQ-012] の合格したテストを、なければ空のレポートを書き出す（完了ゲートの合否をエンジンの変更で決める）
 */
export function makeRepo({ trace = traceMd(), tasks = TASKS, run }: { trace?: string; tasks?: string; run?: object } = {}): Repo {
  const base = mkdtempSync(join(tmpdir(), 'loomake-run-'));
  const root = join(base, 'repo');
  const bin = join(base, 'bin');
  mkdirSync(root);
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), FAKE_CLAUDE);
  chmodSync(join(bin, 'claude'), 0o755);
  writeFileSync(join(bin, 'claude.cmd'), '@node "%~dp0claude" %*\r\n');
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  writeFileSync(join(bin, 'gh.cmd'), '@node "%~dp0gh" %*\r\n');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
    FAKE_LOG: join(base, 'calls.jsonl'),
    FAKE_PLAN: join(base, 'plan.json'),
    FAKE_GH_LOG: join(base, 'gh.jsonl'),
    FAKE_GH_LOOKUP_LOG: join(base, 'gh-lookup.jsonl'),
    FAKE_GH_STATE: join(base, 'gh-state.json'),
    GIT_AUTHOR_NAME: 'loomake-test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'loomake-test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    DEVCONTAINER: '1',
    LOOMAKE_SANDBOX: undefined,
  };
  attachProcessDiagnostics(base, env);
  writeFileSync(env.FAKE_PLAN!, '[]');
  const write = (p: string, text: string) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  };
  const gitRun = (...args: string[]) => {
    const r = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
  };
  const report = (passed: boolean) => JSON.stringify(reportJson(root, passed ? { 'tests/x.test.ts': [['[REQ-012] 確かめる', 'passed']] } : {}));
  write(
    'write-report.mjs',
    `import { existsSync, mkdirSync, writeFileSync } from 'node:fs';\nmkdirSync('.loomake', { recursive: true });\nwriteFileSync('.loomake/test-report.json', existsSync('impl.txt') ? ${report(true)} : ${report(false)});\n`,
  );
  write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node write-report.mjs' }, ...(run ? { run } : {}) }));
  write('.gitignore', '.loomake/test-report.json\n');
  write('AGENTS.md', '# AGENTS.md\n\nテスト用の共通ルール。\n');
  write(`openspec/changes/${CHANGE}/proposal.md`, `# ${CHANGE}\n\n## Why\n検査用。\n\n## What Changes\n- 検査用\n`);
  write(`openspec/changes/${CHANGE}/tasks.md`, tasks);
  write(`openspec/changes/${CHANGE}/trace.md`, trace);
  write(`openspec/changes/${CHANGE}/specs/x/spec.md`, specMd());
  gitRun('init', '-q', '-b', 'main');
  gitRun('add', '-A');
  gitRun('commit', '-q', '-m', 'init');
  // origin は一時ディレクトリの bare リポジトリ
  spawnSync('git', ['init', '-q', '--bare', join(base, 'origin.git')], { env });
  gitRun('remote', 'add', 'origin', join(base, 'origin.git'));
  return {
    root,
    env,
    write,
    plan: (steps) => writeFileSync(env.FAKE_PLAN!, JSON.stringify(steps)),
    calls: () =>
      existsSync(env.FAKE_LOG!)
        ? readFileSync(env.FAKE_LOG!, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l))
        : [],
    prs: () =>
      existsSync(env.FAKE_GH_LOG!)
        ? readFileSync(env.FAKE_GH_LOG!, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l))
        : [],
    base,
    git: gitRun,
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

/** 偽の CLI が残す印。時刻は Date.now() */
export type FakeCliEvent = {
  event: 'shim-start' | 'forward-start' | 'forward-end' | 'stall-start' | 'delay-start' | 'shim-end';
  at: number;
  pid: number;
  command: string;
  args: string[];
  status?: number | null;
  signal?: string | null;
  error?: string;
  code?: number;
};

export type FakeCliOptions = {
  /** 偽の CLI が止まる（delayMs なら遅らせる）条件。args（引数の配列）と fs（node:fs）を使う JavaScript の式 */
  when: string;
  /** 止まる前に本物へ転送して終える（PR を作ったあとで応答が届かない場合の再現） */
  forwardFirst?: boolean;
  /** 止まる時間。SIGTERM は無視し、SIGKILL か taskkill でだけ途中で終わる。省くと 10 秒 */
  stallMs?: number;
  /** 止まる代わりに、この時間だけ待ってから本物へ転送する */
  delayMs?: number;
};

export type FakeCli = {
  /** 偽の CLI の印を、書かれた順に返す */
  events: () => FakeCliEvent[];
  /** 偽の CLI を外し、元のコマンドに戻す */
  restore: () => void;
};

const isWindows = process.platform === 'win32';

// bin を除いた PATH から、本物の実行ファイルを探す。Windows は shell なしの起動と同じく .exe だけを探す
function findReal(name: string, path: string, exclude: string): string {
  for (const dir of path.split(delimiter)) {
    if (!dir || resolve(dir) === resolve(exclude)) continue;
    const candidate = join(dir, isWindows ? `${name}.exe` : name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`本物の ${name} が PATH に見つかりません`);
}

/**
 * 偽の CLI を repo の bin に置く（windows-fake-clis の REQ-240）。製品と同じ起動の仕方で呼ばれるように、OS とコマンドで形を変える。
 * - POSIX：bin/<名前> に shebang つきの本体を置く
 * - Windows の gh・openspec（shell 経由で起動する）：bin/<名前> に本体を、bin/<名前>.cmd に node で本体を起動する入口を置く
 * - Windows の git（shell なしで起動するので .exe しか探されない）：process.execPath を bin/git.exe にハードリンクし、
 *   NODE_OPTIONS の --require で本体を読み込む。本体は実行ファイルの名前が git.exe のときだけ動き、同期的に終える
 * 本体は、条件に合えば止まり（delayMs なら遅らせてから転送し）、合わなければ本物へ転送する。node のスクリプトの元は process.execPath で起動する。
 * Windows の git.exe は Node なので、最初の引数が - で始まる呼び出し（git --version など）は偽の git として動かない。
 */
export function fakeCli(repo: Repo, command: 'git' | 'gh' | 'openspec', options: FakeCliOptions): FakeCli {
  const bin = join(repo.base, 'bin');
  const log = join(repo.base, `fake-${command}.jsonl`);
  const git = command === 'git';
  // 元：git は本物の実行ファイル、gh は makeRepo が置いた node のスクリプト、openspec は元なし
  let original = '';
  if (git) original = findReal('git', repo.env.PATH ?? '', bin);
  else if (existsSync(join(bin, command))) {
    original = join(bin, `${command}-original`);
    copyFileSync(join(bin, command), original);
  }
  const settings = {
    log,
    command,
    original,
    viaNode: !git,
    stalled: join(repo.base, 'stalled'),
    stallMs: options.stallMs ?? 10_000,
    delayMs: options.delayMs ?? 0,
    forwardFirst: options.forwardFirst ?? false,
  };
  const body = `const fs=require('node:fs');const cp=require('node:child_process');
const S=${JSON.stringify(settings)};
function event(name,details){fs.appendFileSync(S.log,JSON.stringify({event:name,at:Date.now(),pid:process.pid,command:S.command,args:args.slice(0,12).map((a)=>String(a).slice(0,160)),...details})+'\\n');}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function forward(){
  event('forward-start');
  if(!S.original){event('forward-end',{status:null,signal:null,error:'ENOENT'});return 127;}
  const r=cp.spawnSync(S.viaNode?process.execPath:S.original,S.viaNode?[S.original,...args]:args,{stdio:'inherit'});
  event('forward-end',{status:r.status,signal:r.signal,error:r.error?.code});
  return r.status??1;
}
event('shim-start');
process.on('exit',(code)=>event('shim-end',{code}));
if(${options.when}){
  if(S.delayMs){event('delay-start',{ms:S.delayMs});sleep(S.delayMs);process.exit(forward());}
  if(S.forwardFirst)forward();
  event('stall-start',{ms:S.stallMs});fs.writeFileSync(S.stalled,'yes');process.on('SIGTERM',()=>{});sleep(S.stallMs);process.exit(0);
}
process.exit(forward());
`;
  let restore: () => void;
  if (git && isWindows) {
    const exe = join(bin, 'git.exe');
    try {
      linkSync(process.execPath, exe);
    } catch {
      copyFileSync(process.execPath, exe);
    }
    const preload = join(bin, 'fake-git.cjs');
    // Node は git.exe の最初の引数をメインのスクリプトとみなし、絶対パスに直して process.argv[1] に入れる
    writeFileSync(
      preload,
      `if(require('node:path').basename(process.execPath).toLowerCase()==='git.exe'){
const args=process.argv.length>1?[require('node:path').relative(process.cwd(),process.argv[1]),...process.argv.slice(2)]:[];
${body}}\n`,
    );
    repo.env.NODE_OPTIONS = `${repo.env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preload)}`.trim();
    // 本体は git.exe のときだけ動くので、NODE_OPTIONS は戻さない。止めた git.exe の終了を待って消す
    restore = () => rmSync(exe, { force: true, maxRetries: 20, retryDelay: 100 });
  } else {
    const file = join(bin, command);
    writeFileSync(file, `#!/usr/bin/env node\nconst args=process.argv.slice(2);\n${body}`);
    chmodSync(file, 0o755);
    if (isWindows) writeFileSync(join(bin, `${command}.cmd`), `@node "%~dp0${command}" %*\r\n`);
    restore = () => (original && !git ? copyFileSync(original, file) : rmSync(file, { force: true }));
  }
  return {
    events: () =>
      existsSync(log)
        ? readFileSync(log, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as FakeCliEvent)
        : [],
    restore,
  };
}

/**
 * 偽の CLI が狙った操作で止まった印（stall-start）と、それより前に起動に失敗した転送（error のある forward-end）を返す（REQ-240）。
 * 試験は、期限・終了コードを確かめる前に、stall があって failedForwards が空であることを確かめる
 */
export function stallOf(cli: FakeCli, match: (args: string[]) => boolean): { stall?: FakeCliEvent; failedForwards: FakeCliEvent[] } {
  const events = cli.events();
  const index = events.findIndex((e) => e.event === 'stall-start' && match(e.args));
  const before = index < 0 ? events : events.slice(0, index);
  return { stall: index < 0 ? undefined : events[index], failedForwards: before.filter((e) => e.event === 'forward-end' && e.error) };
}
