import { describe, it, expect } from 'vitest';
import { parseTrace, setTraceCells } from '../src/index.js';

const trace = (questionHeader = '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |', row = '| Q-01 | REQ-001 | 何回ですか | 3 / 5 | 5 | yes | | | |') =>
  [
    '# Trace: c1',
    '',
    '## 要件台帳',
    '',
    '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |',
    '|---|---|---|---|---|---|',
    '| REQ-001 | §1 | 機能 | 要約 | 確認待ち | Q-01 |',
    '',
    '## 確認事項',
    '',
    questionHeader,
    `|${'---|'.repeat(questionHeader.split('|').length - 2)}`,
    row,
    '| Q-02 | REQ-001 | 別の質問 | a / b | a | no | b | 担当者 | 2026-10-01 |',
    '',
    '## 仮定',
    '',
    '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |',
    '|---|---|---|---|---|---|---|',
    '| A-01 | REQ-001 | 8 文字以上 | 一般的 | | | |',
    '',
  ].join('\n');

describe('trace.md の表の行を書く', () => {
  it('[REQ-202] ID の行の列に値を書き、ほかの行は変えない', () => {
    const r = setTraceCells(trace(), 'questions', 'Q-01', { 回答: '5 回', 回答者: '担当者', 回答日: '2026-10-24' });
    expect(r.error).toBeUndefined();
    const parsed = parseTrace('trace.md', r.text ?? '');
    expect(parsed.errors).toEqual([]);
    expect(parsed.value.questions[0]).toMatchObject({ 回答: '5 回', 回答者: '担当者', 回答日: '2026-10-24' });
    expect(r.text?.split('\n').filter((l) => !l.startsWith('| Q-01'))).toEqual(trace().split('\n').filter((l) => !l.startsWith('| Q-01')));
  });

  it('[REQ-202] 値の | は \\| として書き、読み直すと元の値になる', () => {
    const r = setTraceCells(trace(), 'questions', 'Q-01', { 回答: 'a|b', 回答者: 'x', 回答日: '2026-10-24' });
    expect(r.text).toContain('a\\|b');
    expect(parseTrace('trace.md', r.text ?? '').value.questions[0]['回答']).toBe('a|b');
  });

  it('[REQ-202] すでに値がある列・ない ID・改行を含む値は、書かずに理由を返す', () => {
    expect(setTraceCells(trace(), 'questions', 'Q-02', { 回答: 'x' }).error).toContain('すでに');
    expect(setTraceCells(trace(), 'questions', 'Q-09', { 回答: 'x' }).error).toContain('Q-09');
    expect(setTraceCells(trace(), 'questions', 'Q-01', { 回答: 'a\nb' }).error).toContain('改行');
  });

  it('[REQ-202] 表にない列は書かずに、ない列として返す', () => {
    const old = trace('| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |', '| Q-01 | REQ-001 | 何回ですか | 3 / 5 | 5 | yes | |');
    const r = setTraceCells(old, 'questions', 'Q-01', { 回答: '5 回', 回答者: '担当者', 回答日: '2026-10-24' });
    expect(r.missingColumns).toEqual(['回答者', '回答日']);
    expect(parseTrace('trace.md', r.text ?? '').value.questions[0]['回答']).toBe('5 回');
  });

  it('[REQ-203] 仮定の行にも書ける', () => {
    const r = setTraceCells(trace(), 'assumptions', 'A-01', { 承認: '承認', 承認者: 'PM', 承認日: '2026-10-24' });
    expect(parseTrace('trace.md', r.text ?? '').value.assumptions[0]).toMatchObject({ 承認: '承認', 承認者: 'PM', 承認日: '2026-10-24' });
  });
});
