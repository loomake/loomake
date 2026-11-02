import type { AssumptionRow, QuestionRow } from '@loomake/core';

const QUESTION_CELLS = ['ID', '関連', '質問', '選択肢', 'おすすめ', 'ブロッキング', '回答', '回答者', '回答日'] as const satisfies readonly (keyof QuestionRow)[];
const ASSUMPTION_CELLS = ['ID', '関連', '仮定の内容', '理由', '承認', '承認者', '承認日'] as const satisfies readonly (keyof AssumptionRow)[];
type QuestionCell = (typeof QUESTION_CELLS)[number];
type AssumptionCell = (typeof ASSUMPTION_CELLS)[number];
type RecordedCells<C extends string> = { line: number; cells: Readonly<Record<C, string>>; decision: string; actorLabel: string; date: string };
export type ParsedTraceDecisionRow = Readonly<
  | ({ table: 'questions' } & RecordedCells<QuestionCell>)
  | ({ table: 'assumptions' } & RecordedCells<AssumptionCell>)>;

/** Parsed model only. Document provenance, actors, APIs and concrete approvals remain unverified. */
export function findParsedTraceDecision(
  trace: Readonly<{ questions: readonly QuestionRow[]; assumptions: readonly AssumptionRow[] }>, id: string,
): { row: ParsedTraceDecisionRow | null; adoptionsVerified: false; problems: string[] } {
  const rejected = (problem: string) => ({ row: null, adoptionsVerified: false as const, problems: [problem] });
  if (!id.trim()) return rejected('採否記録のIDが空です');
  const questions = trace.questions.filter(row => row.ID === id), assumptions = trace.assumptions.filter(row => row.ID === id);
  if (questions.length + assumptions.length === 0) return rejected(`確認事項・仮定にID「${id}」の行がありません`);
  if (questions.length + assumptions.length !== 1) return rejected(`ID「${id}」の行が確認事項${questions.length}件・仮定${assumptions.length}件あります`);
  const table = questions.length ? 'questions' : 'assumptions';
  const source = questions[0] ?? assumptions[0];
  const [decision, actor, date] = table === 'questions' ? ['回答', '回答者', '回答日'] : ['承認', '承認者', '承認日'];
  if (!source[decision]) return rejected(table === 'questions' ? `確認事項「${id}」の回答が空です` : `仮定「${id}」の承認が空です`);
  const columns = table === 'questions' ? QUESTION_CELLS : ASSUMPTION_CELLS;
  const cells = Object.freeze(Object.fromEntries(columns.map(key => [key, source[key]])));
  const row = Object.freeze({ table, line: source.line, cells, decision: cells[decision], actorLabel: cells[actor], date: cells[date] }) as ParsedTraceDecisionRow;
  return { row, adoptionsVerified: false, problems: [] };
}
