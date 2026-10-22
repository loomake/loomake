import { describe, it, expect } from 'vitest';
import { parseSpec } from '../src/index.js';

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
