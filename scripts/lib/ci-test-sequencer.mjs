import { relative } from 'node:path';
import { BaseSequencer } from 'vitest/node';
import durations from './ci-test-durations.json' with { type: 'json' };

/**
 * 実測の長いファイルから、時間の合計が小さいシャードへ割り当てる。
 * 入力は Vitest が project・隔離一覧などを適用して収集した全 specification。
 * @template {{ moduleId: string, project: { name: string }, pool: string }} T
 * @param {readonly T[]} specifications
 * @param {string} root
 * @param {'darwin' | 'win32'} platform
 * @param {{index: number, count: number}} shard
 * @returns {T[]}
 */
export function shardByDuration(specifications, root, platform, { index, count }) {
  const measurements = durations[platform];
  const files = specifications.map((specification) => {
    const file = relative(root, specification.moduleId).replaceAll('\\', '/');
    return {
      specification,
      duration: measurements.files[file] ?? measurements.fallbackMs,
      key: JSON.stringify([file, specification.project.name, specification.pool]),
    };
  }).sort((a, b) => b.duration - a.duration || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const shards = Array.from({ length: count }, () => ({ duration: 0, specifications: /** @type {T[]} */ ([]) }));
  for (const file of files) {
    const target = shards.reduce((shortest, current) => current.duration < shortest.duration ? current : shortest);
    target.duration += file.duration;
    target.specifications.push(file.specification);
  }
  return shards[index - 1].specifications;
}

// shard だけを変え、ファイルの実行順・worker 数などは Vitest の既定を使う。
export class CiTestSequencer extends BaseSequencer {
  /** @param {import('vitest/node').Vitest} context @param {string} platform */
  constructor(context, platform = process.platform) {
    super(context);
    this.platform = platform;
  }

  /** @param {import('vitest/node').TestSpecification[]} specifications */
  async shard(specifications) {
    if (this.platform !== 'darwin' && this.platform !== 'win32') return super.shard(specifications);
    return shardByDuration(specifications, this.ctx.config.root, this.platform, this.ctx.config.shard);
  }
}
