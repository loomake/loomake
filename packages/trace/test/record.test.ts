import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runRecord, type Evidence } from '@loomake/trace';
import { main } from '../../cli/src/main.js';
import { CHANGE, reportJson, specMd, traceMd } from '../../kit/test/project.js';

const gitRun = (root: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=loomake-test', '-c', 'user.email=test@example.com', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

/**
 * 一時ディレクトリに、change c1 を持つ git のリポジトリを作ってコミットする。
 * test コマンドは、passed が true なら [REQ-012] の合格したテストを、false なら何も含まないレポートを書き出す
 */
function makeRepo({ passed = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-trace-'));
  const write = (p: string, text: string) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  };
  const report = reportJson(root, passed ? { 'tests/x.test.ts': [['[REQ-012] 確かめる', 'passed']] } : {});
  write('write-report.mjs', `import { mkdirSync, writeFileSync } from 'node:fs';\nmkdirSync('.loomake', { recursive: true });\nwriteFileSync('.loomake/test-report.json', ${JSON.stringify(report)});\n`);
  write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node write-report.mjs' } }));
  write('.gitignore', '.loomake/test-report.json\n*.log\n');
  write(`openspec/changes/${CHANGE}/proposal.md`, `# ${CHANGE}\n\n## Why\n検査用。\n`);
  write(`openspec/changes/${CHANGE}/tasks.md`, '## 1. 実装\n- [x] 1.1 検査用のタスク\n');
  write(`openspec/changes/${CHANGE}/trace.md`, traceMd());
  write(`openspec/changes/${CHANGE}/specs/x/spec.md`, specMd());
  gitRun(root, 'init', '-q');
  gitRun(root, 'add', '-A');
  gitRun(root, 'commit', '-q', '-m', 'init');
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function record(root: string, now = new Date('2026-10-23T01:02:03.456Z')) {
  const out: string[] = [];
  const code = runRecord({ root, changeId: CHANGE, stdout: (t) => out.push(t), now: () => now });
  return { code, stdout: out.join('\n') };
}

const evidenceDir = (root: string) => join(root, '.loomake/evidence', CHANGE);
const evidenceFiles = (root: string) => (existsSync(evidenceDir(root)) ? readdirSync(evidenceDir(root)).sort() : []);
const readEvidence = (root: string, name: string): Evidence => JSON.parse(readFileSync(join(evidenceDir(root), name), 'utf8'));

describe('証拠の記録', () => {
  it('[REQ-066] 完了ゲートに合格した結果を、SHA・コミットの日時・記録した日時と合わせて保存し、終了コード 0 を返す', () => {
    const repo = makeRepo();
    try {
      const sha = gitRun(repo.root, 'rev-parse', 'HEAD');
      const r = record(repo.root);
      expect(r.code).toBe(0);
      const files = evidenceFiles(repo.root);
      expect(files).toEqual([`20261023T010203Z-${sha.slice(0, 12)}.json`]);
      const e = readEvidence(repo.root, files[0]);
      expect(e).toMatchObject({ schemaVersion: 1, change: CHANGE, sha, recordedAt: '2026-10-23T01:02:03.456Z' });
      expect(e.committedAt).toBe(gitRun(repo.root, 'show', '-s', '--format=%cI', 'HEAD'));
      expect(e.verify).toMatchObject({ mode: 'done', change: CHANGE, ok: true });
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-066] 記録したファイルのパスと、git にコミットするよう促す案内を表示する', () => {
    const repo = makeRepo();
    try {
      const r = record(repo.root);
      const [file] = evidenceFiles(repo.root);
      expect(r.stdout).toContain(`.loomake/evidence/${CHANGE}/${file}`);
      expect(r.stdout).toContain('git にコミットしてください');
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-066] 完了ゲートに不合格でも結果を記録し、終了コード 1 を返す', () => {
    const repo = makeRepo({ passed: false });
    try {
      const r = record(repo.root);
      expect(r.code).toBe(1);
      const files = evidenceFiles(repo.root);
      expect(files).toHaveLength(1);
      expect(readEvidence(repo.root, files[0]).verify.ok).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-066] change-id が change 名の形でないか archive なら、何も記録せず、終了コード 2 を返す', async () => {
    const repo = makeRepo();
    try {
      for (const id of ['C1', 'archive']) {
        const err: string[] = [];
        const code = await main(['trace', 'record', '--change', id], { cwd: repo.root, stdout: () => {}, stderr: (t) => err.push(t) });
        expect(code, id).toBe(2);
        expect(err.join('\n'), id).toMatch(/英小文字・数字|archive は change-id に使えません/);
      }
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-066] change-id にパスの区切りを含めると、何も記録せず、日本語のエラーを出して終了コード 2 を返す', async () => {
    const repo = makeRepo();
    try {
      const err: string[] = [];
      const code = await main(['trace', 'record', '--change', '../../packages'], { cwd: repo.root, stdout: () => {}, stderr: (t) => err.push(t) });
      expect(code).toBe(2);
      expect(err.join('\n')).toContain('パスの区切り');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-066] 存在しない change では何も記録せず、日本語のエラーを出して終了コード 2 を返す', async () => {
    const repo = makeRepo();
    try {
      const err: string[] = [];
      const code = await main(['trace', 'record', '--change', 'nothing'], { cwd: repo.root, stdout: () => {}, stderr: (t) => err.push(t) });
      expect(code).toBe(2);
      expect(err.join('\n')).toContain('change「nothing」がありません');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally {
      repo.cleanup();
    }
  });
});

describe('未コミットの変更があるときは記録しない', () => {
  it('[REQ-067] コミット済みのファイルを書き換えていたら、ファイル名を出して記録せず、終了コード 1 を返す', () => {
    const repo = makeRepo();
    try {
      repo.write(`openspec/changes/${CHANGE}/proposal.md`, '# 書き換えた\n');
      const r = record(repo.root);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('未コミットの変更');
      expect(r.stdout).toContain(`openspec/changes/${CHANGE}/proposal.md`);
      expect(evidenceFiles(repo.root)).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-067] git が追跡していない新しいファイルがあれば、記録しない', () => {
    const repo = makeRepo();
    try {
      repo.write('new.txt', '新しいファイル\n');
      const r = record(repo.root);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('new.txt');
      expect(evidenceFiles(repo.root)).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-067] .gitignore で除外したファイルだけが変わっていれば、記録する', () => {
    const repo = makeRepo();
    try {
      repo.write('debug.log', 'ログ\n');
      expect(record(repo.root).code).toBe(0);
      expect(evidenceFiles(repo.root)).toHaveLength(1);
    } finally {
      repo.cleanup();
    }
  });
});

describe('記録を書き換えない', () => {
  it('[REQ-068] 2 回記録すると、ファイルが 2 つになり、1 回目のファイルは変わらない', () => {
    const repo = makeRepo();
    try {
      record(repo.root, new Date('2026-10-23T01:00:00Z'));
      const [first] = evidenceFiles(repo.root);
      const before = readFileSync(join(evidenceDir(repo.root), first), 'utf8');
      gitRun(repo.root, 'add', '-A');
      gitRun(repo.root, 'commit', '-q', '-m', '1 回目の記録');
      expect(record(repo.root, new Date('2026-10-23T02:00:00Z')).code).toBe(0);
      expect(evidenceFiles(repo.root)).toHaveLength(2);
      expect(readFileSync(join(evidenceDir(repo.root), first), 'utf8')).toBe(before);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-068] 同じ名前の記録がすでにあれば、書き換えずに終了コード 1 を返す', () => {
    const repo = makeRepo();
    try {
      // .loomake/ を丸ごと除外したプロジェクトなら、記録が先にあっても作業ツリーはきれいなまま
      repo.write('.gitignore', '.loomake/\n*.log\n');
      gitRun(repo.root, 'commit', '-q', '-am', '.loomake/ を除外する');
      const sha = gitRun(repo.root, 'rev-parse', 'HEAD');
      const path = join(evidenceDir(repo.root), `20261023T010203Z-${sha.slice(0, 12)}.json`);
      repo.write(path.slice(repo.root.length + 1), '先にある記録\n');
      const r = record(repo.root);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('すでにある');
      expect(readFileSync(path, 'utf8')).toBe('先にある記録\n');
    } finally {
      repo.cleanup();
    }
  });
});

describe('オフラインでの動作と依存', () => {
  const src = join(import.meta.dirname, '../src');
  const sources = readdirSync(src).map((f) => readFileSync(join(src, f), 'utf8'));

  it('[REQ-084] trace のコードは、ネットワークを使うモジュールと fetch を使わない', () => {
    for (const text of sources) {
      expect(text).not.toMatch(/from 'node:(http|https|net|dgram|tls)'/);
      expect(text).not.toMatch(/\bfetch\(/);
    }
  });

  it('[REQ-083] @loomake/trace の dependencies は @loomake/core と @loomake/kit だけ', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@loomake/core', '@loomake/kit']);
  });

  it('[REQ-089] @loomake/trace の engines.node は >=20.19.0', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
    expect(pkg.engines?.node).toBe('>=20.19.0');
  });
});

describe('検証した時点の文書の保存', () => {
  it('[REQ-127] trace.md と差分仕様のパス・内容・SHA-256 を記録に保存する', () => {
    const repo = makeRepo();
    try {
      expect(record(repo.root).code).toBe(0);
      const e = readEvidence(repo.root, evidenceFiles(repo.root)[0]);
      const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
      expect(e.documents).toEqual([
        { path: 'trace.md', sha256: sha256(traceMd()), content: traceMd() },
        { path: 'specs/x/spec.md', sha256: sha256(specMd()), content: specMd() },
      ]);
    } finally {
      repo.cleanup();
    }
  });
});

describe('検査のあいだの変更', () => {
  it('[REQ-128] 品質コマンドが追跡しているファイルを書き換えたら、記録せずに終了コード 1 を返す', () => {
    const repo = makeRepo();
    try {
      const script = readFileSync(join(repo.root, 'write-report.mjs'), 'utf8');
      repo.write('write-report.mjs', `${script}writeFileSync('tracked.txt', '書き換えた\\n');\n`);
      repo.write('tracked.txt', '元\n');
      gitRun(repo.root, 'add', '-A');
      gitRun(repo.root, 'commit', '-q', '-m', '追跡しているファイルを書き換えるテスト');
      const r = record(repo.root);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('検査のあいだに作業ツリーのファイルが変わったので、記録しませんでした');
      expect(r.stdout).toContain('tracked.txt');
      expect(evidenceFiles(repo.root)).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-128] 品質コマンドが .gitignore で除外したテストのレポートだけを書き出すなら、記録する', () => {
    const repo = makeRepo();
    try {
      expect(record(repo.root).code).toBe(0);
      expect(existsSync(join(repo.root, '.loomake/test-report.json'))).toBe(true);
      expect(evidenceFiles(repo.root)).toHaveLength(1);
    } finally {
      repo.cleanup();
    }
  });
});
