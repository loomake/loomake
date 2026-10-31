import { describe, expect, it } from 'vitest';
import { classifyEngineResult, decideAfterEngine, decideAfterGuard, resultFaultReason } from '../src/run/decision-policy.js';

const shape = { kind: 'shape' };
const failure = { kind: 'failure', subtype: 'error_max_turns' };

describe('エンジンの元のJSON結果を分類する', () => {
  it.each([
    { subtype: 'error_max_turns', is_error: 'true' },
    { subtype: 'error_max_turns', is_error: 1 },
    { subtype: 'error_max_turns', is_error: null },
    { type: 1, subtype: 'error_max_turns', result: 42 },
    { is_error: true, result: 42 },
  ])('[REQ-341] 失敗の合図をmetadataやresultの型不正より先に見る %j', (value) => {
    expect(classifyEngineResult(JSON.stringify(value))).toEqual(value.subtype === 'error_max_turns' ? failure : { kind: 'failure' });
  });

  it.each([
    '', 'not-json-MARKER', '{} {}', '[]', 'null', '3', '"text"', 'true',
    '{}', '{"type":1,"result":"x"}', '{"type":null,"result":"x"}',
    '{"subtype":1,"result":"x"}', '{"is_error":"false","result":"x"}',
    '{"is_error":null,"result":"x"}', '{"result":42}',
  ])('[REQ-341] JSONの形や既知欄の型不正を拒否する %s', (raw) => {
    expect(classifyEngineResult(raw)).toEqual(shape);
  });

  it.each([
    '{"result":"x"}', '{"type":"assistant","result":"x"}',
    '{"subtype":"success_partial","result":""}',
    '{"result":"x","unknown":7}', '{"result":"x","unknown":null}',
    '{"result":"x","unknown":{"is_error":true}}', '{"result":"x"}\n',
    '{"__proto__":{"is_error":true},"result":"x"}',
  ])('[REQ-341] 最小の結果と未知の値を正常として受け入れる %s', (raw) => {
    expect(classifyEngineResult(raw)).toBeUndefined();
  });

  it.each(['error_' + 'a'.repeat(65), 'error_', 'error_Max', 'error_a-b', 'error_a\n', 'success'])('[REQ-341] 許可範囲外subtypeは失敗の理由に出さない %j', (subtype) => {
    expect(classifyEngineResult(JSON.stringify({ is_error: true, subtype }))).toEqual({ kind: 'failure' });
  });

  it('[REQ-341] suffix64字の境界までsubtypeを表示する', () => {
    const subtype = 'error_' + 'a'.repeat(64);
    expect(classifyEngineResult(JSON.stringify({ subtype }))).toEqual({ kind: 'failure', subtype });
    expect(resultFaultReason({ kind: 'failure', subtype }, '/runs/01-output.json')).toContain(subtype);
  });

  it.each([
    JSON.stringify({ is_error: true, subtype: 'error_MARKER', result: 'BODY_MARKER', unknown: 'BODY_MARKER' }),
    'not-json-BODY_MARKER',
  ])('[REQ-340][REQ-341] result・未知欄・解析例外の本文を理由へ含めない %s', (raw) => {
    const fault = classifyEngineResult(raw)!;
    const reason = resultFaultReason(fault, '/runs/01-output.json');
    expect(reason).not.toContain('MARKER');
    expect(reason).toContain('/runs/01-output.json');
    expect(reason).toContain(fault.kind === 'failure' ? '失敗' : '読めません');
  });
});

const engine = { aborted: false, timedOut: false, text: '通常の出力', exitCode: 0 };
const faultInput = { fault: { kind: 'failure' as const, subtype: 'error_max_turns' }, outputPath: '/runs/01-output.json' };

describe('結果の異常と既存の停止条件を両立する', () => {
  it('[REQ-204] 結果の異常だけなら既存guardを待つholdを返す', () => {
    expect(decideAfterEngine({ ...engine, resultFault: faultInput })).toEqual({
      kind: 'hold', reason: 'エンジンが失敗の結果を返しました（subtype：error_max_turns）。出力の記録：/runs/01-output.json',
    });
  });

  it.each([
    { aborted: true }, { outputLimitExceeded: true }, { timedOut: true },
    { text: 'LOOMAKE-QUESTION: 仕様を確認してください' }, { exitCode: 1 }, { exitCode: null },
    { aborted: true, movementReason: 'HEAD変更', internalsReason: 'Git内部変更' },
    { exitCode: 1, internalsReason: 'Git内部変更' },
  ])('[REQ-204] 先行停止に結果の異常の理由を追加しない %j', (patch) => {
    const previous = decideAfterEngine({ ...engine, ...patch });
    expect(decideAfterEngine({ ...engine, ...patch, resultFault: faultInput })).toEqual(previous);
    expect(previous.kind).toBe('stop');
    if (previous.kind === 'stop') expect(previous.reason).not.toContain('error_max_turns');
  });

  it.each([
    [{ movementReason: 'HEAD変更', internalsReason: 'Git内部変更' }, 'HEAD変更'],
    [{ internalsReason: 'Git内部変更' }, 'Git内部変更'],
  ] as const)('[REQ-204] Git変更理由を結果の異常より先にする %j', (patch, reason) => {
    expect(decideAfterEngine({ ...engine, ...patch, resultFault: faultInput })).toEqual({
      kind: 'stop', status: 'stopped',
      reason: reason + '。エンジンが失敗の結果を返しました（subtype：error_max_turns）。出力の記録：/runs/01-output.json',
    });
  });

  it.each([
    [{ resultReason: '結果の異常', violationReason: '不正な直し方' }, { kind: 'stop', reason: '結果の異常。不正な直し方' }],
    [{ resultReason: '結果の異常' }, { kind: 'stop', reason: '結果の異常' }],
    [{ violationReason: '不正な直し方' }, { kind: 'stop', reason: '不正な直し方' }],
    [{}, { kind: 'continue' }],
  ] as const)('[REQ-341] guard後は結果の異常から順に理由を示す %j', (input, expected) => {
    expect(decideAfterGuard(Object.freeze(input))).toEqual(expected);
  });

  it('[REQ-206][REQ-341] faultを持つ観測もguard観測も変更せず同じ判断を返す', () => {
    const observed = Object.freeze({ ...engine, resultFault: Object.freeze({ ...faultInput, fault: Object.freeze(faultInput.fault) }) });
    const guarded = Object.freeze({ resultReason: '結果の異常', violationReason: '不正な直し方' });
    const before = JSON.stringify([observed, guarded]);
    const first = [decideAfterEngine(observed), decideAfterGuard(guarded)];
    expect([decideAfterEngine(observed), decideAfterGuard(guarded)]).toEqual(first);
    expect(JSON.stringify([observed, guarded])).toBe(before);
  });
});
