import { describe, expect, it } from 'vitest';
import { createAgreement, type Trace } from '@loomake/core';
import { evaluateAgreement } from '../src/index.js';

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
  it('[REQ-148] 未回答のブロッキング質問だけを停止条件にする', () => {
    const model = createAgreement('trace.md', trace()).value;
    const before = structuredClone(model);
    expect(evaluateAgreement(model)).toEqual({ blockingQuestions: ['Q-01'], pendingRequirements: [], unapprovedAssumptions: ['A-01'], missingSources: [] });
    expect(model).toEqual(before);
  });

  it('[REQ-148] 確認待ち・出典不足・未承認と、承認済みを区別する', () => {
    const input = trace();
    input.ledger[0]['状態'] = '確認待ち';
    input.ledger[0]['出典'] = '';
    input.assumptions[0]['承認'] = '承認';
    expect(evaluateAgreement(createAgreement('trace.md', input).value)).toMatchObject({ pendingRequirements: ['REQ-012'], missingSources: ['REQ-012'], unapprovedAssumptions: [] });
  });
});
