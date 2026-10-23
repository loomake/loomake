import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { main } from '../src/main.js';
import { CHANGE, ledgerRow, reportJson, requirement, traceMd, withProject } from '../../kit/test/project.js';

const repo = join(import.meta.dirname, '..', '..', '..');
const readJson = (p: string) => JSON.parse(readFileSync(join(repo, p), 'utf8'));

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const writeReport = (root: string, tests: Record<string, [string, string][]>) => {
  mkdirSync(join(root, '.loomake'), { recursive: true });
  writeFileSync(join(root, '.loomake', 'test-report.json'), reportJson(root, tests));
};

describe('JSON 出力', () => {
  it('[REQ-040] --json の標準出力は JSON だけで、schemaVersion を含み、core のスキーマで検証できる', async () => {
    const r = await withProject({ config: { openspecValidate: false, commands: { lint: 'node -e "console.log(1)"' } } }, (root) => {
      writeReport(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
      return run(root, 'verify', '--change', CHANGE, '--done', '--json');
    });
    const out = JSON.parse(r.stdout);
    expect(out.schemaVersion).toBe('1.0.0');
    const validate = new Ajv2020({ strict: false }).compile(readJson('packages/core/schema/verify-result.schema.json'));
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true);
    // 進捗は標準エラーに出す
    expect(r.stderr).toContain('… lint:');
  });

  it('[REQ-040] 要件ごとのテストファイルの一覧を出す', async () => {
    const r = await withProject({}, (root) => {
      writeReport(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
      return run(root, 'verify', '--change', CHANGE, '--done', '--json', '--skip-commands');
    });
    expect(JSON.parse(r.stdout).coverage).toEqual({ 'REQ-012': ['tests/a.test.ts'] });
  });
});

describe('終了コード', () => {
  it('[REQ-041] すべて合格か警告なら 0', async () => {
    const trace = traceMd({ assumptions: ['| A-01 | REQ-012 | 仮定 | 理由 | |'] });
    const r = await withProject({ trace }, (root) => run(root, 'verify', '--change', CHANGE, '--spec-only'));
    expect(r.code, r.stdout).toBe(0);
    expect(r.stdout).toContain('合格');
  });

  it('[REQ-041] 1 つ以上の検査が不合格なら 1', async () => {
    const r = await withProject({ trace: traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-007')] }) }, (root) =>
      run(root, 'verify', '--change', CHANGE, '--spec-only'),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('不合格（1 件）');
  });

  it('[REQ-041][REQ-055] --change を付けずに --spec-only を指定すると、日本語の使い方を出して 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--spec-only・--done には --change <id> が必要です');
    expect(r.stderr).toContain('使い方: loomake verify');
  });

  it('[REQ-041] loomake.config.json の形が正しくなければ 2', async () => {
    const r = await withProject({ config: { tests: { report: 1 } } }, (root) => run(root, 'verify', '--change', CHANGE, '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('tests.report は空でない文字列にしてください');
  });

  it('[REQ-041] サブコマンドが無ければ、使い方を出して 2', async () => {
    const r = await withProject({}, (root) => run(root));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('使い方: loomake <init | verify | trace | run>');
  });
});

describe('change の省略', () => {
  it('[REQ-042] loomake verify を引数なしで実行すると、commands だけを実行する', async () => {
    const r = await withProject({ config: { commands: { test: 'node -e ""' } } }, (root) => run(root, 'verify', '--json'));
    const out = JSON.parse(r.stdout);
    expect(out.mode).toBe('quality');
    expect(out.results.map((x: { check: string }) => x.check)).toEqual(['command: test']);
  });
});

describe('実行時依存の範囲', () => {
  it('[REQ-047] kit の dependencies は @loomake/core だけ', () => {
    expect(Object.keys(readJson('packages/kit/package.json').dependencies ?? {})).toEqual(['@loomake/core']);
  });

  it('[REQ-047] loomake の dependencies は @loomake/core・@loomake/kit・@loomake/trace・@loomake/runner 以外を含まない', () => {
    const deps = Object.keys(readJson('packages/cli/package.json').dependencies ?? {});
    expect(deps.filter((d) => !['@loomake/core', '@loomake/kit', '@loomake/trace', '@loomake/runner'].includes(d))).toEqual([]);
  });
});

describe('verify の性能', () => {
  it('[REQ-050] 要件 500 件・テストファイル 1,000 個の --done --skip-commands が 3 秒以内に終わる', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `REQ-${String(i + 1).padStart(3, '0')}`);
    const trace = traceMd({ ledger: ids.map((id) => ledgerRow(id)) });
    const spec = ['## ADDED Requirements', '', ...ids.map((id) => requirement(`振る舞い ${id}`, { source: `Source: ${id}` }))].join('\n');
    const r = await withProject({ trace, spec, config: { openspecValidate: 'auto', commands: {} } }, async (root) => {
      const tests: Record<string, [string, string][]> = {};
      for (let f = 0; f < 1000; f++) tests[`tests/t${f}.test.ts`] = [[`[${ids[f % 500]}] テスト ${f}`, 'passed']];
      writeReport(root, tests);
      const start = performance.now();
      const result = await run(root, 'verify', '--change', CHANGE, '--done', '--skip-commands', '--json');
      return { ...result, ms: performance.now() - start };
    });
    expect(r.code, r.stdout).toBe(0);
    expect(r.ms).toBeLessThan(3000);
  }, 30_000);
});
