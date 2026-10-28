import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { buildAndPack } from '../scripts/package-smoke.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    packedTarballs: string;
  }
}

// 配布物を使う試験のプロジェクトで、試験を始める前に build と pack を 1 回だけ動かす。
// 試験の中で build を重ねると、tsc が空にした .d.ts をほかの build が読んで落ちる（Issue #34）。
// 試験は tarball の場所を、LOOMAKE_PACKED_TARBALLS で scripts/package-smoke.mjs の prepare に渡す
export default function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake packed '));
  buildAndPack(dir);
  project.provide('packedTarballs', dir);
  return () => rmSync(dir, { recursive: true, force: true });
}
