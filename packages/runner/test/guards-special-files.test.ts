import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

const runnerSource = join(import.meta.dirname, '../src');
const packages = join(import.meta.dirname, '../..');
const compilerOptions = { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 };
const DEPENDENCIES = ['core', 'kit', 'trace'] as const;

// 子プロセスは vitest の alias を使えないので、依存パッケージも dist ではなく src から変換して読む（CI は build の前に test を動かす）。
let dependencies: string | undefined;
const dependencyIndex = (name: string) => pathToFileURL(join(dependencies!, name, 'src/index.js')).href;
const rewriteWorkspaceImports = (content: string) => content.replace(/(['"])@loomake\/(core|kit|trace)\1/g, (_match, _quote: string, name: string) => JSON.stringify(dependencyIndex(name)));
function compileTree(source: string, target: string, accept: (name: string, directory: boolean) => boolean) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!accept(entry.name, entry.isDirectory())) continue;
    if (entry.isDirectory()) { compileTree(join(source, entry.name), join(target, entry.name), accept); continue; }
    writeFileSync(join(target, entry.name.replace(/\.ts$/, '.js')), transpileModule(rewriteWorkspaceImports(readFileSync(join(source, entry.name), 'utf8')), { compilerOptions }).outputText);
  }
}

// guards.tsを含む現在のrunnerのソースを読み込む。
type ProbeKind = 'snapshot' | 'run';
function executableRunner(base: string, kind: ProbeKind): string {
  const output = join(base, 'runner-probe');
  mkdirSync(output);
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  compileTree(runnerSource, output, (name, directory) => directory ? kind === 'run' : name.endsWith('.ts') && (kind === 'run' || ['guards.ts', 'git.ts'].includes(name)));
  return output;
}

function probe(repo: Repo, modules: string, kind: ProbeKind, action: string, timeout: number) {
  const imports = kind === 'snapshot'
    ? `const { gitInternals } = await import(${JSON.stringify(pathToFileURL(join(modules, 'guards.js')).href)});`
    : `const { runRun } = await import(${JSON.stringify(pathToFileURL(join(modules, 'run.js')).href)});`;
  const script = `import { writeSync } from 'node:fs';\nconst started = performance.now();\nconst phase = (name) => writeSync(2, JSON.stringify({ phase: name, elapsedMs: performance.now() - started }) + '\\n');\nphase('child-started');\n${imports}\nconst { UsageError } = await import(${JSON.stringify(dependencyIndex('kit'))});\nphase('imports-ready');\nwriteSync(1, 'probe-started\\n');\nphase(${JSON.stringify(kind + '-started')});\n${action}\nphase(${JSON.stringify(kind + '-finished')});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: repo.root, env: repo.env, encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
  expect(result.stdout, result.stderr).toContain('probe-started\n');
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.slice('probe-started\n'.length));
}
const runAction = `const output=[]; const code=await runRun({ root:process.cwd(),changeId:${JSON.stringify(CHANGE)},env:process.env,interactive:false,confirm:async()=>false,stdout:text=>output.push(text),fileExists:()=>false }); console.log(JSON.stringify({code,output}));`;
const snapshotAction = `try { const snapshot=gitInternals(process.cwd(),process.env); console.log(JSON.stringify({kind:'snapshot',snapshot})); } catch(error) { console.log(JSON.stringify({kind:'rejected',usageError:error instanceof UsageError,message:error.message})); }`;

function fifo(file: string) {
  const result = spawnSync('mkfifo', [file], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(lstatSync(file).isFIFO()).toBe(true);
}
const targetReason = (value: { code: number; output: string[] }, file: string) => {
  expect(value.code).toBe(1);
  expect(value.output.join('\n')).toContain(file);
  expect(value.output.join('\n')).toMatch(/特殊ファイル|通常のファイル/);
};

// 実際のPOSIXのFIFOとUnixソケットを使う。Windowsでの動作を示す試験ではない。
describe.runIf(process.platform !== 'win32')('フック内の特殊ファイルの実プロセス検査', () => {
  beforeAll(() => {
    dependencies = mkdtempSync(join(tmpdir(), 'loomake-probe-deps-'));
    writeFileSync(join(dependencies, 'package.json'), '{"type":"module"}');
    for (const name of DEPENDENCIES) {
      compileTree(join(packages, name, 'src'), join(dependencies, name, 'src'), (entry, directory) => directory || entry.endsWith('.ts'));
      // kit は src/ の 2 つ上にある supervisor/ と templates/ を実行時に読む
      for (const asset of ['supervisor', 'templates']) {
        const from = join(packages, name, asset);
        if (existsSync(from)) cpSync(from, join(dependencies, name, asset), { recursive: true });
      }
    }
  });
  afterAll(() => { if (dependencies) rmSync(dependencies, { recursive: true, force: true }); });

  it('[REQ-224] 通常ファイルのスナップショットは外側の期限内に返る', () => {
    const repo = makeRepo();
    try {
      repo.write('.git/hooks/probe-entry', 'ordinary hook\n');
      const result = probe(repo, executableRunner(repo.base, 'snapshot'), 'snapshot', snapshotAction, 3000);
      expect(result.kind).toBe('snapshot');
      expect(result.snapshot.digest).toMatch(/^[a-f0-9]{64}$/);
    } finally { repo.cleanup(); }
  });

  it('[REQ-224] 書き手のないFIFOを開かず対象を示すUsageErrorで拒否する', () => {
    const repo = makeRepo();
    try {
      const file = join(repo.root, '.git/hooks/probe-entry');
      fifo(file);
      const result = probe(repo, executableRunner(repo.base, 'snapshot'), 'snapshot', snapshotAction, 3000);
      expect(result).toMatchObject({ kind: 'rejected', usageError: true });
      expect(result.message).toContain(file);
      expect(result.message).toMatch(/特殊ファイル|通常のファイル/);
      expect(lstatSync(file).isFIFO()).toBe(true);
    } finally { repo.cleanup(); }
  });

  it('[REQ-224] Unixソケットを内容の読み取り前にUsageErrorで拒否する', async () => {
    const repo = makeRepo();
    const server = createServer();
    try {
      const file = join(repo.root, '.git/hooks/probe-entry');
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(file, resolve); });
      expect(lstatSync(file).isSocket()).toBe(true);
      const result = probe(repo, executableRunner(repo.base, 'snapshot'), 'snapshot', snapshotAction, 3000);
      expect(result).toMatchObject({ kind: 'rejected', usageError: true });
      expect(result.message).toContain(file);
      expect(result.message).toMatch(/特殊ファイル|通常のファイル/);
      expect(lstatSync(file).isSocket()).toBe(true);
    } finally {
      if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      repo.cleanup();
    }
  });

  it.each(['before', 'engine'] as const)('[REQ-224] %sのFIFOで通常runを止め、タスク・変更・コミットを保つ', (stage) => {
    const repo = makeRepo();
    try {
      const file = join(repo.root, '.git/hooks/probe-entry');
      if (stage === 'before') fifo(file);
      else {
        const engine = `#!/usr/bin/env node\nimport { readFileSync, writeFileSync } from 'node:fs';\nimport { spawnSync } from 'node:child_process';\nif(process.argv.includes('--version')) { console.log('fake'); process.exit(0); }\nreadFileSync(0,'utf8');\nwriteFileSync(process.env.FAKE_LOG, JSON.stringify({args:process.argv.slice(2),prompt:'probe'})+'\\n');\nwriteFileSync('impl.txt','preserved implementation\\n');\nconst result=spawnSync('mkfifo',[${JSON.stringify(file)}]);\nif(result.status!==0) process.exit(9);\nconsole.log(JSON.stringify({type:'result',result:'終えました'}));\n`;
        writeFileSync(join(repo.base, 'bin/claude'), engine); chmodSync(join(repo.base, 'bin/claude'), 0o755);
      }
      const head = repo.git('rev-parse', 'HEAD');
      const tasks = readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8');
      const result = probe(repo, executableRunner(repo.base, 'run'), 'run', runAction, 10_000);
      targetReason(result, file);
      expect(repo.calls()).toHaveLength(stage === 'before' ? 0 : 1);
      expect(repo.git('rev-parse', 'HEAD')).toBe(head);
      expect(readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8')).toBe(tasks);
      expect(lstatSync(file).isFIFO()).toBe(true);
      if (stage === 'engine') expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('preserved implementation\n');
      expect(repo.prs()).toEqual([]);
      expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
      expect(repo.git('ls-remote', 'origin')).toBe('');
      const runs = readdirSync(join(repo.root, '.loomake/runs')).filter((entry) => entry !== '.gitignore');
      expect(runs).toHaveLength(1);
      expect(JSON.parse(readFileSync(join(repo.root, '.loomake/runs', runs[0], 'summary.json'), 'utf8'))).toMatchObject({ status: 'stopped', doneTasks: [], reason: expect.stringContaining(file) });
    } finally { repo.cleanup(); }
  }, 15_000);

  it.each(['regular', 'dangling', 'directory'] as const)('[REQ-224][REQ-204] %sの既存フックを保ち、通常runでタスクをコミットする', (kind) => {
    const repo = makeRepo();
    try {
      const hook = join(repo.root, '.git/hooks/probe-entry');
      if (kind === 'regular') {
        const post = join(repo.root, '.git/hooks/post-commit');
        writeFileSync(post, `#!/bin/sh\nprintf ran >> '${join(repo.base, 'hook-ran')}'\n`); chmodSync(post, 0o755);
      } else {
        const target = join(repo.base, 'link-target');
        if (kind === 'directory') { mkdirSync(target); fifo(join(target, 'unread-fifo')); }
        symlinkSync(target, hook);
      }
      repo.plan([{ write: { 'impl.txt': 'implementation\n' } }, {}]);
      const result = probe(repo, executableRunner(repo.base, 'run'), 'run', runAction, 10_000);
      expect(result.code, result.output.join('\n')).toBe(0);
      expect(result.output.join('\n')).not.toContain('特殊ファイル');
      expect(readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8')).not.toContain('- [ ]');
      expect(repo.git('log', '--format=%s')).toContain('run(c1): 1.1 一つ目のタスク（REQ-012）');
      expect(repo.prs()).toHaveLength(1);
      if (kind === 'regular') expect(readFileSync(join(repo.base, 'hook-ran'), 'utf8')).toContain('ran');
      else expect(lstatSync(hook).isSymbolicLink()).toBe(true);
    } finally { repo.cleanup(); }
  }, 15_000);
});
