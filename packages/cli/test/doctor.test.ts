import { describe, it, expect } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runDoctor } from '@loomake/kit';
import { main } from '../src/main.js';

const win = process.platform === 'win32';

/** 中身のない実行ファイルを置いた bin を作る。doctor は実行しないので中身は問わない */
function makeBin(base: string, names: string[]): string {
  const bin = join(base, 'bin');
  mkdirSync(bin, { recursive: true });
  for (const n of names) {
    const p = join(bin, win ? `${n}.cmd` : n);
    writeFileSync(p, '');
    chmodSync(p, 0o755);
  }
  return bin;
}

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '.git' ? [] : listFiles(join(dir, e.name))) : [join(dir, e.name)]));

/**
 * 一時ディレクトリに git のリポジトリを作り、loomake init を実行してから setup を呼び、doctor を実行する。
 * bin には commands と使う CLI の実行ファイルを置く
 */
async function doctor({ bin = ['pnpm', 'openspec', 'claude', 'gh'], init = true, setup }: { bin?: string[]; init?: boolean; setup?: (root: string) => void } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'loomake-doctor-'));
  const root = join(base, 'repo');
  mkdirSync(root);
  try {
    spawnSync('git', ['init', '-q'], { cwd: root });
    if (init) {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0', devDependencies: { loomake: '*' } }));
      await main(['init'], { cwd: root, stdout: () => {}, stderr: () => {} });
      mkdirSync(join(root, 'openspec'));
    }
    setup?.(root);
    const before = Object.fromEntries(listFiles(root).map((f) => [relative(root, f).split(sep).join('/'), readFileSync(f, 'utf8')]));
    const out: string[] = [];
    const code = runDoctor({ root, stdout: (t) => out.push(t), path: [makeBin(base, bin)].join(delimiter) });
    const after = Object.fromEntries(listFiles(root).map((f) => [relative(root, f).split(sep).join('/'), readFileSync(f, 'utf8')]));
    return { code, stdout: out.join('\n'), before, after };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const write = (root: string, p: string, text: string) => {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), text);
};

describe('導入状態の診断', () => {
  it('[REQ-134] すべて整っていれば、すべての項目を合格と表示し、終了コード 0 を返す', async () => {
    const r = await doctor();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('問題 0 件、注意 0 件');
    expect(r.stdout).not.toMatch(/[✖⚠]/);
    expect(r.stdout).toContain('✔ test のコマンド（pnpm test）の pnpm が見つかります');
  });

  it('[REQ-134] doctor はプロジェクトのファイルを追加も変更もしない', async () => {
    const r = await doctor({ init: false, bin: [] });
    expect(r.after).toEqual(r.before);
    const s = await doctor();
    expect(s.after).toEqual(s.before);
  });

  it('[REQ-134] loomake doctor --help は使い方を出し、doctor にほかのオプションを渡すと使い方の誤りにする', async () => {
    const out: string[] = [];
    const err: string[] = [];
    expect(await main(['doctor', '--help'], { cwd: tmpdir(), stdout: (t) => out.push(t), stderr: () => {} })).toBe(0);
    expect(out.join('\n')).toContain('使い方: loomake doctor');
    expect(await main(['doctor', '--fix'], { cwd: tmpdir(), stdout: () => {}, stderr: (t) => err.push(t) })).toBe(2);
    expect(err.join('\n')).toContain('知らないオプションです：--fix');
  });
});

describe('診断する項目', () => {
  it('[REQ-134] loomake.config.json がなければ、loomake init を案内して終了コード 1 を返す', async () => {
    const r = await doctor({ init: false });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('✖ loomake.config.json がありません');
    expect(r.stdout).toContain('→ loomake init を実行してください');
  });

  it('[REQ-134] テストのレポートが除外されていなければ、足す行を案内して終了コード 1 を返す', async () => {
    const r = await doctor({ setup: (root) => writeFileSync(join(root, '.gitignore'), 'node_modules/\n') });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('✖ テストのレポート（.loomake/test-report.json）が .gitignore で除外されていません');
    expect(r.stdout).toContain('→ .gitignore に .loomake/test-report.json の行を足してください');
  });

  it('[REQ-134] .loomake/ を除外していれば、証拠の記録をコミットできないことと直し方を表示して終了コード 1 を返す', async () => {
    const r = await doctor({ setup: (root) => writeFileSync(join(root, '.gitignore'), '.loomake/\n') });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('✖ 証拠の記録（.loomake/evidence/）が .gitignore で除外されていて、コミットできません');
    expect(r.stdout).toContain('!.loomake/evidence/');
  });

  it('[REQ-134] 品質コマンドの実行ファイルが見つからなければ、終了コード 1 を返す', async () => {
    const r = await doctor({
      setup: (root) => {
        const p = join(root, 'loomake.config.json');
        const config = JSON.parse(readFileSync(p, 'utf8'));
        writeFileSync(p, JSON.stringify({ ...config, commands: { ...config.commands, test: 'nothing-command run' } }));
      },
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('✖ test のコマンド（nothing-command run）の nothing-command が見つかりません');
  });

  it('[REQ-134] node_modules/.bin の実行ファイルも見つける', async () => {
    const r = await doctor({
      bin: ['openspec', 'claude', 'gh'],
      setup: (root) => {
        for (const n of ['pnpm']) write(root, `node_modules/.bin/${win ? `${n}.cmd` : n}`, '');
      },
    });
    expect(r.code).toBe(0);
  });

  it('[REQ-134] claude と gh がなければ注意として表示し、ほかが整っていれば終了コード 0 を返す', async () => {
    const r = await doctor({ bin: ['pnpm', 'openspec'] });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('⚠ claude コマンドが見つかりません');
    expect(r.stdout).toContain('⚠ gh コマンドが見つかりません');
    expect(r.stdout).toContain('問題 0 件、注意 2 件');
  });

  it('[REQ-134] openspec がないとき、openspecValidate が auto なら注意、true なら問題にする', async () => {
    const auto = await doctor({ bin: ['pnpm', 'claude', 'gh'] });
    expect(auto.code).toBe(0);
    expect(auto.stdout).toContain('⚠ openspec コマンドが見つかりません');
    const strict = await doctor({
      bin: ['pnpm', 'claude', 'gh'],
      setup: (root) => {
        const p = join(root, 'loomake.config.json');
        writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), openspecValidate: true }));
      },
    });
    expect(strict.code).toBe(1);
    expect(strict.stdout).toContain('✖ openspec コマンドが見つかりません');
  });

  it('[REQ-134] AGENTS.md と openspec/ がなく、git のリポジトリでもなければ、それぞれを問題として表示する', async () => {
    const base = mkdtempSync(join(tmpdir(), 'loomake-doctor-'));
    try {
      writeFileSync(join(base, 'loomake.config.json'), JSON.stringify({ commands: { test: 'pnpm test' } }));
      const out: string[] = [];
      const code = runDoctor({ root: base, stdout: (t) => out.push(t), path: makeBin(join(base, 'tools'), ['pnpm']) });
      const text = out.join('\n');
      expect(code).toBe(1);
      expect(text).toContain('✖ AGENTS.md がありません');
      expect(text).toContain('✖ openspec/ がありません');
      expect(text).toContain('⚠ lint のコマンドが設定されていません');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
