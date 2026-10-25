import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createTraceTemplate, parseTrace } from '../src/index.js';

const crlf = (s: string) => s.replace(/\n/g, '\r\n');

const trace = `# Trace: add-x

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-001 | 要件書 §1 | 機能 | \`a \\| b\` を返す | 反映済 | specs/x/spec.md |
| REQ-002 | 要件書 §2 | 機能 | 未定の要件 | 確認待ち | Q-01 |

## 確認事項

<!-- コメント -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-01 | REQ-002 | 何回ですか | 3 / 5 | 5 | yes | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-001 | 8 文字以上 | 記載なし | 承認（2026-10-22） |
`;

const ledgerWithStates = (states: string[]) =>
  [
    '## 要件台帳',
    '',
    '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |',
    '|---|---|---|---|---|---|',
    ...states.map((s, i) => `| REQ-00${i + 1} | 要件書 | 機能 | 要約 | ${s} | specs/x/spec.md |`),
    '',
    '## 確認事項',
    '',
    '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |',
    '|---|---|---|---|---|---|---|',
    '',
    '## 仮定',
    '',
    '| ID | 関連 | 仮定の内容 | 理由 | 承認 |',
    '|---|---|---|---|---|',
  ].join('\n');

describe('parseTrace', () => {
  it('[REQ-011] 3 つの表を、列名をキーにした配列として返す', () => {
    const { value, errors } = parseTrace('trace.md', trace);
    expect(errors).toEqual([]);
    expect(value.ledger).toEqual([
      { ID: 'REQ-001', 出典: '要件書 §1', 種別: '機能', '要約（原文に忠実に）': '`a | b` を返す', 状態: '反映済', 反映先: 'specs/x/spec.md', line: 7 },
      { ID: 'REQ-002', 出典: '要件書 §2', 種別: '機能', '要約（原文に忠実に）': '未定の要件', 状態: '確認待ち', 反映先: 'Q-01', line: 8 },
    ]);
    expect(value.questions).toEqual([
      { ID: 'Q-01', 関連: 'REQ-002', 質問: '何回ですか', 選択肢: '3 / 5', おすすめ: '5', ブロッキング: 'yes', 回答: '', 回答者: '', 回答日: '', line: 16 },
    ]);
    expect(value.assumptions).toEqual([
      { ID: 'A-01', 関連: 'REQ-001', 仮定の内容: '8 文字以上', 理由: '記載なし', 承認: '承認（2026-10-22）', 承認者: '', 承認日: '', line: 22 },
    ]);
  });

  it('[REQ-011] 要件台帳の表が無いときは、空の台帳と、表が無いことのエラーを返す', () => {
    const text = trace.replace(/## 要件台帳[\s\S]*?(?=## 確認事項)/, '');
    const { value, errors } = parseTrace('trace.md', text);
    expect(value.ledger).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('要件台帳');
  });

  it('[REQ-011] 見出しはあるが表が無いときも、表が無いことのエラーを返す', () => {
    const text = trace.replace(/(## 要件台帳\n)[\s\S]*?(?=## 確認事項)/, '$1\n');
    const { value, errors } = parseTrace('trace.md', text);
    expect(value.ledger).toEqual([]);
    expect(errors).toEqual([{ file: 'trace.md', line: 3, message: '「要件台帳」の表がありません' }]);
  });

  it('[REQ-011] 行末が CRLF でも LF と同じ結果を返し、値の末尾に \\r が残らない', () => {
    const lf = parseTrace('trace.md', trace);
    const cr = parseTrace('trace.md', crlf(trace));
    expect(cr).toEqual(lf);
    expect(JSON.stringify(cr.value)).not.toContain('\\r');
  });

  it('[REQ-012] 決まった値でない状態を、ID と値つきのエラーにする', () => {
    const { errors } = parseTrace('trace.md', ledgerWithStates(['反映済', '対応中']));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('REQ-002');
    expect(errors[0].message).toContain('対応中');
  });

  it('[REQ-012] 4 つの状態値だけなら、状態値のエラーは無い', () => {
    const { value, errors } = parseTrace('trace.md', ledgerWithStates(['反映済', '確認待ち', '範囲外', '既存仕様で充足']));
    expect(value.ledger).toHaveLength(4);
    expect(errors).toEqual([]);
  });

  it('[REQ-018] エラーは、渡したファイル名と、不正な行の行番号を持つ', () => {
    // 台帳の 3 行目（ファイルの 7 行目）が不正な状態値
    const { errors } = parseTrace('trace.md', ledgerWithStates(['反映済', '反映済', '対応中']));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: 'trace.md', line: 7 });
  });
});

describe('parseTrace：合意の列', () => {
  const withAgreement = trace
    .replace('| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |\n|---|---|---|---|---|---|---|', '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |\n|---|---|---|---|---|---|---|---|---|')
    .replace('| ID | 関連 | 仮定の内容 | 理由 | 承認 |\n|---|---|---|---|---|', '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |\n|---|---|---|---|---|---|---|')
    .replace('| yes | |', '| yes | 5 回 | プロダクト責任者 | 2026-10-23 |')
    .replace('| 承認（2026-10-22） |', '| 承認（2026-10-22） | 開発リーダー | 2026-10-23 |');

  it('[REQ-011][REQ-077][REQ-078] 確認事項の回答者・回答日と、仮定の承認者・承認日を読む', () => {
    const { value, errors } = parseTrace('trace.md', withAgreement);
    expect(errors).toEqual([]);
    expect(value.questions[0]).toMatchObject({ 回答: '5 回', 回答者: 'プロダクト責任者', 回答日: '2026-10-23' });
    expect(value.assumptions[0]).toMatchObject({ 承認者: '開発リーダー', 承認日: '2026-10-23' });
  });

  it('[REQ-011][REQ-077][REQ-078] 合意の列でない列が無いときは、表と列の名前と、ヘッダの行番号を持つエラーを返す', () => {
    const broken = trace.replace('| ブロッキング |', '| ブロッキング? |');
    const { errors } = parseTrace('trace.md', broken);
    const line = broken.split('\n').findIndex((l) => l.includes('ブロッキング?')) + 1;
    expect(errors).toEqual([{ file: 'trace.md', line, message: '「確認事項」の表に「ブロッキング」の列がありません' }]);
  });

  it('[REQ-011][REQ-077][REQ-078] 合意の列のない古い trace.md もエラーなく読め、4 つの値は空', () => {
    const { value, errors } = parseTrace('trace.md', trace);
    expect(errors).toEqual([]);
    expect(value.questions[0]).toMatchObject({ 回答者: '', 回答日: '' });
    expect(value.assumptions[0]).toMatchObject({ 承認者: '', 承認日: '' });
  });
});

describe('createTraceTemplate', () => {
  it('[REQ-017] 生成したテンプレートはエラーなく読め、3 つの表が空', () => {
    const text = createTraceTemplate({ changeId: 'add-x' });
    expect(text).toMatch(/^# Trace: add-x\n/);
    expect(parseTrace('trace.md', text)).toEqual({ value: { ledger: [], questions: [], assumptions: [] }, errors: [] });
  });

  it('[REQ-017][REQ-077][REQ-078] テンプレートと kit の trace.md の雛形は、確認事項に回答者・回答日、仮定に承認者・承認日の列を末尾に持つ', () => {
    const kit = readFileSync(join(import.meta.dirname, '../../kit/templates/skills/req-to-openspec/templates/trace.md'), 'utf8');
    for (const text of [createTraceTemplate({ changeId: 'add-x' }), kit]) {
      expect(text).toMatch(/^\| ID \| 関連 \| 質問 \| .* \| 回答 \| 回答者 \| 回答日 \|$/m);
      expect(text).toMatch(/^\| ID \| 関連 \| 仮定の内容 \| .* \| 承認 \| 承認者 \| 承認日 \|$/m);
    }
  });
});
