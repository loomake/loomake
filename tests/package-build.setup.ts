import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { buildAndPack } from '../scripts/package-smoke.mjs';
import { profileEvent } from '../scripts/test-phase-profile.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    packedTarballs: string;
  }
}

const packageProjects = new Set(['package', 'slow']);

// root から子 project へ同じ配布物を渡し、重なる build が .d.ts を消す競合を防ぐ。
export function createPackageBuildSetup(build: (dir: string) => void = buildAndPack) {
  return function setup(project: TestProject) {
    if (!project.isRootProject() || !project.vitest.projects.some((p) => packageProjects.has(p.name))) return;
    const dir = mkdtempSync(join(tmpdir(), 'loomake packed '));
    const cleanup = () => rmSync(dir, { recursive: true, force: true });
    const rebuild = () => {
      profileEvent('shared-package-build', 'package-build-start');
      try {
        build(dir);
        profileEvent('shared-package-build', 'package-build-end');
      } catch (error) {
        cleanup();
        throw error;
      }
    };
    try {
      rebuild();
      project.provide('packedTarballs', dir);
      project.onTestsRerun((specs) => {
        if (!specs.some((spec) => packageProjects.has(spec.project.name))) return;
        cleanup();
        mkdirSync(dir);
        rebuild();
      });
    } catch (error) {
      cleanup();
      throw error;
    }
    return cleanup;
  };
}

export default createPackageBuildSetup();
