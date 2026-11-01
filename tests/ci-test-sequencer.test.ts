import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseSequencer, type TestSpecification, type Vitest } from 'vitest/node';
import { CiTestSequencer, shardByDuration } from '../scripts/lib/ci-test-sequencer.mjs';

const root = join(import.meta.dirname, '..');
const durations = JSON.parse(readFileSync(join(root, 'scripts/lib/ci-test-durations.json'), 'utf8')) as Record<'darwin' | 'win32', { fallbackMs: number; files: Record<string, number> }>;
const specification = (file: string, project = 'unit', pool = 'forks') => ({ moduleId: join(root, file), project: { name: project }, pool }) as TestSpecification;
const context = (index: number, count = 2) => ({ config: { root, shard: { index, count } } }) as Vitest;
const identity = (spec: TestSpecification) => [spec.moduleId, spec.project.name, spec.pool];

afterEach(() => vi.restoreAllMocks());

describe('CI の実測時間によるシャード割当', () => {
  it.each(['darwin', 'win32'] as const)('同じファイルの別 project・pool と未知ファイルを含め、%s の全件を一度だけ割り当てる', (platform) => {
    const files = [
      specification('packages/runner/test/run.test.ts'),
      specification('packages/runner/test/run.test.ts', 'another'),
      specification('packages/runner/test/run.test.ts', 'unit', 'threads'),
      specification('tests/new-file.test.ts'),
      specification('tests/another-new-file.test.ts'),
    ];
    for (const count of [1, 2, 3]) {
      const shards = Array.from({ length: count }, (_, index) => shardByDuration(files, root, platform, { index: index + 1, count }));
      const all = shards.flat();
      expect(all).toHaveLength(files.length);
      for (const file of files) expect(all.filter((entry) => entry === file)).toHaveLength(1);
      for (const [index, shard] of shards.entries()) {
        const reversed = shardByDuration([...files].reverse(), root, platform, { index: index + 1, count });
        expect(reversed.map(identity)).toEqual(shard.map(identity));
      }
    }
    // 未測定ファイルも既知の短いファイルと同じように別々の脚へ配る。
    const unknown = files.slice(-2);
    expect(shardByDuration(unknown, root, platform, { index: 1, count: 2 })).toHaveLength(1);
    expect(shardByDuration(unknown, root, platform, { index: 2, count: 2 })).toHaveLength(1);
  });

  it.each(['darwin', 'win32'] as const)('%s の成功した基準 run では、既定の分割より実測ファイル時間の偏りが小さい', async (platform) => {
    const files = Object.keys(durations[platform].files).map((file) => specification(file));
    const weights = new Map(files.map((spec) => [spec, durations[platform].files[spec.moduleId.slice(root.length + 1).replaceAll('\\', '/')]]));
    const sum = (specs: TestSpecification[]) => specs.reduce((total, spec) => total + weights.get(spec)!, 0);
    const legacy = await Promise.all([1, 2].map((index) => new BaseSequencer(context(index)).shard([...files])));
    const balanced = await Promise.all([1, 2].map((index) => new CiTestSequencer(context(index), platform).shard([...files])));
    expect(balanced.flat()).toHaveLength(files.length);
    for (const file of files) expect(balanced.flat().filter((entry) => entry === file)).toHaveLength(1);
    expect(Math.abs(sum(balanced[0]) - sum(balanced[1]))).toBeLessThan(Math.abs(sum(legacy[0]) - sum(legacy[1])));
    expect(sum(balanced.flat())).toBe(sum(files));
    const measured = Object.values(durations[platform].files).sort((a, b) => a - b);
    const middle = Math.floor(measured.length / 2);
    expect(durations[platform].fallbackMs).toBe(measured.length % 2 ? measured[middle] : (measured[middle - 1] + measured[middle]) / 2);
  });

  it.each(['linux', 'freebsd'])('%s のシャードは Vitest の既定へ委譲し、sort も継承する', async (platform) => {
    const files = [specification('tests/new-file.test.ts')];
    const delegated = [files[0]];
    const shard = vi.spyOn(BaseSequencer.prototype, 'shard').mockResolvedValue(delegated);
    const sequencer = new CiTestSequencer(context(1), platform);
    expect(await sequencer.shard(files)).toBe(delegated);
    expect(shard).toHaveBeenCalledExactlyOnceWith(files);
    expect(sequencer.sort).toBe(BaseSequencer.prototype.sort);
  });
});
