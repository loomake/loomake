import { describe, expect, it } from 'vitest';
import { decideAfterEngine, decideAfterGate, decideAfterChanges, type EngineObservation, type GateObservation } from '../src/run/decision-policy.js';

const engine: EngineObservation = { aborted: false, timedOut: false, text: '正常な出力', exitCode: 0 };
const gate: GateObservation = { stateChanged: false, ok: false, timedOut: false, fixes: 0, maxFixes: 2 };
const stopped = (reason: string, status: 'stopped' | 'interrupted' = 'stopped') => ({ kind: 'stop', status, reason });

// 優先順位が重なる場合も、公開されている停止の意味を保つ。
describe('エンジンの観測値から次の段階を決める', () => {
  it.each([
    ['正常終了', {}, { kind: 'continue' }],
    ['中断がすべてに優先', { aborted: true, outputLimitExceeded: true, timedOut: true, text: 'LOOMAKE-QUESTION: 質問', exitCode: 1 }, stopped('中断されました', 'interrupted')],
    ['出力上限が期限に優先', { outputLimitExceeded: true, timedOut: true, exitCode: 1 }, stopped('エンジンの出力が上限に達しました')],
    ['期限が質問に優先', { timedOut: true, text: 'LOOMAKE-QUESTION: 質問', exitCode: 1 }, stopped('実行時間の上限に達しました')],
    ['質問が終了コードに優先', { text: '前置き\nLOOMAKE-QUESTION: 要件を確認\n後続', exitCode: 1 }, stopped('エンジンが質問しました：要件を確認')],
    ['最初の質問を使う', { text: 'LOOMAKE-QUESTION: 最初\nLOOMAKE-QUESTION: 次' }, stopped('エンジンが質問しました：最初')],
    ['行頭でない印は質問にしない', { text: '引用 LOOMAKE-QUESTION: 例' }, { kind: 'continue' }],
    ['非ゼロ終了', { exitCode: 3 }, stopped('エンジンが終了コード 3 で終わりました')],
    ['不明な終了コード', { exitCode: null }, stopped('エンジンが終了コード （なし） で終わりました')],
    ['HEAD変更だけでも停止', { movementReason: 'HEAD変更' }, stopped('HEAD変更')],
    ['Git内部変更だけでも停止', { internalsReason: 'フック変更' }, stopped('フック変更')],
    ['HEAD変更を内部変更より先にする', { movementReason: 'HEAD変更', internalsReason: 'フック変更', exitCode: 1 }, stopped('HEAD変更。エンジンが終了コード 1 で終わりました')],
    ['HEAD変更でも中断状態を保つ', { movementReason: 'HEAD変更', aborted: true }, stopped('HEAD変更。中断されました', 'interrupted')],
    ['Git内部変更でも中断状態を保つ', { internalsReason: 'フック変更', aborted: true }, stopped('フック変更。中断されました', 'interrupted')],
  ] as const)('[REQ-204] %s', (_name, patch, expected) => {
    expect(decideAfterEngine(Object.freeze({ ...engine, ...patch }))).toEqual(expected);
  });
});

describe('完了ゲートの観測値から次の段階を決める', () => {
  it.each([
    ['上限の直前は修正', { fixes: 1 }, { kind: 'repair' }],
    ['上限と一致したら停止', { fixes: 2 }, { kind: 'stop', reason: '直しの回数の上限（2 回）に達しました' }],
    ['上限超過でも停止', { fixes: 3 }, { kind: 'stop', reason: '直しの回数の上限（2 回）に達しました' }],
    ['上限0では修正しない', { maxFixes: 0 }, { kind: 'stop', reason: '直しの回数の上限（0 回）に達しました' }],
    ['期限は回数より優先', { timedOut: true, fixes: 2 }, { kind: 'stop', reason: '実行時間の上限に達しました' }],
    ['状態変更は合格より優先', { stateChanged: true, ok: true }, { kind: 'stop', reason: '検証のあいだにHEADかブランチが変わりました。変更を取り消していません。Gitの状態を確認してから、もう一度実行してください。' }],
    ['状態変更は期限より優先', { stateChanged: true, timedOut: true }, { kind: 'stop', reason: '検証のあいだにHEADかブランチが変わりました。変更を取り消していません。Gitの状態を確認してから、もう一度実行してください。' }],
    ['通常の合格', { ok: true }, { kind: 'passed' }],
    ['合格は回数と期限の記録より優先', { ok: true, fixes: 2, timedOut: true }, { kind: 'passed' }],
  ] as const)('[REQ-205] %s', (_name, patch, expected) => {
    expect(decideAfterGate(Object.freeze({ ...gate, ...patch }))).toEqual(expected);
  });
});

it('[REQ-206] 観測値を変えず同じ判断を繰り返し返す', () => {
  const engineInput = Object.freeze({ ...engine, movementReason: 'HEAD変更', aborted: true });
  const gateInput = Object.freeze({ ...gate, fixes: 2 });
  const before = JSON.stringify([engineInput, gateInput]);
  const first = [decideAfterEngine(engineInput), decideAfterGate(gateInput)];
  expect([decideAfterEngine(engineInput), decideAfterGate(gateInput)]).toEqual(first);
  expect(JSON.stringify([engineInput, gateInput])).toBe(before);
});

it.each([
  ['不合格の中断は期限と回数より優先する', { ok: false, timedOut: true, fixes: 2 }, { kind: 'interrupted', reason: '中断されました' }],
  ['検証中の状態変更を中断より先に確認する', { stateChanged: true }, { kind: 'stop', reason: '検証のあいだにHEADかブランチが変わりました。変更を取り消していません。Gitの状態を確認してから、もう一度実行してください。' }],
  ['状態が変わらない合格は中断の記録より優先する', { ok: true }, { kind: 'passed' }],
] as const)('[REQ-205][REQ-124] %s', (_name, patch, expected) => {
  expect(decideAfterGate(Object.freeze({ ...gate, interrupted: true, ...patch }))).toEqual(expected);
});


describe('エンジンの変更の有無から次の段階を決める', () => {
  it.each([
    ['タスクで変更あり', 'task', true, '', { kind: 'commit' }],
    ['直しで変更あり', 'repair', true, 'LOOMAKE-NOCHANGE: 理由', { kind: 'commit' }],
    ['変更なし・合図なし', 'task', false, '正常終了', { kind: 'stop' }],
    ['合図と理由あり', 'task', false, '前置き\nLOOMAKE-NOCHANGE: 既に実装済み', { kind: 'no-change', reason: '既に実装済み' }],
    ['行頭でない合図', 'task', false, '引用 LOOMAKE-NOCHANGE: 例', { kind: 'stop' }],
    ['空の理由', 'task', false, 'LOOMAKE-NOCHANGE: \t\n次の行', { kind: 'stop' }],
    ['最初の合図', 'task', false, 'LOOMAKE-NOCHANGE: 最初\nLOOMAKE-NOCHANGE: 次', { kind: 'no-change', reason: '最初' }],
    ['直しでは合図があっても停止', 'repair', false, 'LOOMAKE-NOCHANGE: 変更不要', { kind: 'stop' }],
    ['freezeした入力を変更しない', 'task', false, 'LOOMAKE-NOCHANGE: 確認済み', { kind: 'no-change', reason: '確認済み' }],
  ] as const)('[REQ-332] %s', (_name, phase, hasChanges, text, expected) => {
    const input = Object.freeze({ phase, hasChanges, text });
    const before = JSON.stringify(input);
    expect(decideAfterChanges(input)).toEqual(expected);
    expect(decideAfterChanges(input)).toEqual(expected);
    expect(JSON.stringify(input)).toBe(before);
  });
});
