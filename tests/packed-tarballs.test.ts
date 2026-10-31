import { expect, it } from 'vitest';
import { packedTarballsEnv } from './packed-tarballs.js';

it('共有の配布物がなければ個別buildへ戻らず、明示した場所を新しいenvへ渡す', () => {
  for (const value of [undefined, null, '', 123]) expect(() => packedTarballsEnv(value)).toThrow('共有の配布物');
  const before = process.env.LOOMAKE_PACKED_TARBALLS;
  const env = packedTarballsEnv('some directory');
  expect(env).not.toBe(process.env);
  expect(env.LOOMAKE_PACKED_TARBALLS).toBe('some directory');
  expect(process.env.LOOMAKE_PACKED_TARBALLS).toBe(before);
});
