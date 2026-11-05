import { describe, it, expect } from 'vitest';
import { parseSpec } from '../src/index.js';
import { fenceMask, splitLines } from '../src/parse.js';

const spec = `## ADDED Requirements

### Requirement: ログイン
利用者はログインできる SHALL。

Source: REQ-001, REQ-002

#### Scenario: 成功
- **WHEN** 正しいパスワード
- **THEN** ログインできる

#### Scenario: 失敗
- **WHEN** 誤ったパスワード
- **THEN** ログインできない

## MODIFIED Requirements

### Requirement: ロック
**Source**: REQ-003

#### Scenario: ロックする
- **WHEN** 5 回失敗する
- **THEN** ロックする

## REMOVED Requirements

### Requirement: 古い機能
Source: REQ-004

## RENAMED Requirements

- FROM: \`### Requirement: 旧名\`
- TO: \`### Requirement: 新名\`
`;

describe('parseSpec', () => {
  it('[REQ-013][REQ-051] ADDED の Requirement の操作・名前・Source・Scenario 数を返す', () => {
    const { value, errors } = parseSpec('spec.md', spec);
    expect(errors).toEqual([]);
    expect(value[0]).toEqual({ op: 'ADDED', name: 'ログイン', sources: ['REQ-001', 'REQ-002'], scenarios: 2, line: 3 });
  });

  it('[REQ-013][REQ-051] 4 つの操作の見出しに対応する操作が付く', () => {
    const { value } = parseSpec('spec.md', spec);
    expect(value.map((r) => [r.op, r.name])).toEqual([
      ['ADDED', 'ログイン'],
      ['MODIFIED', 'ロック'],
      ['REMOVED', '古い機能'],
      ['RENAMED', '新名'],
    ]);
    expect(value[1].sources).toEqual(['REQ-003']);
    expect(value[3]).toMatchObject({ from: '旧名', line: 32 });
  });

  it('[REQ-013][REQ-051] 行末が CRLF でも LF と同じ結果を返す', () => {
    expect(parseSpec('spec.md', spec.replace(/\n/g, '\r\n'))).toEqual(parseSpec('spec.md', spec));
  });

  it('[REQ-013][REQ-018] RENAMED の FROM と TO が組にならないときは、行番号つきのエラーにする', () => {
    const text = '## RENAMED Requirements\n\n- FROM: `### Requirement: A`\n- FROM: `### Requirement: B`\n- TO: `### Requirement: C`\n- TO: `### Requirement: D`\n';
    const { value, errors } = parseSpec('spec.md', text);
    expect(value).toEqual([{ op: 'RENAMED', name: 'C', from: 'B', sources: [], scenarios: 0, line: 4 }]);
    expect(errors.map((e) => [e.file, e.line])).toEqual([
      ['spec.md', 3],
      ['spec.md', 6],
    ]);
  });

  it('[REQ-013] コードブロックの中の見出しは読まない', () => {
    const text = '## ADDED Requirements\n\n```md\n### Requirement: 例\n```\n\n### Requirement: 本物\nSource: REQ-001\n';
    expect(parseSpec('spec.md', text).value.map((r) => r.name)).toEqual(['本物']);
  });
});


describe('Markdown の境界', () => {
  it.each(['```', '~~~'])('[REQ-013] info string 付きの %s ではフェンスを閉じない', (fence) => {
    const text = [fence + 'markdown', fence + 'js', '## ADDED Requirements', '### Requirement: 内側', 'Source: REQ-001', '#### Scenario: 内側', fence, '## ADDED Requirements', '### Requirement: 外側', 'Source: REQ-002', '#### Scenario: 外側'].join('\n');
    expect(parseSpec('spec.md', text).value.map((r) => r.name)).toEqual(['外側']);
  });

  it('[REQ-013][REQ-051] 先頭 BOM の後の操作を読み行番号を保つ', () => {
    const plain = parseSpec('spec.md', spec);
    expect(parseSpec('spec.md', '\uFEFF' + spec)).toEqual(plain);
  });

  it('[REQ-013] Source ID の重複を初出順で除く', () => {
    const text = '## ADDED Requirements\n### Requirement: x\nSource: REQ-002, REQ-001, REQ-002\nSource: REQ-003, REQ-001\n#### Scenario: x';
    expect(parseSpec('spec.md', text).value[0].sources).toEqual(['REQ-002', 'REQ-001', 'REQ-003']);
  });
});

it('[REQ-013][REQ-051] splitLines は先頭 BOM を一つだけ除き内部の BOM を保つ', () => {
  expect(splitLines('\uFEFF\uFEFFhead\r\ninner\uFEFF\rtail')).toEqual(['\uFEFFhead', 'inner\uFEFF', 'tail']);
});

it('[REQ-013] 同じ記号の長いフェンスと末尾の空白で閉じる', () => {
  expect(fenceMask(['````md', '```', '~~~~', '````js', '内部', '`````  \t', '外側'])).toEqual([true, true, true, true, true, true, false]);
});
