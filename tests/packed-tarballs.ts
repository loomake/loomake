import { inject } from 'vitest';

// 欠落した inject を各ケースの暗黙の build へ戻さず、共有準備の失敗として止める。
export function packedTarballsEnv(packed: unknown = inject('packedTarballs'), env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (typeof packed !== 'string' || packed.length === 0) throw new Error('共有の配布物が準備されていません（packedTarballs）');
  return { ...env, LOOMAKE_PACKED_TARBALLS: packed };
}
