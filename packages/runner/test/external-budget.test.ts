import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { UsageError, runVerify } from '@loomake/kit';
import { withProcessBudget } from '../../kit/src/process.js';
import { runRecord } from '@loomake/trace';
import { runRun } from '@loomake/runner';
import { makeRepo, CHANGE, type Repo } from './helpers.js';

const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
function shim(repo: Repo, command: string, when: string, finishFirst = false) {
  const bin = join(repo.base, 'bin');
  const original = command === 'git' ? realGit : join(bin, `${command}-original`);
  if (command !== 'git') { writeFileSync(original, readFileSync(join(bin, command))); chmodSync(original, 0o755); }
  const script = `#!/usr/bin/env node
const fs=require('node:fs');const cp=require('node:child_process');const args=process.argv.slice(2);
function forward(){return cp.spawnSync(${JSON.stringify(original)},args,{stdio:'inherit'}).status??1;}
if(${when}) {${finishFirst ? 'forward();' : ''} fs.writeFileSync(${JSON.stringify(join(repo.base, 'stalled'))},'yes');process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(0),3000);} else process.exit(forward());
`;
  writeFileSync(join(bin, command), script); chmodSync(join(bin, command), 0o755);
}
async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
const budget = <T>(action: () => T) => withProcessBudget({ timeoutMs: 20_000, maxOperationMs: 500 }, action);
const summary = (repo: Repo) => { const dir = join(repo.root, '.loomake/runs'); const run = readdirSync(dir).filter((s) => s !== '.gitignore').sort().at(-1)!; return JSON.parse(readFileSync(join(dir, run, 'summary.json'), 'utf8')); };

describe('runから外部操作までの期限', () => {
  it('[REQ-182] ロック取得のGitが止まったら変更と記録を作らない', async () => {
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD'); shim(repo, 'git', "args.includes('--absolute-git-dir')");
      await expect(budget(() => run(repo))).rejects.toThrow(UsageError);
      expect(existsSync(join(repo.base, 'stalled'))).toBe(true);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    } finally { repo.cleanup(); }
  });
  it('[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{ sleepMs: 3000, write: { 'late.txt': '遅い変更' } }]);
      const start = Date.now();
      const result = await withProcessBudget({ timeoutMs: 1200 }, () => run(repo));
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('実行時間の上限');
      expect(Date.now() - start).toBeLessThan(2500);
      expect(existsSync(join(repo.root, 'late.txt'))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally { repo.cleanup(); }
  });
  it('[REQ-182] 検証がtasks.mdを変えたら上書きせず停止する', async () => {
    const repo = makeRepo();
    try {
      repo.write('write-report.mjs', "import { appendFileSync } from 'node:fs'; appendFileSync('openspec/changes/c1/tasks.md','変更された内容');");
      repo.git('add', 'write-report.mjs'); repo.git('commit', '-qm', '品質コマンドの変更');
      repo.plan([{}, {}]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('tasks.mdが変わりました');
      expect(readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8')).toContain('変更された内容');
      expect(repo.prs()).toEqual([]);
      expect(repo.git('log', '-1', '--format=%s')).not.toContain('完了ゲートに合格');
    } finally { repo.cleanup(); }
  });
  it.each(['push', 'auth', 'list', 'create'] as const)('[REQ-182] %sの期限後に先へ進まず、再実行で重複させない', async (stage) => {
    const repo = makeRepo();
    try {
      repo.plan([{ write: { 'impl.txt': '実装' } }, {}]);
      const command = stage === 'push' ? 'git' : 'gh';
      const condition = stage === 'push' ? "args[0]==='push'" : stage === 'auth' ? "args[0]==='auth'" : `args[0]==='pr' && args[1]===${JSON.stringify(stage)}`;
      shim(repo, command, condition, stage === 'create');
      const result = await budget(() => run(repo));
      expect(result.code, result.stdout).toBe(1);
      expect(result.stdout).toContain('実行時間の上限');
      expect(summary(repo).status).toBe('stopped');
      expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('実装');
      expect(repo.prs()).toHaveLength(stage === 'create' ? 1 : 0);
      const evidenceDir = join(repo.root, '.loomake/evidence', CHANGE);
      if (stage !== 'auth') expect(readdirSync(evidenceDir)).toHaveLength(1);
      if (stage === 'push') expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      // 元のコマンドへ戻し、通常の再試行で同じ証拠・PRを再利用する。
      if (command === 'git') { writeFileSync(join(repo.base, 'bin/git'), `#!/bin/sh\nexec ${realGit} "$@"\n`); }
      else writeFileSync(join(repo.base, 'bin/gh'), readFileSync(join(repo.base, 'bin/gh-original')));
      const retry = await run(repo);
      expect(retry.code, retry.stdout).toBe(0);
      expect(repo.prs()).toHaveLength(1);
      expect(readdirSync(evidenceDir)).toHaveLength(1);
      expect(repo.calls()).toHaveLength(2);
    } finally { repo.cleanup(); }
  });
});

describe('verifyとtraceの期限', () => {
  it('[REQ-183] traceのGitも共有予算で止める', () => {
    const repo = makeRepo(); const oldPath = process.env.PATH;
    try {
      shim(repo, 'git', "args[0]==='status'"); process.env.PATH = repo.env.PATH;
      expect(() => budget(() => runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} }))).toThrow('実行時間の上限');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally { process.env.PATH = oldPath; repo.cleanup(); }
  });
  it('[REQ-183] OpenSpec検証の時間切れをCLI不存在と区別する', () => {
    const repo = makeRepo(); const oldPath = process.env.PATH;
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: 'auto', commands: {} }));
      const executable = join(repo.base, 'bin/openspec'); writeFileSync(executable, '#!/usr/bin/env node\nsetTimeout(()=>{},3000)'); chmodSync(executable, 0o755); process.env.PATH = repo.env.PATH;
      const result = budget(() => runVerify({ root: repo.root, changeId: CHANGE, gate: 'spec-only' }));
      expect(result.ok).toBe(false);
      expect(result.results.find((r) => r.check === 'openspec validate')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { process.env.PATH = oldPath; repo.cleanup(); }
  });
  it('[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない', () => {
    const repo = makeRepo();
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { lint: `node -e "process.kill(process.ppid,'SIGINT');setInterval(()=>{},100)"`, test: `node -e "require('node:fs').writeFileSync('after','x')"` } }));
      // shellの親ではなく監視役へ送るため、shellからexecでNodeへ置き換える。
      const config = JSON.parse(readFileSync(join(repo.root, 'loomake.config.json'), 'utf8')); config.commands.lint = 'exec ' + config.commands.lint;
      repo.write('loomake.config.json', JSON.stringify(config));
      const result = withProcessBudget({ timeoutMs: 3000 }, () => runVerify({ root: repo.root }));
      expect(result.results.find((r) => r.check === 'command: lint')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
      expect(existsSync(join(repo.root, 'after'))).toBe(false);
    } finally { repo.cleanup(); }
  });
  it('[REQ-183] 明示したtimeoutMsがなくても共有期限で品質コマンドを止める', () => {
    const repo = makeRepo();
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node -e "setTimeout(()=>{},3000)"' } }));
      const result = withProcessBudget({ timeoutMs: 500 }, () => runVerify({ root: repo.root }));
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { repo.cleanup(); }
  });
});
