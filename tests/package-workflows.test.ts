import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) => readFileSync(join(import.meta.dirname, '..', '.github/workflows', name), 'utf8');

describe('配布物のCIと公開前ゲート', () => {
  it('[REQ-144] 3OSの品質ジョブとNode下限ジョブで配布物を検査する', () => {
    const ci = read('ci.yml');
    const qualityStart = ci.indexOf('\n  quality:');
    const runtimeStart = ci.indexOf('\n  node22:');
    const gateStart = ci.indexOf('\n  gate:');
    expect(qualityStart).toBeGreaterThanOrEqual(0);
    expect(runtimeStart).toBeGreaterThan(qualityStart);
    expect(gateStart).toBeGreaterThan(runtimeStart);
    expect(ci).not.toContain('\n  node20:');
    expect(ci).not.toContain('20.19.0');
    const quality = ci.slice(qualityStart, runtimeStart);
    const runtime = ci.slice(runtimeStart, gateStart);
    // quality ジョブの OS はイベントとラベルで切り替える式で、main への push では 3 つの OS で動く（REQ-049。展開は tests/monorepo.test.ts で確かめる）
    const osLine = quality.match(/^ {8}os: (.+)$/m)?.[1] ?? '';
    for (const os of ['ubuntu-latest', 'macos-latest', 'windows-latest']) expect(osLine, os).toContain(os);
    expect(quality).toContain('node-version: 24');
    expect(quality).toContain('package-smoke.mjs prepare');
    expect(quality).toContain('package-smoke.mjs check');
    const prepare = runtime.indexOf('package-smoke.mjs prepare');
    const switchNode = runtime.indexOf('node-version: 22.12.0');
    const check = runtime.indexOf('package-smoke.mjs check');
    expect(prepare).toBeGreaterThan(0);
    expect(switchNode).toBeGreaterThan(prepare);
    expect(check).toBeGreaterThan(switchNode);
    const offlinePrepare = runtime.indexOf('package-smoke.mjs prepare "$RUNNER_TEMP/loomake-offline"');
    const offlineCheck = runtime.indexOf('deny-network.py node scripts/runtime-compatibility.mjs');
    expect(offlinePrepare).toBeGreaterThan(prepare);
    expect(offlinePrepare).toBeLessThan(switchNode);
    expect(offlineCheck).toBeGreaterThan(check);
    expect(runtime.slice(offlineCheck)).toContain('22.12.0');
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
