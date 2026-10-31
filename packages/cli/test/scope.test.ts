import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyQualitySchema, runVerify, verifyExitCode } from '@loomake/kit';
import * as trace from '@loomake/trace';
import { main } from '../src/main.js';
import { CHANGE, COPY_REPORT, reportJson, withProject } from '../../kit/test/project.js';

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => vi.restoreAllMocks());

const config = { openspecValidate: false, commands: { test: COPY_REPORT } };
// quality.yaml のスキーマ（zod）は呼び出し側が読んで渡す（REQ-319）
const qualitySchema = await loadVerifyQualitySchema();

async function run(root: string, env: string | undefined, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const saved = process.env.CI;
  if (env === undefined) delete process.env.CI;
  else process.env.CI = env;
  try {
    const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    if (saved === undefined) delete process.env.CI;
    else process.env.CI = saved;
  }
}

const withDone = <T>(fn: (root: string) => Promise<T>) =>
  withProject({ config, quality: true }, (root) => {
    writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
    return fn(root);
  });

describe('verify の --scope', () => {
  it('[REQ-312] scope を省くと done は ci、spec-only と change なしは local。環境変数 CI の有無で変わらない', async () => {
    await withDone(async (root) => {
      for (const env of [undefined, '1', 'true', '0']) {
        const done = JSON.parse((await run(root, env, 'verify', '--change', CHANGE, '--done', '--json')).stdout);
        expect([env, done.scope, done.verdict]).toEqual([env, 'ci', 'PASS']);
        const spec = JSON.parse((await run(root, env, 'verify', '--change', CHANGE, '--spec-only', '--json')).stdout);
        expect([env, spec.scope]).toEqual([env, 'local']);
        const bare = JSON.parse((await run(root, env, 'verify', '--json')).stdout);
        expect([env, bare.scope, bare.change]).toEqual([env, 'local', null]);
      }
    });
  });

  it('[REQ-312] 明示した local と ci はそのまま使う。local の完了は ci の verdict を持たず、最終合格と表示しない', async () => {
    await withDone(async (root) => {
      const local = await run(root, undefined, 'verify', '--change', CHANGE, '--done', '--scope', 'local', '--json');
      const parsed = JSON.parse(local.stdout);
      expect([local.code, parsed.scope]).toEqual([0, 'local']);
      expect(parsed).not.toHaveProperty('verdict');
      const text = await run(root, undefined, 'verify', '--change', CHANGE, '--done', '--scope=local');
      expect(text.stdout).toContain('CI の最終合格ではありません');
      const ci = JSON.parse((await run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', '--scope', 'ci', '--json')).stdout);
      expect([ci.scope, ci.verdict]).toEqual(['ci', 'PASS']);
    });
  });

  it('[REQ-312] 関数 API と CLI は、同じ入力で同じ scope と終了コードになる（local の結果を ci に使えない）', async () => {
    await withDone(async (root) => {
      const cases: [string[], Parameters<typeof runVerify>[0]][] = [
        [['--change', CHANGE, '--done'], { root, qualitySchema, changeId: CHANGE, gate: 'done' }],
        [['--change', CHANGE, '--done', '--scope', 'local'], { root, qualitySchema, changeId: CHANGE, gate: 'done', scope: 'local' }],
        [['--change', CHANGE, '--done', '--skip-commands'], { root, qualitySchema, changeId: CHANGE, gate: 'done', skipCommands: true }],
        [['--change', CHANGE, '--done', '--skip-commands', '--scope', 'local'], { root, qualitySchema, changeId: CHANGE, gate: 'done', skipCommands: true, scope: 'local' }],
        [['--change', CHANGE, '--spec-only'], { root, qualitySchema, changeId: CHANGE, gate: 'spec-only' }],
      ];
      for (const [argv, options] of cases) {
        const api = runVerify(options);
        const cli = await run(root, undefined, 'verify', ...argv, '--json');
        expect([argv.join(' '), cli.code, JSON.parse(cli.stdout).scope]).toEqual([argv.join(' '), verifyExitCode(api), api.scope]);
      }
      // 省略した done は ci なので、local の完了（0）とは別の結果になる
      expect(runVerify({ root, qualitySchema, changeId: CHANGE, gate: 'done', scope: 'local' }).scope).toBe('local');
      expect(runVerify({ root, qualitySchema, changeId: CHANGE, gate: 'done' }).scope).toBe('ci');
    });
  });

  it('[REQ-312] change を指定しない verify の明示 local は品質コマンド専用の local 結果（change は null、verdict なし）。API も同じ', async () => {
    await withProject({ config: { openspecValidate: false, commands: {} } }, async (root) => {
      const local = await run(root, undefined, 'verify', '--scope', 'local', '--json');
      expect(local.code).toBe(0);
      const parsed = JSON.parse(local.stdout);
      expect(parsed).toMatchObject({ scope: 'local', change: null });
      expect(parsed).not.toHaveProperty('verdict');
      expect(runVerify({ root, scope: 'local' }).scope).toBe('local');
      expect(runVerify({ root }).scope).toBe('local');
    });
  });
});

describe('品質コマンドは実行しない', () => {
  it('[REQ-312] spec-only の明示 local では、品質コマンドを動かさない', async () => {
    const marker = 'ran.txt';
    const command = `node -e "require('fs').writeFileSync('${marker}','x')"`;
    await withProject({ config: { openspecValidate: false, commands: { test: command, lint: command } } }, async (root) => {
      const spec = await run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', '--scope', 'local', '--json');
      expect(JSON.parse(spec.stdout).scope).toBe('local');
      expect(existsSync(join(root, marker))).toBe(false);
      // 対照：change なしの local は品質コマンドを動かすので、痕跡が残る
      await run(root, undefined, 'verify', '--scope', 'local', '--json');
      expect(existsSync(join(root, marker))).toBe(true);
    });
  });
});

describe('--scope の書き方', () => {
  it('[REQ-194][REQ-041] --scope local と --scope=local は同じ結果。空と不正な値は使い方の誤りで 2', async () => {
    await withProject({}, async (root) => {
      const space = await run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', '--scope', 'local');
      const eq = await run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', '--scope=local');
      expect([eq.code, eq.stdout]).toEqual([space.code, space.stdout]);
      for (const [argv, message] of [
        [['--scope='], '--scope には値を続けてください'],
        [['--scope'], '--scope には値を続けてください'],
        [['--scope', '--json'], '--scope には値を続けてください'],
        [['--scope=ci2'], '--scope は local か ci にしてください：ci2'],
        [['--scope', 'CI'], '--scope は local か ci にしてください：CI'],
      ] as const) {
        const r = await run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', ...argv);
        expect([argv.join(' '), r.code], argv.join(' ')).toEqual([argv.join(' '), 2]);
        expect(r.stderr).toContain(message);
        expect(r.stderr).toContain('使い方: loomake verify');
      }
    });
  });

  it('[REQ-194][REQ-041] 打ち間違いの --scop には候補を示す。--scope は flag ではないので等号なしの値が要る', async () => {
    const r = await withProject({}, (root) => run(root, undefined, 'verify', '--change', CHANGE, '--spec-only', '--scop', 'local'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('もしかして：--scope');
  });
});

describe('trace record の --scope', () => {
  it('[REQ-135][REQ-194] --scope を runRecord に渡す。省くと渡さない（既定の ci は record が決める）', async () => {
    const record = vi.spyOn(trace, 'runRecord').mockReturnValue(0);
    await withProject({}, async (root) => {
      expect((await run(root, undefined, 'trace', 'record', '--change', CHANGE, '--scope', 'local')).code).toBe(0);
      expect((await run(root, undefined, 'trace', 'record', `--change=${CHANGE}`, '--scope=ci')).code).toBe(0);
      expect((await run(root, undefined, 'trace', 'record', '--change', CHANGE)).code).toBe(0);
    });
    expect(record.mock.calls.map(([options]) => options.scope)).toEqual(['local', 'ci', undefined]);
  });

  it('[REQ-135][REQ-194] trace record の不正・空の --scope は使い方の誤りで 2。記録は始めない', async () => {
    const record = vi.spyOn(trace, 'runRecord').mockReturnValue(0);
    await withProject({}, async (root) => {
      for (const argv of [['--scope='], ['--scope', 'both'], ['--scope']]) {
        const r = await run(root, undefined, 'trace', 'record', '--change', CHANGE, ...argv);
        expect([argv.join(' '), r.code]).toEqual([argv.join(' '), 2]);
        expect(r.stderr).toContain('使い方: loomake trace record --change <id> [--scope local|ci]');
      }
      // report には --scope がない
      const report = await run(root, undefined, 'trace', 'report', '--change', CHANGE, '--scope', 'local');
      expect(report.code).toBe(2);
      expect(report.stderr).toContain('知らないオプションです：--scope');
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('[REQ-135] help は検査も記録もせず、--scope の受理値と既定値を標準出力に出して 0', async () => {
    const record = vi.spyOn(trace, 'runRecord').mockReturnValue(0);
    await withProject({}, async (root) => {
      const verify = await run(root, undefined, 'verify', '--scope', 'ci', '--help');
      expect(verify.code).toBe(0);
      expect(verify.stdout).toMatch(/^ {2}--scope local\|ci +結果の範囲。省くと --done は ci、--spec-only と --change なしは local/m);
      expect(verify.stdout).toContain('（終了コード 1）。coverage は出さない');
      expect(verify.stderr).toBe('');
      const rec = await run(root, undefined, 'trace', 'record', '--scope', 'bogus', '--help');
      expect(rec.code).toBe(0);
      expect(rec.stdout).toContain('記録する verify の範囲。省くと ci。local の記録は最終 CI の合格ではない');
    });
    expect(record).not.toHaveBeenCalled();
  });
});
