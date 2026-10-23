import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { selectChanges, verifyArgs } from '../scripts/ci-gate.mjs';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p));
const run = (cmd: string) => spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8' });

const packageJsons = ['package.json', 'packages/core/package.json', 'packages/kit/package.json', 'packages/cli/package.json'];

describe('モノレポのパッケージ構成', () => {
  it('[REQ-001][REQ-002][REQ-003][REQ-060] pnpm workspaces で core・kit・loomake の 3 つが認識される', () => {
    expect(read('pnpm-workspace.yaml')).toMatch(/["']?packages\/\*["']?/);
    const r = run('pnpm -r ls --depth -1 --json');
    expect(r.status).toBe(0);
    const names = (JSON.parse(r.stdout) as { name: string }[]).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['@loomake/core', '@loomake/kit', 'loomake']));
  });

  it('[REQ-003] CLI のパッケージ名は loomake で、bin.loomake を宣言している', () => {
    const pkg = readJson('packages/cli/package.json');
    expect(pkg.name).toBe('loomake');
    expect(pkg.bin?.loomake).toBeTruthy();
  });
});

describe('devcontainer', () => {
  const devcontainer = read('.devcontainer/devcontainer.json');
  const postCreate = devcontainer.match(/"postCreateCommand":\s*"([^"]*)"/)?.[1] ?? '';

  it('[REQ-004] postCreateCommand で OpenSpec CLI を入れる', () => {
    expect(postCreate).toContain('@fission-ai/openspec');
  });

  it('[REQ-061] Node 24 系のイメージを使う', () => {
    const image = devcontainer.match(/^\s*"image":\s*"([^"]*)"/m)?.[1] ?? '';
    expect(image).toMatch(/typescript-node:(\d+-)?24(-|$)/);
  });
});

describe('Node.js のバージョン宣言', () => {
  it('[REQ-048] ルートと各パッケージの engines.node が >=20.19.0', () => {
    for (const p of packageJsons) expect(readJson(p).engines?.node, p).toBe('>=20.19.0');
  });
});

describe('CI', () => {
  const ci = read('.github/workflows/ci.yml');
  // archive したあとも動くよう、本物の change ではなく検査用プロジェクトの changes/ を使う
  const changes = join(root, 'tests', 'fixtures', 'verify-project', 'openspec', 'changes');

  it('[REQ-049] ubuntu・macos・windows の 3 つで pnpm test を実行する', () => {
    expect(ci).toMatch(/os:\s*\[ubuntu-latest, macos-latest, windows-latest\]/);
    expect(ci).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    expect(ci).toContain('run: pnpm test');
  });

  it('[REQ-010][REQ-054] PR ごとに完了ゲートを実行する', () => {
    expect(ci).toMatch(/if: github\.event_name == 'pull_request'/);
    expect(ci).toContain('node scripts/ci-gate.mjs "$HEAD_REF"');
    expect(ci).toContain('${{ github.head_ref }}');
  });

  it('[REQ-010][REQ-054] ブランチ名が change-id と一致すれば --change <id> --done で検査する', () => {
    expect(verifyArgs('sample', changes)).toEqual(['--change', 'sample', '--done']);
  });

  it('[REQ-010][REQ-054] run のブランチ名 loomake/<id> からも change-id を取り出す', () => {
    expect(verifyArgs('loomake/sample', changes)).toEqual(['--change', 'sample', '--done']);
    expect(verifyArgs('loomake/fix-typo', changes)).toEqual([]);
    expect(verifyArgs('loomake/archive', changes)).toEqual([]);
  });

  it('[REQ-010][REQ-054] ブランチ名が change-id と一致しなければ品質コマンドだけを実行する', () => {
    expect(verifyArgs('fix-typo', changes)).toEqual([]);
    expect(verifyArgs('', changes)).toEqual([]);
    // changes/ の直下の change だけを対象にする。archive と、/ を含む名前は change ではない
    expect(verifyArgs('archive', changes)).toEqual([]);
    expect(verifyArgs('sample/specs', changes)).toEqual([]);
  });
});

describe('CI の対象の change の決め方', () => {
  // c1・c2 と archive を持つ changes/ を一時ディレクトリに作る
  const withChanges = (fn: (changesDir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-ci-'));
    try {
      for (const d of ['c1', 'c2', 'archive/2026-10-23-c3']) mkdirSync(join(dir, d), { recursive: true });
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('[REQ-132] gate のジョブに、向き先のブランチと PR の番号と、PR 本文を読む権限を渡す', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('BASE_REF: ${{ github.base_ref }}');
    expect(ci).toContain('PR_NUMBER: ${{ github.event.pull_request.number }}');
    expect(ci).toMatch(/pull-requests: read/);
  });

  it('[REQ-010][REQ-132] 明示がなければ、ブランチ名とブランチ名 loomake/<id> からも change を決める', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'c1', changesDir })).toEqual({ changes: ['c1'] });
      expect(selectChanges({ ref: 'loomake/c1', changesDir })).toEqual({ changes: ['c1'] });
    }));

  it('[REQ-132] PR 本文の loomake-change: に書いた change を、それぞれ検査する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: '概要\n\nloomake-change: c1, c2\n', files: ['packages/a.ts'], changesDir })).toEqual({ changes: ['c1', 'c2'] });
      // 明示があれば、ブランチ名と変えたファイルは使わない
      expect(selectChanges({ ref: 'c2', body: 'loomake-change: c1\r\n', files: ['openspec/changes/c2/tasks.md'], changesDir })).toEqual({ changes: ['c1'] });
    }));

  it('[REQ-132] 明示した change がなければ失敗にする', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: 'loomake-change: nothing', changesDir })).toEqual({ error: 'PR 本文の loomake-change: に書いた change がありません：nothing' });
      expect(selectChanges({ body: 'loomake-change: archive', changesDir })).toHaveProperty('error');
    }));

  it('[REQ-132] 明示した change がなければ、ci-gate は日本語で表示して終了コード 1 を返す', () => {
    const r = spawnSync(process.execPath, ['scripts/ci-gate.mjs', 'fix-typo'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PR_BODY: 'loomake-change: nothing', BASE_REF: '' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PR 本文の loomake-change: に書いた change がありません：nothing');
  });

  it('[REQ-132] loomake-change: none なら、コードを変えていても品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: 'loomake-change: none', files: ['packages/a.ts'], changesDir })).toHaveProperty('qualityOnly');
    }));

  it('[REQ-132] 明示がなければ、変えたファイルの change とブランチ名の change を合わせて検査する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'feature-x', files: ['openspec/changes/c1/tasks.md', 'packages/a.ts'], changesDir })).toEqual({ changes: ['c1'] });
      expect(selectChanges({ ref: 'c2', files: ['openspec/changes/c1/tasks.md'], changesDir })).toEqual({ changes: ['c1', 'c2'] });
    }));

  it('[REQ-132] コードを変えていて change を特定できなければ、loomake-change: の行を書くよう案内して失敗にする', () =>
    withChanges((changesDir) => {
      const r = selectChanges({ ref: 'fix-typo', files: ['packages/a.ts', 'docs/usage.md'], changesDir });
      expect(r.error).toContain('PR 本文に「loomake-change: <change-id>」の行を書いてください');
    }));

  it('[REQ-010][REQ-132] ブランチ名が change-id と一致せず、文書だけを変えた PR は、品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', files: ['docs/usage.md', 'README.md', '.changeset/x.md'], changesDir })).toHaveProperty('qualityOnly');
    }));

  it('[REQ-132] archive の PR は、品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      const files = ['openspec/changes/c4/tasks.md', 'openspec/changes/archive/2026-10-23-c4/tasks.md', 'openspec/specs/x/spec.md'];
      expect(selectChanges({ ref: 'archive-c4', files, changesDir })).toHaveProperty('qualityOnly');
    }));
});

describe('changesets', () => {
  it('[REQ-056] .changeset/config.json があり、changeset status がエラーなく終わる', () => {
    expect(existsSync(join(root, '.changeset', 'config.json'))).toBe(true);
    // CI と同じ基準で比べるため origin/main を優先する。ローカルの main は古いことがある。origin が無い checkout では main と比べる
    const base = run('git rev-parse --verify --quiet origin/main').status === 0 ? 'origin/main' : 'main';
    const r = run(`pnpm changeset status --since=${base}`);
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});

describe('ライセンス', () => {
  it('[REQ-057] LICENSE が MIT で、すべての package.json の license が MIT', () => {
    const license = read('LICENSE');
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain('Permission is hereby granted, free of charge');
    for (const p of packageJsons) expect(readJson(p).license, p).toBe('MIT');
  });
});
