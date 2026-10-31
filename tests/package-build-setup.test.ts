import { describe, expect, it, vi } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestProject, TestSpecification } from 'vitest/node';
import { createPackageBuildSetup } from './package-build.setup.js';
import { packedTarballsEnv } from './packed-tarballs.js';

function project(names: string[] = ['package', 'slow'], root = true) {
  let rerun: Parameters<TestProject['onTestsRerun']>[0] | undefined;
  const provide = vi.fn();
  const value = {
    isRootProject: () => root,
    vitest: { projects: names.map((name) => ({ name })) },
    provide,
    onTestsRerun: (callback: typeof rerun) => { rerun = callback; },
  } as unknown as TestProject;
  return { value, provide, rerun: async (names: string[]) => { await rerun!(names.map((name) => ({ project: { name } })) as TestSpecification[]); } };
}

describe('rootの共有配布物準備', () => {
  it('子projectとunitだけの実行ではbuildしない', () => {
    const build = vi.fn();
    expect(createPackageBuildSetup(build)(project(['package'], false).value)).toBeUndefined();
    expect(createPackageBuildSetup(build)(project(['unit']).value)).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
  });

  it('rootで一度だけbuildしprovideして、終了時に消す', () => {
    const build = vi.fn((dir: string) => writeFileSync(join(dir, 'tarball'), 'packed'));
    const p = project();
    const cleanup = createPackageBuildSetup(build)(p.value)!;
    const dir = build.mock.calls[0]![0];
    try {
      expect(build).toHaveBeenCalledTimes(1);
      expect(p.provide).toHaveBeenCalledExactlyOnceWith('packedTarballs', dir);
      expect(existsSync(join(dir, 'tarball'))).toBe(true);
    } finally { cleanup(); }
    expect(existsSync(dir)).toBe(false);
  });

  it('build途中の失敗は部分出力を消して元の例外を返す', () => {
    let dir = '';
    const failure = new Error('pack failure');
    const build = (target: string) => { dir = target; writeFileSync(join(target, 'partial'), 'partial'); throw failure; };
    expect(() => createPackageBuildSetup(build)(project().value)).toThrow(failure);
    expect(existsSync(dir)).toBe(false);
  });

  it('配布物を使うrerunだけが同じ場所を再buildし、失敗時も消す', async () => {
    const build = vi.fn((dir: string) => writeFileSync(join(dir, 'tarball'), 'packed'));
    const p = project();
    const cleanup = createPackageBuildSetup(build)(p.value)!;
    const dir = build.mock.calls[0]![0];
    try {
      await p.rerun(['unit']);
      expect(build).toHaveBeenCalledTimes(1);
      await p.rerun(['package', 'slow']);
      expect(build).toHaveBeenCalledTimes(2);
      expect(build.mock.calls[1]![0]).toBe(dir);
      build.mockImplementationOnce(() => { throw new Error('rerun failure'); });
      await expect(p.rerun(['slow'])).rejects.toThrow('rerun failure');
      expect(existsSync(dir)).toBe(false);
    } finally { cleanup(); }
  });

  it('injectが欠けたときは個別buildへfallbackせず拒否する', () => {
    for (const value of [undefined, null, '', 1, {}]) expect(() => packedTarballsEnv(value, {})).toThrow('共有の配布物');
    expect(packedTarballsEnv('/packed', { NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test', LOOMAKE_PACKED_TARBALLS: '/packed' });
  });
});
