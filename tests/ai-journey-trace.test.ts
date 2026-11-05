import { describe, expect, it } from 'vitest';
import { parseTrace } from '../packages/core/src/index.js';
import { insertRecoveryQuestion } from '../scripts/ai-journeys.mjs';

const question = '| Q-01 | REQ-001 | 試験用の確認 | はい | はい | yes | |';
const prefix = [
  '# Trace: sample',
  '## 要件台帳',
  '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |',
  '|---|---|---|---|---|---|',
  '| REQ-001 | fixture | 機能 | fixture | 反映済 | specs/x/spec.md |',
  '',
  '## 仮定',
  '| ID | 関連 | 仮定の内容 | 理由 | 承認 |',
  '|---|---|---|---|---|',
  '',
  '## 確認事項',
];

describe('復旧シナリオの質問挿入', () => {
  for (const eol of ['\n', '\r\n']) {
    for (const trailing of [false, true]) {
      for (const columns of [7, 9]) {
        it(`[REQ-155][REQ-156][REQ-157] ${JSON.stringify(eol)}・EOF改行${trailing}・${columns}列でも質問を表内へ挿入する`, () => {
          const header = '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |' + (columns === 9 ? ' 回答者 | 回答日 |' : '');
          const lines = [...prefix, header, '|' + '---|'.repeat(columns), ...(trailing ? [''] : [])];
          const result = insertRecoveryQuestion(lines.join(eol));
          expect(result).toBe([...lines.slice(0, prefix.length + 2), question, ...lines.slice(prefix.length + 2)].join(eol));
          const parsed = parseTrace('trace.md', result);
          expect(parsed.errors).toEqual([]);
          expect(parsed.value.questions).toHaveLength(1);
          expect(parsed.value.questions[0]).toMatchObject({ ID: 'Q-01', ブロッキング: 'yes', 回答: '' });
        });
      }
    }
  }

  it('[REQ-155][REQ-156][REQ-157] 質問表がなければ黙って続けず挿入失敗を示す', () => {
    expect(() => insertRecoveryQuestion(prefix.slice(0, -1).join('\n'))).toThrow('確認事項');
  });
});
