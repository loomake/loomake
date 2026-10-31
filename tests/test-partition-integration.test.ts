import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { partitionFixture, relevantSpecifications, type FixtureReport } from './helpers/partition-fixture.js';
import { configDefaults } from 'vitest/config';

const fixtures: ReturnType<typeof partitionFixture>[] = [];
const fixture = () => { const f = partitionFixture(); fixtures.push(f); return f; };
afterEach(() => { vi.unstubAllEnvs(); for (const f of fixtures.splice(0)) f.cleanup(); });
const names = (report: FixtureReport | undefined) => report?.testResults.flatMap((file) => file.assertionResults.map((a) => [a.fullName, a.status])).sort();

describe('実Vitestによる共通partition', () => {
  it('空registryの実repo選択は独立したfile一覧と一致し、列挙だけではsetupを動かさない', () => {
    const root = join(import.meta.dirname, '..');
    const before = process.env.LOOMAKE_TEST_PHASE_PROFILE_DIR;
    const f = fixture();
    const quarantine = JSON.parse(readFileSync(join(root, 'tests/quarantine.json'), 'utf8')) as { entries: { file: string; os: string[] }[] };
    for (const excluded of [[], quarantine.entries.filter((e) => e.os.includes('windows-latest')).map((e) => e.file)]) {
      const profileDirectory = join(f.root, 'collection-profile');
      const result = relevantSpecifications(root, excluded, profileDirectory, f.root);
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const packages = ['tests/ai-journeys.test.ts', 'tests/package-artifacts.test.ts', 'tests/pending-approvals-cli.test.ts'];
      const expected = globSync(['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'], { cwd: root, exclude: configDefaults.exclude })
        .map((file) => file.replaceAll('\\', '/')).filter((file) => !excluded.includes(file))
        .map((file) => `${packages.includes(file) ? 'package' : 'unit'}:${file}`).sort();
      expect(result.specs?.map((s) => `${s.project}:${relative(root, s.file).replaceAll('\\', '/')}`).sort()).toEqual(expected);
      expect(result.specs?.some((s) => s.project === 'slow')).toBe(false);
      expect(existsSync(profileDirectory)).toBe(false);
    }
    expect(f.markers()).toEqual([]);
    expect(process.env.LOOMAKE_TEST_PHASE_PROFILE_DIR).toBe(before);
  }, 120000);

  it('同じcheckoutを列挙してもdriverは各fixture内に置き、cleanupで消す', () => {
    const root = join(import.meta.dirname, '..');
    const first = fixture(), second = fixture();
    const results = [first, second].map((f, i) => relevantSpecifications(root, i ? ['tests/package-artifacts.test.ts'] : [], join(f.root, 'profile'), f.root));
    for (const [i, f] of [first, second].entries()) {
      expect(results[i].status, results[i].stderr).toBe(0);
      expect(results[i].driver).toBe(join(f.root, 'partition-collect.mjs'));
      expect(existsSync(results[i].driver)).toBe(true);
    }
    expect(new Set(results.map((r) => r.driver)).size).toBe(2);
    expect(results[0].specs?.some((s) => s.file.replaceAll('\\', '/').endsWith('/tests/package-artifacts.test.ts'))).toBe(true);
    expect(results[1].specs?.some((s) => s.file.replaceAll('\\', '/').endsWith('/tests/package-artifacts.test.ts'))).toBe(false);
    first.cleanup(); second.cleanup();
    for (const result of results) expect(existsSync(result.driver)).toBe(false);
  }, 120000);

  it('親の隔離envをrun/watchへ漏らさず、明示した重なりだけは拒否する', () => {
    const inherited = '["tests/package-artifacts.test.ts","tests/ai-journeys.test.ts"]';
    vi.stubEnv('LOOMAKE_TEST_QUARANTINE_EXCLUDE', inherited);
    const f = fixture();
    const run = f.run();
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.report?.numPassedTests).toBe(7);
    f.reset();
    const watch = f.watch();
    expect(watch.status, watch.stderr + watch.stdout).toBe(0);
    expect(watch.phases?.map((p) => p.phase)).toEqual(['initial', 'unit', 'package', 'failed', 'closed']);
    const explicit = f.run([], { LOOMAKE_TEST_QUARANTINE_EXCLUDE: '["tests/routed.test.ts"]' });
    expect(explicit.status).not.toBe(0);
    expect(explicit.stdout + explicit.stderr).toContain('隔離できません');
    expect(process.env.LOOMAKE_TEST_QUARANTINE_EXCLUDE).toBe(inherited);
  }, 180000);

  it('非空のOS別割当を実callerで実行し、fastとslowの和が全fastの多重集合と一致する', () => {
    const f = fixture();
    const full = f.run();
    expect(full.status, full.stderr + full.stdout).toBe(0);
    expect(full.report?.numPassedTests).toBe(7);
    expect(full.markers.filter((m) => m.event === 'build')).toHaveLength(1);
    const dirs = full.markers.filter((m) => m.dir).map((m) => m.dir!);
    expect(new Set(dirs).size).toBe(1);
    expect(full.markers.some((m) => m.project === 'slow')).toBe(true);
    expect(full.markers.some((m) => m.project === 'package')).toBe(true);
    expect(existsSync(dirs[0])).toBe(false);
    f.reset();
    const fast = f.run(['--project', 'unit', '--project', 'package']);
    f.reset();
    const slow = f.run(['--project', 'slow']);
    expect(fast.status, fast.stderr + fast.stdout).toBe(0);
    expect(slow.status, slow.stderr + slow.stdout).toBe(0);
    expect(fast.report?.numPassedTests).toBe(4);
    expect(slow.report?.numPassedTests).toBe(3);
    expect([...(names(fast.report) ?? []), ...(names(slow.report) ?? [])].sort()).toEqual(names(full.report));
    for (const item of Object.values(f.registry.files)) for (const id of Object.keys(item.cases)) item.cases[id] = [];
    f.setRegistry(); f.reset();
    const allFast = f.run();
    expect(allFast.status, allFast.stderr + allFast.stdout).toBe(0);
    expect(names(allFast.report)).toEqual(names(full.report));
    expect(allFast.report?.testResults.some((r) => r.name.endsWith('.slow.test.ts'))).toBe(false);
  }, 120000);

  it('project選択とファイル選択の実setup回数・終了後cleanup・空選択を固定する', () => {
    const f = fixture();
    for (const [args, builds, status] of [
      [['--project', 'unit'], 0, 0],
      [['tests/unit.test.ts'], 1, 0],
      [['tests/ai-journeys.test.ts'], 1, 0],
      [['absent.test.ts'], 0, 1],
    ] as const) {
      f.reset(); const r = f.run([...args]);
      expect(r.status, `${args.join(' ')}\n${r.stderr}${r.stdout}`).toBe(status);
      const built = r.markers.filter((m) => m.event === 'build');
      expect(built).toHaveLength(builds);
      for (const m of built) expect(existsSync(m.dir!)).toBe(false);
      if (status !== 0) expect(r.report?.numPassedTests ?? 0).toBe(0);
    }
    for (const item of Object.values(f.registry.files)) for (const id of Object.keys(item.cases)) item.cases[id] = [];
    f.setRegistry(); f.reset();
    const excluded = f.run(['tests/routed.slow.test.ts']);
    expect(excluded.status).not.toBe(0);
    expect(excluded.report?.numPassedTests ?? 0).toBe(0);
    expect(excluded.markers).toEqual([]);
    const absentProject = f.run(['--project', 'slow']);
    expect(absentProject.status).not.toBe(0);
    expect(absentProject.markers).toEqual([]);
  }, 180000);

  it('途中build失敗とinject欠落で失敗し、部分出力を消し個別buildへ戻らない', () => {
    const f = fixture();
    writeFileSync(join(f.root, 'tests/fail-build'), 'fail');
    const failed = f.run();
    expect(failed.status).not.toBe(0);
    const built = failed.markers.filter((m) => m.event === 'build');
    expect(built).toHaveLength(1);
    expect(existsSync(built[0].dir!)).toBe(false);
    const config = join(f.root, 'vitest.config.ts');
    writeFileSync(config, readFileSync(config, 'utf8').replace("globalSetup: ['tests/package-build.setup.ts'],", ''));
    f.reset();
    const missing = f.run(['tests/ai-journeys.test.ts']);
    expect(missing.status).not.toBe(0);
    expect(missing.stdout + missing.stderr).toContain('共有の配布物');
    expect(missing.markers.filter((m) => m.event === 'build')).toEqual([]);
  }, 120000);

  it('actual watchのunit再実行では準備せず、package再実行は同じ場所で再準備し失敗/closeで消す', () => {
    const f = fixture();
    const result = f.watch();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.phases?.map((p) => p.phase)).toEqual(['initial', 'unit', 'package', 'failed', 'closed']);
    expect(result.phases?.map((p) => p.builds.length)).toEqual([1, 1, 2, 3, 3]);
    const phases = result.phases!;
    expect(new Set(phases.flatMap((p) => p.builds)).size).toBe(1);
    expect(phases.slice(0, 3).every((p) => p.exists.every(Boolean))).toBe(true);
    expect(phases[3].error).toBe('fixture build failed');
    expect(phases.slice(3).every((p) => p.exists.every((exists) => !exists))).toBe(true);
  }, 120000);

  it('未登録caseと隔離の重なりを実config/実Vitestで拒否する', () => {
    const f = fixture();
    const source = join(f.root, 'tests/routed.test.ts');
    writeFileSync(source, "import {includeCase,loadPartition} from '../scripts/lib/test-partition.mjs';includeCase(loadPartition(import.meta.dirname+'/..'),'tests/routed.test.ts','fast','unregistered');");
    const unknown = f.run(['--project', 'unit', 'tests/routed.test.ts']);
    expect(unknown.status).not.toBe(0);
    expect(unknown.stdout + unknown.stderr).toContain('未登録');
    const overlap = f.run([], { ...process.env, LOOMAKE_TEST_QUARANTINE_EXCLUDE: '["tests/routed.test.ts"]' });
    expect(overlap.status).not.toBe(0);
    expect(overlap.stdout + overlap.stderr).toContain('隔離できません');
  }, 120000);
});
