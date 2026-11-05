import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGhChecks, parseClaudeResult, parseCodexEvents, parseBiomeReport, parsePlaywrightReport } from '../../src/index.js';

const parsers = [
  ['gh', parseGhChecks, 'gh.json'], ['claude', parseClaudeResult, 'claude.json'], ['codex', parseCodexEvents, 'codex.jsonl'],
  ['biome', parseBiomeReport, 'biome.json'], ['playwright', parsePlaywrightReport, 'playwright.json'],
] as const;
describe.each(parsers)('%s の共通契約', (tool, parse, fixture) => {
  it('[REQ-448] 空・空白・BOM だけ・JSON 構文誤りを 1 件の安全なエラーにする', () => {
    for (const input of ['', ' \r\n\t', '\uFEFF', '{"broken":']) {
      const result = parse('source', input);
      expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('source'); expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].message).not.toContain('broken');
    }
  });
  it('[REQ-448] 各公開 parser の tool/kind と未知キーの破棄が固定される', () => {
    const original = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
    const result = parse('source', original);
    expect(result.errors).toEqual([]); expect(result.value?.tool).toBe(tool);
    expect(parse('source', '\uFEFF'+original)).toEqual(result);
    const secret = 'sk-' + 'z'.repeat(25);
    const insert = (v: Record<string, unknown>) => Object.assign(v, { [secret]: { secret } });
    let withUnknown: string;
    if (tool === 'codex') withUnknown = original.trim().split('\n').map(line => JSON.stringify(insert(JSON.parse(line)))).join('\n');
    else {
      const v = JSON.parse(original);
      withUnknown = JSON.stringify(Array.isArray(v) ? v.map(insert) : insert(v));
    }
    expect(parse('source', withUnknown)).toEqual(result);
    expect(original).toBe(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8'));
  });
  it('[REQ-448] 不正な JSON にある値と key を構文エラーへ含めない', () => {
    const secret = 'github_pat_' + 'z'.repeat(25);
    const result = parse('source', `{"${secret}":"${secret}",`);
    expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
    expect(JSON.stringify(result.errors)).not.toContain(secret);
  });
});
it('[REQ-448] 通常 JSON の構文エラーは元の行番号だけを使う', () => {
  expect(parseGhChecks('gh', '{\n"name":1,\n}').errors).toEqual([
    { file: 'gh', line: 3, message: 'JSON として読めません' },
  ]);
});
