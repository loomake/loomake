import { describe, expect, it } from 'vitest';
import { createAgreement, type Trace } from '../src/index.js';

const trace = (): Trace => ({
  ledger: [{ ID: 'REQ-012', 出典: '要件書1行目', 種別: '機能', '要約（原文に忠実に）': 'sample', 状態: '反映済', 反映先: 'specs/x/spec.md', line: 7 }],
  questions: [
    { ID: 'Q-01', 関連: 'REQ-012', 質問: '決定は', 選択肢: '', おすすめ: '', ブロッキング: 'YES', 回答: '', 回答者: '', 回答日: '', line: 12 },
    { ID: 'Q-02', 関連: 'REQ-012', 質問: '確認は', 選択肢: '', おすすめ: '', ブロッキング: 'no', 回答: '', 回答者: '', 回答日: '', line: 13 },
    { ID: 'Q-03', 関連: 'REQ-012', 質問: '回答は', 選択肢: '', おすすめ: '', ブロッキング: 'yes', 回答: '決定済み', 回答者: '', 回答日: '', line: 14 },
  ],
  assumptions: [{ ID: 'A-01', 関連: 'REQ-012', 仮定の内容: '前提', 理由: '', 承認: '', 承認者: '', 承認日: '', line: 20 }],
});

describe('要件と合意のモデル', () => {
  it('[REQ-147] DTOの列名から独立したモデルへ変換し、入力を変更しない', () => {
    const input = trace();
    const before = structuredClone(input);
    const result = createAgreement('trace.md', input);
    expect(result.errors).toEqual([]);
    expect(result.value.requirements).toEqual([{ id: 'REQ-012', source: '要件書1行目', state: '反映済' }]);
    expect(result.value.questions[0]).toEqual({ id: 'Q-01', blocking: true, answer: '' });
    expect(input).toEqual(before);
  });

  it.each(['REQ-12', 'REQ-012x', ''])('[REQ-147] 不正なID %j はファイルと行を示す', (id) => {
    const input = trace();
    input.ledger[0].ID = id;
    expect(createAgreement('source.md', input).errors).toEqual([expect.objectContaining({ file: 'source.md', line: 7 })]);
  });

  it('[REQ-147] 不正な状態をモデルへ通さない', () => {
    const input = trace();
    input.ledger[0]['状態'] = '未定';
    const result = createAgreement('trace.md', input);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: 'trace.md', line: 7 });
    expect(result.value.requirements).toEqual([]);
  });

});
