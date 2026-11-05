import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as trace from '@loomake/trace';
import { main } from '../src/main.js';
import { CLI_REFERENCE, commandDefinition, optionSpec, traceOperation } from '../src/args.js';
import { fixture } from '../../trace/test/quality-eval-fixtures.js';
import { EVAL_LOCK, QUALITY_FILES } from '../../trace/src/quality-files.js';
import type { QualityEvaluation } from '../../trace/src/quality-model.js';
import { renderCliReference } from '../../../scripts/generate-cli-reference.mjs';

vi.setConfig({ testTimeout: 15_000 });
const root = resolve(import.meta.dirname, '../../..');
async function run(cwd: string, ...args: string[]) {
  const out: string[] = [], err: string[] = [];
  const code = await main(args, { cwd, stdout: (s) => out.push(s), stderr: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
describe('trace evalの追加と既存契約', () => {
  it('[REQ-437][REQ-323] help・候補・オプションなしを共通定義と生成物へ反映する', async () => {
    expect(await run(root, 'trace', 'eval', '--help')).toMatchObject({ code: 0, out: expect.stringContaining('使い方: loomake trace eval') });
    expect(await run(root, 'trace', 'evl')).toMatchObject({ code: 2, err: expect.stringContaining('もしかして：eval') });
    for (const option of ['--x', '--change=x', '--scope=ci', '--json', 'extra']) expect(await run(root, 'trace', 'eval', option)).toMatchObject({ code: 2, err: expect.stringContaining('知らないオプション') });
    expect(commandDefinition('trace').operations?.map((operation) => operation.name)).toEqual(['record', 'report', 'answer', 'approve', 'eval']);
    expect(optionSpec(traceOperation('eval') ?? commandDefinition('trace'))).toEqual({ values: [], flags: [] });
    const generated = renderCliReference(CLI_REFERENCE);
    expect(generated).toBe(readFileSync(join(root, 'docs/guide/3.reference/5.cli.md'), 'utf8'));
    expect(generated).toContain('## loomake trace eval\n\n使い方: loomake trace eval\n');
  });
  it('[REQ-429][REQ-437][REQ-438] evalは旧reportを呼ばず実コマンドを評価し、旧reportはchange必須のまま', async () => {
    const f = fixture(), report = vi.spyOn(trace, 'runReport');
    try {
      expect(await run(f.root, 'trace', 'eval')).toMatchObject({ code: 0, out: expect.stringContaining('品質評価を保存しました') });
      expect(report).not.toHaveBeenCalled();
      expect(await run(f.root, 'trace', 'report')).toMatchObject({ code: 2, err: expect.stringContaining('--change <id> が必要') });
      report.mockReturnValueOnce(0);
      expect(await run(f.root, 'trace', 'report', '--change', 'old', '--format', 'json')).toMatchObject({ code: 0 });
      expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ changeId: 'old', format: 'json' }));
    } finally { report.mockRestore(); }
  });
  it.each([
    ['commands', 'result', 'passed'], ['observations', 'status', 'measured'], ['subjects', 'id', 'PQ-001'],
  ] as const)('[REQ-433][REQ-440][REQ-437] 不正な%s.%sをCLIで2にし帳簿を一切追記しない', async (collection, field, valid) => {
    for (const invalid of [[valid], { toString: null }]) for (const location of ['history', 'index', 'both']) {
      const f = fixture("const fs=require('node:fs');fs.appendFileSync('.loomake/command-calls','called\\n');const now=Date.now();fs.writeFileSync('.loomake/test-report.json',JSON.stringify({startTime:now,success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:'test.js',status:'passed',assertionResults:[{fullName:'fixture',status:'passed'}]}]}));");
      expect(await run(f.root, 'trace', 'eval')).toMatchObject({ code: 0 });
      const value = f.storage().index as QualityEvaluation;
      (value[collection][0] as unknown as Record<string, unknown>)[field] = invalid;
      if (location !== 'index') writeFileSync(join(f.root, QUALITY_FILES.history), `${JSON.stringify(value)}\n`);
      if (location !== 'history') writeFileSync(join(f.root, QUALITY_FILES.index), JSON.stringify(value));
      rmSync(join(f.root, '.loomake/command-calls'));
      const snapshot = () => Object.fromEntries(Object.entries(QUALITY_FILES).map(([key, file]) => [key, existsSync(join(f.root, file)) ? readFileSync(join(f.root, file)) : null]));
      const before = snapshot();
      expect(await run(f.root, 'trace', 'eval')).toMatchObject({ code: 2, err: expect.stringContaining('評価の') });
      expect(snapshot()).toEqual(before);
      expect(existsSync(join(f.root, '.loomake/command-calls'))).toBe(false);
      expect(existsSync(join(f.root, EVAL_LOCK))).toBe(false);
    }
  });
  it('[REQ-432][REQ-433][REQ-440] 未知の追加欄を持つ有効な帳簿では評価を続け原行を保持する', async () => {
    const f = fixture(); expect(await run(f.root, 'trace', 'eval')).toMatchObject({ code: 0 });
    const value = f.storage().index as QualityEvaluation;
    Object.assign(value, { future: { kept: true } });
    for (const collection of ['commands', 'observations', 'subjects'] as const) Object.assign(value[collection][0], { future: ['kept'] });
    writeFileSync(join(f.root, QUALITY_FILES.history), `${JSON.stringify(value)}\n`);
    writeFileSync(join(f.root, QUALITY_FILES.index), JSON.stringify(value));
    const before = readFileSync(join(f.root, QUALITY_FILES.history));
    expect(await run(f.root, 'trace', 'eval')).toMatchObject({ code: 0 });
    const saved = f.storage();
    expect(saved.ledgers.history).toHaveLength(2);
    expect(saved.ledgers.history[0]).toEqual(value);
    expect(readFileSync(join(f.root, QUALITY_FILES.history)).subarray(0, before.length)).toEqual(before);
  });
  it('[REQ-438] 公開12 JSON Schemaを基準mainの固定hashと照合する', () => {
    const expected = JSON.parse(readFileSync(new URL('./fixtures/eval-public-schema-hashes.json', import.meta.url), 'utf8')) as Record<string, string>;
    expect(Object.keys(expected)).toHaveLength(12);
    for (const [path, hash] of Object.entries(expected)) expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex')).toBe(hash);
  });
});
