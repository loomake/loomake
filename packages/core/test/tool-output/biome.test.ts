import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBiomeReport } from '../../src/tool-output/biome.js';

const summary = { errors: 1, warnings: 2, infos: 3, diagnosticsNotPrinted: 4 };
const position = (line = 1, column = 2) => ({ path: 'x.ts', start: { line, column }, end: { line: 2, column: 3 } });
const finding = { severity: 'error', message: '診断' };
const parse = (diagnostics: unknown[], override: unknown = summary) => parseBiomeReport('biome', JSON.stringify({ summary: override, diagnostics }));
describe('Biome JSON', () => {
  it('[REQ-448] 固定版の合成 fixture を変換し、summary 4 欄と位置だけを返す', () => {
    expect(parseBiomeReport('biome', readFileSync(new URL('./fixtures/biome.json', import.meta.url), 'utf8'))).toEqual({ value: {
      tool: 'biome', kind: 'diagnostics', summary: { errors: 1, warnings: 0, infos: 0, diagnosticsNotPrinted: 3 }, findings: [{
        severity: 'error', message: '合成の診断', category: 'lint/suspicious/noDoubleEquals', file: 'src/example.ts', line: 2, column: 3,
      }],
    }, errors: [] });
  });
  it('[REQ-448] 5 severity、任意欄の欠落/null、0/0、空 diagnostics を受け付ける', () => {
    expect(parse([]).value).toEqual({ tool: 'biome', kind: 'diagnostics', findings: [], summary });
    for (const severity of ['fatal', 'error', 'warning', 'info', 'hint']) {
      expect(parse([{ ...finding, severity, category: null, location: null }]).value).toMatchObject({ findings: [
        { severity, category: null, file: null, line: null, column: null },
      ] });
    }
    expect(parse([{ ...finding, location: position(0, 0) }]).value).toMatchObject({ findings: [{ file: 'x.ts', line: null, column: null }] });
    expect(parse([{ ...finding, location: position(Number.MAX_SAFE_INTEGER, 1) }]).errors).toEqual([]);
  });
  it.each([
    null, { ...finding, severity: 'future' }, { ...finding, message: 1 }, { ...finding, category: 1 },
    { ...finding, location: false }, { ...finding, location: { ...position(), path: 1 } },
    { ...finding, location: { ...position(), start: null } }, { ...finding, location: { ...position(), end: undefined } },
    { ...finding, location: { ...position(), end: { line: -1, column: 1 } } },
    ...[[0, 1], [1, 0], [-1, 2], [1.5, 2], [2 ** 53, 2], [1, 2 ** 53]].map(([line, column]) => ({ ...finding, location: position(line, column) })),
  ])('[REQ-448] 不正な診断と位置を拒否する: %j', diagnostic => {
    const result = parse([diagnostic]); expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
  });
  it.each([null, {}, { ...summary, errors: -1 }, { ...summary, warnings: 0.5 },
    { ...summary, infos: 2 ** 53 }, { ...summary, diagnosticsNotPrinted: '4' },
  ])('[REQ-448] summary の欠落・不正値を拒否する: %j', value => {
    expect(parse([], value)).toMatchObject({ value: null }); expect(parse([], value).errors).toHaveLength(1);
  });
  it('[REQ-448] 未知欄と advices を検査せず捨て、入力の key を診断へ出さない', () => {
    expect(parse([{ ...finding, advices: { secret: true }, unknown: 'x' }], { ...summary, duration: 'ignored' }).value).toEqual({
      tool: 'biome', kind: 'diagnostics', findings: [{ ...finding, category: null, file: null, line: null, column: null }], summary,
    });
    const secret = 'Bearer ' + 'a'.repeat(25);
    expect(parse([{ ...finding, location: { [secret]: secret } }]).errors).toEqual([
      { file: 'biome', line: 1, message: '出力の形が違います：diagnostics[0].location.path' },
    ]);
    expect(parseBiomeReport('biome', '{"summary":{},"diagnostics":null}').value).toBeNull();
  });
});
