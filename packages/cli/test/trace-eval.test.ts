import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as trace from '@loomake/trace';
import { main } from '../src/main.js';
import { CLI_REFERENCE, commandDefinition, optionSpec, traceOperation } from '../src/args.js';
import { fixture } from '../../trace/test/quality-eval-fixtures.js';
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
  it('[REQ-438] 公開12 JSON Schemaを基準mainの固定hashと照合する', () => {
    const expected = JSON.parse(readFileSync(new URL('./fixtures/eval-public-schema-hashes.json', import.meta.url), 'utf8')) as Record<string, string>;
    expect(Object.keys(expected)).toHaveLength(12);
    for (const [path, hash] of Object.entries(expected)) expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex')).toBe(hash);
  });
});
