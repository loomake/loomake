import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as kit from '@loomake/kit';
import * as runner from '@loomake/runner';
import * as trace from '@loomake/trace';
import { CLI_COMMANDS, SHARED_OPERATIONS, commandDefinition, helpOptions, optionSpec, parseOptions, suggest, traceOperation, type CliCommand } from '../src/args.js';
import { main } from '../src/main.js';
import { ORIGINAL_BASELINE_SHA256, applyBaselineChanges, baselineChangeProblems, baselineChanges, currentBaseline, originalBaseline, originalBaselineSha256, type BaselineCase, type BaselineChange } from './cli-baseline.js';

const root = resolve(import.meta.dirname, '../../..');
// 原本に、改版の change で承認した具体差分を当てた期待値（REQ-324）
const baseline = { cases: currentBaseline() };
const io = () => {
  const stdout: string[] = [], stderr: string[] = [];
  return { cwd: root, stdout: (text: string) => stdout.push(text), stderr: (text: string) => stderr.push(text), output: stdout, errors: stderr };
};

describe('変更前のCLI原本', () => {
  it.each(baseline.cases)('[REQ-324] 基準mainの全文・終了コードを保つ: $argv', async (item) => {
    const output = io();
    expect(await main(item.argv, output)).toBe(item.code);
    expect(output.output).toEqual(item.stdout);
    expect(output.errors).toEqual(item.stderr);
  });
});

describe('基準の原本と改版の差分', () => {
  const sample = (stdout: string[] = ['a\nold\nb']): BaselineCase[] => [{ argv: ['x', '--help'], code: 0, stdout, stderr: [] }];
  const change = (patch: Partial<BaselineChange> = {}): BaselineChange => ({
    change: 'c', requirement: 'REQ-040', approval: 'Q-01', reason: 'r', argv: [['x', '--help']], stream: 'stdout', from: 'old', to: 'new', ...patch,
  });

  it('[REQ-324] 原本は書き換えず（sha256を固定）、改版の差分は承認元つきで、対象の行だけを変える', () => {
    expect(originalBaselineSha256()).toBe(ORIGINAL_BASELINE_SHA256);
    const original = originalBaseline();
    expect(original.source).toContain('8d2d7ce');
    expect(original.cases).toHaveLength(46);
    const changes = baselineChanges();
    expect(baselineChangeProblems(changes)).toEqual([]);
    const current = currentBaseline();
    const changed = current.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.cases[index]));
    expect(changed.map((item) => item.argv)).toEqual(changes.flatMap((item) => item.argv));
    for (const item of changed) {
      const index = current.indexOf(item);
      const before = original.cases[index].stdout[0].split('\n'), after = item.stdout[0].split('\n');
      const diff = before.map((line, n) => [line, after[n]]).filter(([a, b]) => a !== b);
      expect(diff).toEqual(changes.filter((c) => c.argv.some((a) => JSON.stringify(a) === JSON.stringify(item.argv))).map((c) => [c.from, c.to]));
    }
  });

  it('[REQ-324] 差分の各欄が空か、change・承認元の回答が trace になければ不正にする', () => {
    const [real] = baselineChanges();
    expect(baselineChangeProblems([real])).toEqual([]);
    for (const key of ['change', 'requirement', 'approval', 'reason', 'from', 'to'] as const) {
      expect(baselineChangeProblems([{ ...real, [key]: '' }]).join()).toContain(`の ${key} が空です`);
      const rest: Record<string, unknown> = { ...real };
      delete rest[key];
      expect(baselineChangeProblems([rest]).join()).toContain(`の ${key} が空です`);
    }
    expect(baselineChangeProblems([{ ...real, change: 'no-such-change' }]).join()).toContain('openspec/changes にありません');
    expect(baselineChangeProblems([{ ...real, approval: 'S8-99（なし）' }]).join()).toContain('S8-99 の回答が verify-v2-evidence の trace にありません');
    expect(baselineChangeProblems([{ ...real, stream: 'stderr' as 'stdout' }]).join()).toContain('stream は stdout だけです');
    expect(baselineChangeProblems([{ ...real, argv: [] }]).join()).toContain('argv が不正です');
    expect(baselineChangeProblems([{ ...real, to: 'a\nb' }]).join()).toContain('to は 1 行です');
  });

  it('[REQ-324] 旧文がない・2 行ある・新文がすでにある・出力が 1 回でない・対象の例がないときは差分を当てずに例外にする', () => {
    expect(applyBaselineChanges(sample(), [change()])[0].stdout).toEqual(['a\nnew\nb']);
    expect(() => applyBaselineChanges(sample(['a\nb']), [change()])).toThrow('旧文が 1 行だけではありません');
    expect(() => applyBaselineChanges(sample(['old\nold']), [change()])).toThrow('旧文が 1 行だけではありません');
    expect(() => applyBaselineChanges(sample(['old\nnew']), [change()])).toThrow('新文がすでにあります');
    expect(() => applyBaselineChanges(sample(['old', 'x']), [change()])).toThrow('1 回の出力だけに当てます');
    expect(() => applyBaselineChanges(sample([]), [change()])).toThrow('1 回の出力だけに当てます');
    expect(() => applyBaselineChanges(sample(), [change({ argv: [['y']] })])).toThrow('対象がありません');
  });
});

it('[REQ-324] versionは先頭だけで扱い、その後のhelpをコマンドのhelpとして扱わない', async () => {
  const version = (JSON.parse(readFileSync(resolve(root, 'packages/cli/package.json'), 'utf8')) as { version: string }).version;
  const output = io();
  expect(await main(['--version', '--help'], output)).toBe(0);
  expect(output.output).toEqual([version]);
  const nested = io();
  expect(await main(['doctor', '--version'], nested)).toBe(2);
  expect(nested.errors.join('\n')).toContain('知らないオプションです：--version');
});

it('[REQ-323][REQ-324] 全コマンド・操作の受理名と解析順を明示値と照合する', () => {
  expect(CLI_COMMANDS.map((command) => command.name)).toEqual(['init', 'verify', 'trace', 'run', 'doctor']);
  expect(commandDefinition('trace').operations?.map((command) => command.name)).toEqual(['record', 'report', 'answer', 'approve']);
  const names = (name: 'init' | 'verify' | 'run' | 'doctor') => optionSpec(commandDefinition(name));
  expect(names('init')).toEqual({ values: [], flags: ['--codex', '--devcontainer'] });
  expect(names('verify')).toEqual({ values: ['--change'], flags: ['--spec-only', '--done', '--json', '--skip-commands'] });
  expect(names('run')).toEqual({ values: ['--change', '--engine'], flags: ['--dry-run', '--skip-permissions'] });
  expect(names('doctor')).toEqual({ values: [], flags: [] });
  expect(commandDefinition('trace').operations?.map(optionSpec)).toEqual([
    { values: ['--change'], flags: [] },
    { values: ['--change', '--format'], flags: [] },
    { values: ['--change', '--question', '--by', '--date', '--answer'], flags: [] },
    { values: ['--change', '--assumption', '--by', '--date'], flags: [] },
  ]);
  const answer = traceOperation('answer');
  expect(answer).toBeDefined();
  if (answer) expect(helpOptions(answer).map((option) => option.name)).toEqual(['--change', '--question', '--answer', '--by', '--date']);
  expect(SHARED_OPERATIONS.map((operation) => operation.names)).toEqual([['-h', '--help'], ['-v', '--version']]);
});

it('[REQ-323] 必須・条件・動的既定値を現在のhandlerと対応づける', () => {
  const lookup = (name: 'verify' | 'run', option: string) => commandDefinition(name).options.find((item) => item.name === option);
  expect(lookup('verify', '--change')).toMatchObject({ required: '条件付き必須', condition: expect.stringContaining('--spec-only') });
  expect(lookup('verify', '--done')).toMatchObject({ defaultValue: 'false', condition: expect.stringContaining('--spec-only') });
  expect(lookup('run', '--engine')).toMatchObject({ defaultValue: 'claude-code', choices: 'claude-code' });
  expect(lookup('run', '--skip-permissions')).toMatchObject({ defaultValue: 'false', condition: 'LOOMAKE_SANDBOX=1が必要' });
  for (const name of ['answer', 'approve']) {
    expect(traceOperation(name)?.options.find((option) => option.name === '--by')?.required).toBe('必須');
    expect(traceOperation(name)?.options.find((option) => option.name === '--date')).toMatchObject({ required: '任意', defaultValue: '実行環境のローカル日付' });
  }
  expect(traceOperation('answer')?.options.find((option) => option.name === '--answer')?.required).toBe('必須');
  expect(traceOperation('report')?.options.find((option) => option.name === '--format')).toMatchObject({ defaultValue: 'md', choices: 'md / json' });
  for (const command of CLI_COMMANDS.flatMap<CliCommand>((command) => 'operations' in command ? command.operations : [command])) {
    for (const option of command.options) {
      expect(option.required).not.toBe('');
      if (option.kind === 'flag') expect(option.defaultValue).toBe('false');
      if (option.required === '必須') expect(option.defaultValue).toBe('なし');
    }
  }
});

it('[REQ-324] 値・反復・空値・flag構文と候補同距離時の先頭優先を保つ', () => {
  const spec = optionSpec(commandDefinition('verify'));
  const parsed = parseOptions(['--change=first', '--change', 'last', '--json', '--json'], spec);
  expect([...parsed.values]).toEqual([['--change', 'last']]);
  expect([...parsed.flags]).toEqual(['--json']);
  expect(parseOptions(['--change=--value'], spec).values.get('--change')).toBe('--value');
  expect(parseOptions(['--change', ' '], spec).values.get('--change')).toBe(' ');
  for (const argv of [['--change='], ['--change'], ['--change', '--done']]) {
    expect(() => parseOptions(argv, spec)).toThrow('--change には値を続けてください');
  }
  for (const argv of [['--json=true'], ['positional'], ['-j']]) expect(() => parseOptions(argv, spec)).toThrow('知らないオプション');
  expect(suggest('--x', ['--b', '--a'])).toBe('--b');
  expect(suggest('--x', ['--a', '--b'])).toBe('--a');
});

it('[REQ-324] mainは既定値適用と業務の検証順を下位handlerへ引き継ぐ', async () => {
  const verify = vi.spyOn(kit, 'runVerify').mockReturnValue({ schemaVersion: '2.0.0', change: null, run: { status: 'completed', errors: [] }, scope: 'local', checks: [], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 0, pending: 0 }, decision: { required: false, reasons: [] } });
  const report = vi.spyOn(trace, 'runReport').mockReturnValue(0);
  const run = vi.spyOn(runner, 'runRun').mockResolvedValue(0);
  try {
    await main(['verify'], io());
    expect(verify).toHaveBeenLastCalledWith(expect.objectContaining({ changeId: undefined, gate: 'spec-only', skipCommands: false }));
    await main(['trace', 'report', '--change', 'x'], io());
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'md' }));
    await main(['trace', 'report', '--change', 'x', '--format=json'], io());
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'json' }));
    await main(['run', '--change', 'x'], io());
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ engine: undefined, dryRun: false, skipPermissions: false }));
    await main(['run', '--change', 'x', '--engine=claude-code', '--skip-permissions', '--dry-run'], io());
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ engine: 'claude-code', dryRun: true, skipPermissions: true }));
    verify.mockClear(); report.mockClear(); run.mockClear();
    for (const argv of [['verify', '--change', '--help'], ['run', '--bad', '-h'], ['trace', 'report', '--format=bad', '--help']]) {
      expect(await main(argv, io())).toBe(0);
    }
    expect(verify).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});
