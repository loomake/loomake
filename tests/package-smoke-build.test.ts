import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAndPack, prepare } from '../scripts/package-smoke.mjs';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn<(command: string, args: string[], options: { cwd: string }) => { status: number; stdout: string; stderr: string }>() }));
vi.mock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(), spawnSync: spawn }));

const packages = ['core', 'kit', 'trace', 'runner', 'cli'];
const temporary: string[] = [];
const root = join(import.meta.dirname, '..');
const commandArgs = (command: string, args: string[]) => process.platform === 'win32' && ['pnpm', 'npm'].includes(command)
  ? args.map((arg) => arg.slice(1, -1).replaceAll('""', '"')) : args;
const calls = () => spawn.mock.calls.map(([command, args, options]) => [command, commandArgs(command, args), options] as const);
function directory() {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-smoke-build-'));
  temporary.push(dir);
  return dir;
}

beforeEach(() => {
  vi.stubEnv('LOOMAKE_PACKED_TARBALLS', '');
  spawn.mockReset().mockImplementation((command, args, { cwd }) => {
    args = commandArgs(command, args);
    if (command === 'pnpm' && args[0] === 'pack') {
      writeFileSync(join(args[args.indexOf('--pack-destination') + 1]!, `${basename(cwd)}.tgz`), 'packed fixture');
    }
    return { status: 0, stdout: '', stderr: '' };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('配布物の重複 build を省く明示指定', () => {
  it('CI の build 省略指定は、各ジョブの明示 build に成功した後の prepare にだけ付ける', () => {
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').replaceAll('\r\n', '\n');
    for (const [name, next, count] of [['quality', 'node20', 1], ['node20', 'node22', 2], ['node22', 'gate', 2]] as const) {
      const job = ci.slice(ci.indexOf(`\n  ${name}:`), ci.indexOf(`\n  ${next}:`));
      const commands = [...job.matchAll(/^\s+(?:- )?run: (.+)$/gm)].map((match) => match[1]!);
      const build = commands.indexOf('pnpm build');
      const prepares = commands.map((command, index) => ({ command, index })).filter(({ command }) => command.startsWith('node scripts/package-smoke.mjs prepare '));
      expect(build, name).toBeGreaterThanOrEqual(0);
      expect(prepares, name).toHaveLength(count);
      for (const { command, index } of prepares) {
        expect(index, name).toBeGreaterThan(build);
        expect(command, name).toMatch(/ --skip-build$/);
      }
    }
  });

  it('既定は build に成功してから 5 パッケージを pack する', () => {
    const dir = directory();
    buildAndPack(dir);
    expect(calls().map(([command, args]) => [command, args])).toEqual([
      ['pnpm', ['-r', 'build']],
      ...packages.map(() => ['pnpm', ['pack', '--pack-destination', dir, '--silent']]),
    ]);
    expect(readdirSync(dir).sort()).toEqual(packages.map((name) => `${name}.tgz`).sort());
  });

  it('build 済みの prepare は build だけ省き、5 pack と独立 consumer の offline install を続ける', () => {
    const target = join(directory(), 'prepared');
    prepare(target, { skipBuild: true });
    expect(calls().some(([command, args]) => command === 'pnpm' && args.includes('build'))).toBe(false);
    const packed = calls().filter(([command, args]) => command === 'pnpm' && args[0] === 'pack');
    expect(packed.map(([, , { cwd }]) => basename(cwd))).toEqual(packages);
    expect(readdirSync(join(target, 'tarballs')).sort()).toEqual(packages.map((name) => `${name}.tgz`).sort());
    const install = calls().find(([command, args]) => command === 'npm' && args[0] === 'install')!;
    expect(install[1].slice(0, 5)).toEqual(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
    expect(install[1].slice(5).sort()).toEqual(packages.map((name) => join(target, 'tarballs', `${name}.tgz`)).sort());
    expect(install[2].cwd).toBe(join(target, 'consumer'));
    expect(install[2].cwd).not.toBe(root);
    expect(existsSync(join(target, 'consumer/openspec/changes/sample/trace.md'))).toBe(true);
  });

  it.each([
    ['prepare', ['--unknown']],
    ['check', ['--skip-build']],
    ['prepare', ['--skip-build', '--skip-build']],
  ] as const)('%s の不正な追加指定 %j は検証先を作る前に拒否する', async (mode, options) => {
    const target = join(directory(), 'rejected');
    const child = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    const result = child.spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target, ...options], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toContain('追加オプション');
    expect(existsSync(target)).toBe(false);
  });
});
