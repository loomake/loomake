// tasks.md のタスクの見分け方（完了ゲートの印）と、完了の印の付け方
import { writeFileSync } from 'node:fs';
import { type Task } from '@loomake/core';
import { createInputReader } from '@loomake/kit';


/** 完了ゲートのタスクの印（REQ-100・REQ-136）。行のどこにあってもよい */
export const GATE_MARK = '<!-- loomake:gate=done -->';
const GATE_MARK_RE = /\s*<!--\s*loomake:gate=done\s*-->\s*/g;
// エンジンへの指示・コミットのメッセージ・記録には、印を除いた文を使う
export const taskLabel = (t: Task) => t.text.replace(GATE_MARK_RE, ' ').trim();
const hasGateMark = (t: Task) => new RegExp(GATE_MARK_RE.source).test(t.text);
// 印のない旧書式：本文に verify と --done を含むタスク
export const isLegacyGateTask = (t: Task) => !hasGateMark(t) && /verify/.test(t.text) && /--done/.test(t.text);
// 完了ゲートを通すタスクはエンジンに渡さず、合格したときに run が完了にする
export const isGateTask = (t: Task) => hasGateMark(t) || isLegacyGateTask(t);

/** tasks.md の指定した行のタスクを完了にする */
export function checkTask(tasksPath: string, line: number) {
  const lines = createInputReader().read(tasksPath).split('\n');
  lines[line - 1] = lines[line - 1].replace(/([-*+]) \[ \]/, '$1 [x]');
  writeFileSync(tasksPath, lines.join('\n'));
}
