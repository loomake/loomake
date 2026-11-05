import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseGhChecks } from '../../src/tool-output/gh.js';

const fixture = readFileSync(new URL('./fixtures/gh.json', import.meta.url), 'utf8');
describe('gh checks', () => {
  it('[REQ-448] 固定版の合成 fixture と既知 bucket を変換する', () => {
    expect(parseGhChecks('gh', fixture)).toEqual({ value: { tool: 'gh', kind: 'checks', checks: [
      { name: 'unit', bucket: 'pass', workflow: 'quality', link: 'https://example.test/check/1' },
      { name: 'review', bucket: 'pending', workflow: '', link: '' },
    ] }, errors: [] });
    for (const bucket of ['pass', 'fail', 'pending', 'skipping', 'cancel']) {
      expect(parseGhChecks('gh', JSON.stringify([{ name: '', bucket }])).value).toEqual({
        tool: 'gh', kind: 'checks', checks: [{ name: '', bucket, workflow: null, link: null }],
      });
    }
  });
  it('[REQ-448] 空の array と未知 bucket、任意欄の null、未知 key を扱う', () => {
    expect(parseGhChecks('gh', '[]')).toEqual({ value: { tool: 'gh', kind: 'checks', checks: [] }, errors: [] });
    expect(parseGhChecks('gh', '[{"name":"x","bucket":"future","workflow":null,"link":null,"extra":42}]').value).toEqual({
      tool: 'gh', kind: 'checks', checks: [{ name: 'x', bucket: 'other', workflow: null, link: null }],
    });
  });
  it.each(['{}', 'null', '[null]', '[{"name":1,"bucket":"pass"}]', '[{"name":"x"}]',
    '[{"name":"x","bucket":"pass","workflow":1}]', '[{"name":"x","bucket":"pass","link":false}]',
  ])('[REQ-448] 不正な形では最初の安全な ParseError だけを返す: %s', (text) => {
    expect(parseGhChecks('source', text)).toMatchObject({ value: null, errors: [{ file: 'source', line: 1 }] });
    expect(parseGhChecks('source', text).errors).toHaveLength(1);
  });
  it.each(['', '  \r\n ', '\uFEFF', '{\n "name":\n}'])('[REQ-448] 空・構文誤りで入力断片を返さない: %j', (text) => {
    const result = parseGhChecks('source', text);
    expect(result.value).toBeNull(); expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).not.toContain('name');
  });
  it('[REQ-448] 先頭 BOM を 1 つ除き、JSON.parse の RangeError も安全に返す', () => {
    expect(parseGhChecks('gh', '\uFEFF[]').value).not.toBeNull();
    expect(parseGhChecks('gh', '\uFEFF\uFEFF[]').value).toBeNull();
    const spy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => { throw new RangeError('入力断片'); });
    try { expect(parseGhChecks('gh', '[]')).toEqual({ value: null, errors: [{ file: 'gh', line: 1, message: 'JSON として読めません' }] }); }
    finally { spy.mockRestore(); }
  });
  it('[REQ-448] 入力の秘密や key はエラーへ出さず、文書順の最初の位置を示す', () => {
    const token = 'sk-' + 'a'.repeat(25);
    const text = JSON.stringify([{ name: token, bucket: 'pass', link: { [token]: token } }, { name: false }]);
    const result = parseGhChecks('gh', text);
    expect(result.errors).toEqual([{ file: 'gh', line: 1, message: '出力の形が違います：checks[0].link' }]);
    expect(JSON.stringify(result)).not.toContain(token);
  });
});
