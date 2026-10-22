import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { verifyArgs } from '../scripts/ci-gate.mjs';

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

  it('[REQ-061] 要件書の読み取り用ツール（pandoc・poppler-utils・xlsx2csv）を入れる', () => {
    for (const tool of ['pandoc', 'poppler-utils', 'xlsx2csv']) expect(postCreate).toContain(tool);
  });
});

describe('Node.js のバージョン宣言', () => {
  it('[REQ-048] ルートと各パッケージの engines.node が >=20.19.0', () => {
    for (const p of packageJsons) expect(readJson(p).engines?.node, p).toBe('>=20.19.0');
  });
});

describe('CI', () => {
  const ci = read('.github/workflows/ci.yml');

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
    expect(verifyArgs('setup-monorepo', join(root, 'openspec', 'changes'))).toEqual(['--change', 'setup-monorepo', '--done']);
  });

  it('[REQ-010][REQ-054] ブランチ名が change-id と一致しなければ品質コマンドだけを実行する', () => {
    expect(verifyArgs('fix-typo', join(root, 'openspec', 'changes'))).toEqual([]);
    expect(verifyArgs('', join(root, 'openspec', 'changes'))).toEqual([]);
  });
});

describe('changesets', () => {
  it('[REQ-056] .changeset/config.json があり、changeset status がエラーなく終わる', () => {
    expect(existsSync(join(root, '.changeset', 'config.json'))).toBe(true);
    const r = run('pnpm changeset status');
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
