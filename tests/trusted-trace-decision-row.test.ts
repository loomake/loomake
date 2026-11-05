import { describe, expect, it } from 'vitest';
import { createAgreement, parseTrace } from '../packages/core/src/index.js';
import { findParsedTraceDecision } from '../packages/kit/src/verify/trusted/trace-decision-row.js';

const question = (id: string, answer = 'A', actor = '記録ラベル', date = '2026/13/40', blocking = 'yes') => [id, 'REQ-390', '質問', 'A/B', 'A', blocking, answer, actor, date].join(' | ');
const assumption = (id: string, approval = '否認', actor = '記録ラベル', date = '日付原文') => [id, 'REQ-390', '仮定', '理由', approval, actor, date].join(' | ');
function model(questions: string[] = [], assumptions: string[] = [], legacy = false) {
  const table = (heading: string, columns: string[], rows: string[]) => [`## ${heading}`, `| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.split(' | ').slice(0, columns.length).join(' | ')} |`)];
  const q = ['ID', '関連', '質問', '選択肢', 'おすすめ', 'ブロッキング', '回答', '回答者', '回答日'];
  const a = ['ID', '関連', '仮定の内容', '理由', '承認', '承認者', '承認日'];
  const parsed = parseTrace('synthetic-trace.md', [...table('要件台帳', ['ID', '出典', '種別', '要約（原文に忠実に）', '状態', '反映先'], []), ...table('確認事項', legacy ? q.slice(0, 7) : q, questions), ...table('仮定', legacy ? a.slice(0, 5) : a, assumptions)].join('\n'));
  expect(parsed.errors).toEqual([]);
  return parsed.value;
}
describe('合成モデルの行照合（実C001の採否成功ではない）', () => {
  it('[REQ-390] T-ROW-01 唯一の質問と仮定を全記録値のまま返す', () => {
    const m = model([question('Q-[a]+.x')], [assumption('A-01')]);
    for (const table of ['questions', 'assumptions'] as const) {
      const source = m[table][0], cells = Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'line'));
      expect(findParsedTraceDecision(m, source.ID)).toEqual({ row: { table, line: source.line, cells, decision: table === 'questions' ? 'A' : '否認', actorLabel: '記録ラベル', date: table === 'questions' ? '2026/13/40' : '日付原文' }, adoptionsVerified: false, problems: [] });
    }
  });
  it('[REQ-390] T-ROW-02 空白・大小・前方・部分・Unicode正規化だけ合うIDは一致にしない', () => {
    for (const id of [' Q-01', 'Q-01 ', 'q-01', 'Q-0', 'Q-010', 'Q-01-x', '01']) {
      expect(findParsedTraceDecision(model([question('Q-01')]), id)).toEqual({ row: null, adoptionsVerified: false, problems: [`確認事項・仮定にID「${id}」の行がありません`] });
    }
    expect(findParsedTraceDecision(model([question('é')]), 'e\u0301').row).toBeNull();
  });
  it('[REQ-390] T-ROW-03 同表・表間の重複を空欄判定より先に件数付きで拒否する', () => {
    for (const [qs, as] of [[2, 0], [0, 2], [1, 1]]) {
      const m = model();
      m.questions = Array.from({ length: qs }, () => ({ ...model([question('dup', '')]).questions[0] }));
      m.assumptions = Array.from({ length: as }, () => ({ ...model([], [assumption('dup', '')]).assumptions[0] }));
      expect(findParsedTraceDecision(m, 'dup')).toEqual({ row: null, adoptionsVerified: false, problems: [`ID「dup」の行が確認事項${qs}件・仮定${as}件あります`] });
    }
  });
  it('[REQ-390] T-ROW-04 空の回答・承認をブロッキングによらず拒否する', () => {
    for (const blocking of ['yes', 'no']) {
      const m = model([question('Q', '', '', '', blocking)], [assumption('A', '')]);
      const agreement = createAgreement('synthetic-trace.md', m).value;
      expect(Boolean(agreement.questions[0].answer)).toBe(false);
      expect(Boolean(agreement.assumptions[0].approval)).toBe(false);
      expect(findParsedTraceDecision(m, 'Q')).toEqual({ row: null, adoptionsVerified: false, problems: ['確認事項「Q」の回答が空です'] });
      expect(findParsedTraceDecision(m, 'A')).toEqual({ row: null, adoptionsVerified: false, problems: ['仮定「A」の承認が空です'] });
    }
  });
  it('[REQ-390] T-ROW-05 省略列・空ラベル・非標準日付・否認を解釈しない', () => {
    const old = model([question('Q')], [assumption('A')], true);
    for (const id of ['Q', 'A']) expect(findParsedTraceDecision(old, id)).toMatchObject({ row: { actorLabel: '', date: '' }, adoptionsVerified: false, problems: [] });
    const m = model([question('Q', 'A', '', '2026/13/40')], [assumption('A', '否認', '', '日付原文')]);
    expect(findParsedTraceDecision(m, 'Q')).toMatchObject({ row: { decision: 'A', actorLabel: '', date: '2026/13/40' }, adoptionsVerified: false });
    expect(findParsedTraceDecision(m, 'A')).toMatchObject({ row: { decision: '否認', actorLabel: '', date: '日付原文' }, adoptionsVerified: false });
    m.questions[0]['回答'] = ' ';
    expect(createAgreement('synthetic-trace.md', m).value.questions[0].answer).toBe(' ');
    expect(findParsedTraceDecision(m, 'Q')).toMatchObject({ row: { decision: ' ' }, adoptionsVerified: false, problems: [] });
  });
  it('[REQ-390] T-ROW-06 入力を変えず全既知セルだけを凍結複製する', () => {
    for (const frozen of [false, true]) {
      const m = model([question('Q')], [assumption('A')]);
      const keys = Object.fromEntries((['questions', 'assumptions'] as const).map(t => [t, Object.keys(m[t][0]).filter(k => k !== 'line').sort()]));
      for (const t of ['questions', 'assumptions'] as const) Object.assign(m[t][0], { extra: 'コピーしない' });
      const before = structuredClone(m);
      if (frozen) {
        for (const t of ['questions', 'assumptions'] as const) { Object.freeze(m[t][0]); Object.freeze(m[t]); }
        Object.freeze(m);
      }
      for (const t of ['questions', 'assumptions'] as const) {
        const row = findParsedTraceDecision(m, m[t][0].ID).row;
        expect(row).not.toBeNull();
        if (!row) throw new Error('行がありません');
        expect(row).not.toBe(m[t][0]);
        expect(Object.keys(row.cells).sort()).toEqual(keys[t]);
        expect(Object.isFrozen(row)).toBe(true);
        expect(Object.isFrozen(row.cells)).toBe(true);
        expect(() => Object.assign(row.cells, { ID: '変更' })).toThrow(TypeError);
        expect(() => Object.assign(row, { decision: '変更' })).toThrow(TypeError);
      }
      expect(m).toEqual(before);
    }
  });
  it('[REQ-390] T-ROW-08 空・空白だけのIDは一致行があっても拒否する', () => {
    for (const id of ['', ' ', '\t\r\n']) {
      const m = model([question('Q')]); m.questions[0].ID = id;
      for (const trace of [m, model()]) expect(findParsedTraceDecision(trace, id)).toEqual({ row: null, adoptionsVerified: false, problems: ['採否記録のIDが空です'] });
    }
  });
});
