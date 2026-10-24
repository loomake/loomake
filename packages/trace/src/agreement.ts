import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTraceCells, type EditableTable } from '@loomake/core';
import { UsageError, assertChangeId, createInputReader, loadConfig } from '@loomake/kit';

export type AgreementOptions = {
  root: string;
  changeId: string;
  /** answer は確認事項の回答、approve は仮定の承認 */
  kind: 'answer' | 'approve';
  /** Q-01・A-01 などの行の ID */
  id: string;
  /** kind が answer のときの回答 */
  answer?: string;
  /** 回答者か承認者 */
  by?: string;
  /** YYYY-MM-DD。省くと now の日付 */
  date?: string;
  now?: () => Date;
  stdout: (text: string) => void;
};

// 回答と承認で書く列（REQ-202・REQ-203）
const KINDS = {
  answer: { table: 'questions', value: '回答', person: '回答者', day: '回答日', label: '回答' },
  approve: { table: 'assumptions', value: '承認', person: '承認者', day: '承認日', label: '承認' },
} as const satisfies Record<string, { table: EditableTable; value: string; person: string; day: string; label: string }>;

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function assertDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new UsageError(`日付は YYYY-MM-DD の形の、実在する日にしてください：${date}`);
  }
}

/**
 * change の trace.md に、確認事項の回答か仮定の承認を書く（REQ-202・REQ-203）。終了コード（書いた 0）を返す。
 * すでに値がある行や、ない ID は、ファイルを変えずに UsageError を投げる
 */
export function runAgreement(options: AgreementOptions): number {
  const { changeId, kind, id, stdout } = options;
  const spec = KINDS[kind];
  assertChangeId(changeId);
  const by = options.by?.trim();
  if (!by) throw new UsageError(`--by で${spec.person}を指定してください`);
  const answer = kind === 'answer' ? options.answer?.trim() : '承認';
  if (!answer) throw new UsageError('--answer で回答を指定してください');
  const date = options.date ?? localDate((options.now ?? (() => new Date()))());
  assertDate(date);

  const root = resolve(options.root);
  const config = loadConfig(root);
  const path = join(root, config.openspecDir, 'changes', changeId, 'trace.md');
  if (!existsSync(path)) throw new UsageError(`${config.openspecDir}/changes/${changeId}/trace.md がありません`);
  const result = setTraceCells(createInputReader().read(path), spec.table, id, { [spec.value]: answer, [spec.person]: by, [spec.day]: date });
  if (result.error !== undefined || result.text === undefined) throw new UsageError(result.error ?? 'trace.md を書き換えられません');
  writeFileSync(path, result.text);

  stdout(`trace.md の ${id} に${spec.label}を書きました：${answer}（${by}、${date}）`);
  if (result.missingColumns.length) {
    stdout(`表に${result.missingColumns.join('・')}の列がないので、${spec.label}だけを書きました。列を足すと、検収レポートに${spec.person}と日付が載ります。`);
  }
  stdout(`loomake verify --change ${changeId} --spec-only で確かめてください。`);
  return 0;
}
