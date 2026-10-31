import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { extractTestRequirements } from '@loomake/core';
import { evaluateTestCoverage } from '@loomake/kit';
import { main } from '../src/main.js';
import { CHANGE, COPY_REPORT, ledgerRow, reportJson, requirement, traceMd, withProject } from '../../kit/test/project.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

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
    expect(out.schemaVersion).toBe('2.0.0');
    const validate = new Ajv2020({ strict: false }).compile(readJson('packages/core/schema/verify-result.schema.json'));
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true);
    // 進捗は標準エラーに出す
    expect(r.stderr).toContain('… lint:');
  });

  it('[REQ-040] 要件ごとのテストファイルの一覧を出す', async () => {
    // 今回の test コマンドが書き出したレポートで数える。--skip-commands では coverage を出さない（REQ-040）
    const r = await withProject({ config: { openspecValidate: false, commands: { test: COPY_REPORT } } }, (root) => {
      writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
      return run(root, 'verify', '--change', CHANGE, '--done', '--json');
    });
    expect(JSON.parse(r.stdout).coverage).toEqual({ 'REQ-012': ['tests/a.test.ts'] });
  });

  it('[REQ-040] 前回の成功レポートがあっても、--skip-commands の --json は coverage を出さず、不足で終了コード 1', async () => {
    const r = await withProject({}, (root) => {
      writeReport(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
      return run(root, 'verify', '--change', CHANGE, '--done', '--json', '--skip-commands');
    });
    const out = JSON.parse(r.stdout);
    expect(out).not.toHaveProperty('coverage');
    expect(out).toMatchObject({ scope: 'ci', verdict: 'INSUFFICIENT_EVIDENCE' });
    expect(r.code).toBe(1);
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

  it('[REQ-041][REQ-055][REQ-192] --change を付けずに --spec-only を指定すると、日本語の使い方を出して 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--spec-only・--done には --change <id> が必要です');
    expect(r.stderr).toContain('使い方: loomake verify');
  });

  it('[REQ-041] --change の値にパスの区切りを含めると、日本語で表示して 2', async () => {
    for (const id of ['../../packages', 'a/b', 'a\\b']) {
      const r = await withProject({}, (root) => run(root, 'verify', '--change', id, '--spec-only'));
      expect(r.code, id).toBe(2);
      expect(r.stderr).toContain('パスの区切り');
    }
  });

  it('[REQ-041] --change の値が change 名の形でなければ、openspec validate を呼ばずに日本語で表示して 2', async () => {
    // openspecValidate が true なので、検査まで進めば openspec コマンドを呼ぶ
    for (const id of ['c1&echo', 'C1', 'c1_x', '-c1', 'c1-', 'a--b']) {
      const r = await withProject({ config: { openspecValidate: true, commands: {} } }, (root) => run(root, 'verify', '--change', id, '--spec-only'));
      expect(r.code, id).toBe(2);
      expect(r.stderr, id).toContain('英小文字・数字');
      expect(r.stdout, id).not.toContain('openspec validate');
    }
  });

  it('[REQ-041] archive を --change に渡すと、日本語で表示して 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--change', 'archive', '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('archive は change-id に使えません');
  });

  it('[REQ-041] --change=<id> の形を、--change <id> と同じに扱う', async () => {
    const r = await withProject({}, async (root) => [await run(root, 'verify', `--change=${CHANGE}`, '--spec-only', '--json'), await run(root, 'verify', '--change', CHANGE, '--spec-only', '--json')]);
    expect(r[0].code).toBe(0);
    expect(JSON.parse(r[0].stdout)).toEqual(JSON.parse(r[1].stdout));
  });

  it('[REQ-041] 値を取らないオプションの = の形は、知らないオプションにする（improve-cli-help の仮定 A-01）', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--change', CHANGE, '--done=yes'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('知らないオプションです：--done=yes');
  });

  it('[REQ-041] 知らないコマンドを指定すると、その名前を挙げて知らないと表示し、2 を返す', async () => {
    const r = await run(repo, 'foo');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('知らないコマンドです：foo');
    expect(r.stderr).toContain('使い方: loomake');
  });

  it('[REQ-041] loomake.config.json の形が正しくなければ 2', async () => {
    const r = await withProject({ config: { tests: { report: 1 } } }, (root) => run(root, 'verify', '--change', CHANGE, '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('tests.report は空でない文字列にしてください');
  });

  it('[REQ-041] サブコマンドが無ければ、使い方を出して 2', async () => {
    const r = await withProject({}, (root) => run(root));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('使い方: loomake <init | verify | trace | run | doctor>');
  });
});

describe('change の省略', () => {
  it('[REQ-042] loomake verify を引数なしで実行すると、commands だけを実行する', async () => {
    const r = await withProject({ config: { commands: { test: 'node -e ""' } } }, (root) => run(root, 'verify', '--json'));
    const out = JSON.parse(r.stdout);
    expect(out).toMatchObject({ schemaVersion: '2.0.0', change: null, scope: 'local' });
    expect(out).not.toHaveProperty('verdict');
    expect(out.checks.map((x: { id: string }) => x.id)).toEqual(['command: test']);
    expect(r.code).toBe(0);
  });
});

describe('実行時依存の範囲', () => {
  it('[REQ-047] kit の dependencies は @loomake/core を含み、@loomake/core と yaml 以外を含まない', () => {
    const deps = Object.keys(readJson('packages/kit/package.json').dependencies ?? {});
    expect(deps).toContain('@loomake/core');
    expect(deps.filter((d) => !['@loomake/core', 'yaml'].includes(d))).toEqual([]);
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
      mkdirSync(join(root, 'tests'));
      for (let f = 0; f < 1000; f++) {
        const name = `tests/t${f}.test.ts`;
        tests[name] = [[`[${ids[f % 500]}] テスト ${f}`, 'passed']];
        writeFileSync(join(root, name), `it('[${ids[f % 500]}] テスト ${f}', () => {});\n`);
      }
      writeReport(root, tests);
      const start = performance.now();
      const result = await run(root, 'verify', '--change', CHANGE, '--done', '--skip-commands', '--json');
      // --skip-commands では前回のレポートを読まないので（REQ-040）、同じレポートの抽出と要件の対応の判定を続けて測り、処理量を保つ
      const extracted = extractTestRequirements('.loomake/test-report.json', readFileSync(join(root, '.loomake', 'test-report.json'), 'utf8'));
      const decided = evaluateTestCoverage(ids, extracted.value);
      return { ...result, ms: performance.now() - start, errors: extracted.errors, decided };
    });
    expect(r.errors).toEqual([]);
    expect(r.decided.missing).toEqual([]);
    expect(Object.values(r.decided.coverage).every((files) => files.length === 2)).toBe(true);
    // --skip-commands は品質コマンドの不足で 1（REQ-040）。不足は品質コマンドと要件ごとのテストの 2 件だけ
    expect(r.code, r.stdout).toBe(1);
    expect(JSON.parse(r.stdout).checks.filter((c: { result: string }) => c.result !== 'PASS').map((c: { id: string }) => c.id)).toEqual(['品質コマンド', '要件ごとのテスト']);
    expect(r.ms).toBeLessThan(3000);
  }, 30_000);
});

describe('ヘルプと版', () => {
  it('[REQ-135] loomake --help と -h は、サブコマンドの一覧と説明を標準出力に出し、終了コード 0 を返す', async () => {
    for (const flag of ['--help', '-h']) {
      const r = await run(repo, flag);
      expect(r.code).toBe(0);
      for (const name of ['init', 'verify', 'trace', 'run', 'doctor']) expect(r.stdout).toMatch(new RegExp(`^  ${name} +\\S`, 'm'));
    }
  });

  it('[REQ-135] loomake verify --help は verify の使い方と各オプションの説明を出し、検査を実行せずに終了コード 0 を返す', async () => {
    const r = await run(repo, 'verify', '--change', 'nothing', '--done', '--help');
    expect(r.code).toBe(0);
    expect(r.stdout.split('\n')[0]).toBe('使い方: loomake verify [--change <id> (--spec-only | --done)] [--json] [--skip-commands]');
    for (const option of ['--change <id>', '--spec-only', '--done', '--json', '--skip-commands']) expect(r.stdout).toMatch(new RegExp(`^  ${option.replace(/[<>]/g, '.')} +\\S`, 'm'));
    expect(r.stderr).toBe('');
  });

  it('[REQ-135] trace record --help と trace report --help は、それぞれの使い方を出す', async () => {
    const record = await run(repo, 'trace', 'record', '--help');
    expect(record.code).toBe(0);
    expect(record.stdout.split('\n')[0]).toBe('使い方: loomake trace record --change <id>');
    expect(record.stdout).not.toContain('--format');
    const report = await run(repo, 'trace', 'report', '-h');
    expect(report.stdout.split('\n')[0]).toBe('使い方: loomake trace report --change <id> [--format md|json]');
    expect(report.stdout).toMatch(/^ {2}--format md\|json +\S/m);
  });

  it('[REQ-135] trace のあとが record・report 以外（constructor・toString など）なら、trace 全体の使い方を出す', async () => {
    const whole = await run(repo, 'trace', '--help');
    for (const sub of ['constructor', 'toString', 'nothing']) {
      const r = await run(repo, 'trace', sub, '--help');
      expect(r.code, sub).toBe(0);
      expect(r.stdout, sub).toBe(whole.stdout);
      expect(r.stdout, sub).not.toContain('[Function');
    }
  });

  it('[REQ-135] init・run・doctor の使い方にも、説明とオプションの説明を載せる', async () => {
    const options: Record<string, string[]> = { init: ['--codex', '--devcontainer'], run: ['--change <id>', '--engine <名前>', '--dry-run', '--skip-permissions'], doctor: [] };
    for (const [cmd, opts] of Object.entries(options)) {
      const r = await run(repo, cmd, '--help');
      const lines = r.stdout.split('\n');
      expect(lines[0]).toContain(`使い方: loomake ${cmd}`);
      expect(lines[1]).toMatch(/\S/);
      for (const o of opts) expect(r.stdout, cmd).toMatch(new RegExp(`^  ${o.replace(/[<>]/g, '.')} +\\S`, 'm'));
    }
  });

  it('[REQ-135] init・trace・run も -h で使い方を出す', async () => {
    for (const cmd of ['init', 'trace', 'run']) {
      const r = await run(repo, cmd, '-h');
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(`使い方: loomake ${cmd}`);
    }
  });

  it('[REQ-135] loomake --version と -v は、package.json の version を出して終了コード 0 を返す', async () => {
    for (const flag of ['--version', '-v']) {
      const r = await run(repo, flag);
      expect(r.code).toBe(0);
      expect(r.stdout).toBe(readJson('packages/cli/package.json').version);
    }
  });
});
