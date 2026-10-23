// run のテスト用に、一時ディレクトリに git のリポジトリと偽の claude コマンドを作る
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reportJson, specMd, traceMd } from '../../kit/test/project.js';

export const CHANGE = 'c1';

/** 偽の claude が 1 回の呼び出しですること */
export type FakeStep = {
  /** プロジェクトのルートからのパス → 中身 */
  write?: Record<string, string>;
  delete?: string[];
  /** write・delete のあとに実行する git のコマンドの引数（エンジン自身のコミットやブランチの切り替え） */
  git?: string[][];
  /** 標準出力の JSON の result に入れる文 */
  output?: string;
  sleepMs?: number;
  /** 終了コード。省くと 0 */
  exitCode?: number;
};

// 呼ばれた回数に応じて台本の手順を行い、引数と指示を記録する。台本が尽きたら何もしない
const FAKE_CLAUDE = `#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
if (step.sleepMs) await new Promise((r) => setTimeout(r, step.sleepMs));
for (const [p, text] of Object.entries(step.write ?? {})) { mkdirSync(dirname(join(process.cwd(), p)), { recursive: true }); writeFileSync(join(process.cwd(), p), text); }
for (const p of step.delete ?? []) rmSync(join(process.cwd(), p), { force: true });
for (const a of step.git ?? []) spawnSync('git', a, { stdio: 'ignore' });
console.log(JSON.stringify({ type: 'result', result: step.output ?? '終えました' }));
process.exitCode = step.exitCode ?? 0;
`;

// gh auth status は FAKE_GH_AUTH が fail のときと、リポジトリの 1 つ上に gh-logout があるとき（実行のあいだのログアウト）に失敗する。gh pr create は引数と本文を記録して URL を出す
const FAKE_GH = `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
if (args[0] === 'auth') process.exit(process.env.FAKE_GH_AUTH === 'fail' || existsSync(join(process.cwd(), '..', 'gh-logout')) ? 1 : 0);
const i = args.indexOf('--body-file');
appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ args, body: readFileSync(args[i + 1], 'utf8') }) + '\\n');
console.log('https://github.com/example/repo/pull/1');
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
  prs: () => { args: string[]; body: string }[];
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
    GIT_AUTHOR_NAME: 'loomake-test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'loomake-test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    DEVCONTAINER: '1',
    LOOMAKE_SANDBOX: undefined,
  };
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
