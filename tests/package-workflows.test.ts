import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) => readFileSync(join(import.meta.dirname, '..', '.github/workflows', name), 'utf8');

describe('配布物のCIと公開前ゲート', () => {
  it('[REQ-144] 3OSの品質ジョブとNode下限ジョブで配布物を検査する', () => {
    const ci = read('ci.yml');
    const quality = ci.slice(ci.indexOf('  quality:'), ci.indexOf('  node20:'));
    const runtime = ci.slice(ci.indexOf('  node20:'), ci.indexOf('  gate:'));
    expect(quality).toContain('os: [ubuntu-latest, macos-latest, windows-latest]');
    expect(quality).toContain('package-smoke.mjs prepare');
    expect(quality).toContain('package-smoke.mjs check');
    const prepare = runtime.indexOf('package-smoke.mjs prepare');
    const switchNode = runtime.indexOf('node-version: 20.19.0');
    const check = runtime.indexOf('package-smoke.mjs check');
    expect(prepare).toBeGreaterThan(0);
    expect(switchNode).toBeGreaterThan(prepare);
    expect(check).toBeGreaterThan(switchNode);
    expect(quality + runtime).not.toContain('continue-on-error: true');
  });

  it('[REQ-145] 公開するコミットの品質と配布物を検査してからpublishする', () => {
    const release = read('release.yml');
    const steps = ['run: pnpm lint', 'run: pnpm typecheck', 'run: pnpm test', 'run: pnpm build', 'package-smoke.mjs prepare', 'package-smoke.mjs check', 'run: pnpm changeset publish'];
    let previous = -1;
    for (const step of steps) {
      const index = release.indexOf(step);
      expect(index, step).toBeGreaterThan(previous);
      previous = index;
    }
    expect(release).toContain('fetch-depth: 0');
    expect(release).not.toContain('continue-on-error: true');
    const auth = release.indexOf('NODE_AUTH_TOKEN:');
    expect(auth).toBeGreaterThan(release.indexOf('run: pnpm changeset publish'));
  });
});
