import { describe, expect, it } from 'vitest';
import { createObservedResultFixture, matchesResultCase, resultSignals, validateResultFixture } from '../../../scripts/claude-result-fixture.mjs';
import { classifyEngineResult } from '../src/run/decision-policy.js';

// Synthetic controls exercise the storage schema; these are not captured CLI observations.
const metadata = () => ({
  cli: { version: '2.1.308', nativeSha256: '0'.repeat(64) }, case: 'success', attempt: 1,
  exit: { code: 0, signal: null, timedOut: false, stdoutLimitHit: false }, stderrBytes: 0,
});
const control = (value: unknown) => createObservedResultFixture(JSON.stringify(value), metadata())!;
const fixture = () => control({ type: 'result', subtype: 'success', is_error: false, result: 'OK' });
const classifiedSignals = (raw: string) => {
  const fault = classifyEngineResult(raw);
  return { kind: fault?.kind ?? 'normal', displayable: fault?.kind === 'failure' && Boolean(fault.subtype) };
};

describe('合成入力による保存許可集合と出所の検査', () => {
  it('[REQ-341] 閉じたliteralだけをprojectionにし存在と型を保つ', () => {
    const record = fixture();
    expect(record.provenance).toBe('observed-projection');
    expect(record.input).toEqual({ type: 'result', subtype: 'success', is_error: false, result: 'OK' });
    expect(record.fields).toEqual({
      type: { present: true, jsonType: 'string' }, subtype: { present: true, jsonType: 'string' },
      is_error: { present: true, jsonType: 'boolean' }, result: { present: true, jsonType: 'string' },
    });
    expect(validateResultFixture(record)).toBe(true);
    expect(matchesResultCase(record)).toBe(true);
  });

  it.each([
    { type: 'private_marker', subtype: 'success', is_error: false, result: 'private_marker' },
    { subtype: 'error_private_marker', is_error: 'private_marker', result: 42 },
    { subtype: 'error_private_marker-' + 'a'.repeat(65), is_error: 123456, result: { value: 'private_marker' } },
    { type: [], subtype: true, is_error: [], result: false },
    { type: 42, subtype: [], is_error: {}, result: ['private_marker'] },
    { type: false, subtype: 42, is_error: null, result: null },
    { type: {}, subtype: null, is_error: true },
    { subtype: 'error_', result: '' },
  ])('[REQ-340][REQ-341] 許可外値を元rawから同型固定値へ置換し合図を保つ %j', (source) => {
    const record = control(source);
    expect(record.provenance).toBe('derived');
    expect(JSON.stringify(record)).not.toContain('private_marker');
    expect(resultSignals(record.input)).toEqual(resultSignals(source));
    expect(classifiedSignals(JSON.stringify(record.input))).toEqual(classifiedSignals(JSON.stringify(source)));
    expect(validateResultFixture(record)).toBe(true);
    expect(record.substitutions.length).toBeGreaterThan(0);
  });

  it.each(['type', 'subtype', 'is_error', 'result'].flatMap((field) =>
    ['private_marker', 42, true, false, {}, [], null].map((value) => ({ field, value }))))('[REQ-341] 全4欄と全JSON型で存在・型・分類の合図を保つ %j', ({ field, value }) => {
    const source = { type: 'result', subtype: 'success', is_error: false, result: 'OK', [field]: value };
    const record = control(source);
    expect(validateResultFixture(record)).toBe(true);
    expect(resultSignals(record.input)).toEqual(resultSignals(source));
    expect(classifiedSignals(JSON.stringify(record.input))).toEqual(classifiedSignals(JSON.stringify(source)));
    expect(JSON.stringify(record)).not.toContain('private_marker');
  });

  it.each([null, true, 42, 'private_marker', ['private_marker']])('[REQ-341] 最上位object以外は値を持たないmetarecordにする %j', (source) => {
    const record = control(source);
    expect(record.provenance).toBe('observed-metarecord');
    expect(record).not.toHaveProperty('input');
    expect(record).not.toHaveProperty('fields');
    expect(record).not.toHaveProperty('substitutions');
    expect(JSON.stringify(record)).not.toContain('private_marker');
    expect(validateResultFixture(record)).toBe(true);
    expect(matchesResultCase(record)).toBe(false);
  });

  it('[REQ-341] JSON解析例外は固定のmetarecordへ変え本文やmessageを保存しない', () => {
    const record = createObservedResultFixture('invalid-json-private_marker', metadata())!;
    expect(record.topLevel).toBe('invalid-json');
    expect(record.provenance).toBe('observed-metarecord');
    expect(JSON.stringify(record)).not.toContain('private_marker');
    expect(record).not.toHaveProperty('message');
    expect(validateResultFixture(record)).toBe(true);
  });

  it('[REQ-341] 欠落を補わず未知欄を投影せず数値resultとnullを区別する', () => {
    const projected = control({ result: null, unknown: 'private_marker' });
    expect(projected.provenance).toBe('observed-projection');
    expect(projected.input).toEqual({ result: null });
    expect(projected.fields.type).toEqual({ present: false });
    const derived = control({ result: 42 });
    expect(derived.provenance).toBe('derived');
    expect(derived.input).toEqual({ result: 0 });
    expect(derived.substitutions).toEqual([{ field: 'result', jsonType: 'number' }]);
  });

  it('[REQ-341] 合成入力に実行metadataを付けず実caseの成立へ数えない', () => {
    const record = { schemaVersion: 1, provenance: 'synthetic', input: { result: 'constructed from metadata' } };
    expect(validateResultFixture(record)).toBe(true);
    expect(matchesResultCase(record)).toBe(false);
    expect(validateResultFixture({ ...record, cli: metadata().cli })).toBe(false);
    expect(validateResultFixture({ ...record, case: 'success' })).toBe(false);
  });

  it.each([
    ['type文字列', (r: ReturnType<typeof fixture>) => { r.input.type = 'private_marker'; }],
    ['subtype文字列', (r: ReturnType<typeof fixture>) => { r.input.subtype = 'error_private_marker'; }],
    ['is_error数値', (r: ReturnType<typeof fixture>) => { r.input.is_error = 123456; }],
    ['result文字列', (r: ReturnType<typeof fixture>) => { r.input.result = 'private_marker'; }],
    ['result数値', (r: ReturnType<typeof fixture>) => { r.input.result = 42; }],
    ['存在不一致', (r: ReturnType<typeof fixture>) => { r.fields.result.present = false; }],
    ['型不一致', (r: ReturnType<typeof fixture>) => { r.fields.result.jsonType = 'null'; }],
    ['版', (r: ReturnType<typeof fixture>) => { r.cli.version = 'unobserved'; }],
    ['case', (r: ReturnType<typeof fixture>) => { r.case = 'other'; }],
    ['attempt', (r: ReturnType<typeof fixture>) => { r.attempt = 3; }],
  ] as const)('[REQ-341] schemaとcross-field条件で不正な保存を拒否する %s', (_name, modify) => {
    const record = fixture(); modify(record);
    expect(validateResultFixture(record)).toBe(false);
  });

  it.each(['raw', 'body', 'message', 'privateRawSha256', 'session_id', 'length', 'num_turns', 'permission_denials'])('[REQ-341] 保存を許さない追加欄を拒否する %s', (key) => {
    expect(validateResultFixture({ ...fixture(), [key]: 'private_marker' })).toBe(false);
    expect(validateResultFixture({ ...fixture(), input: { ...fixture().input, [key]: 'private_marker' } })).toBe(false);
    expect(validateResultFixture({ ...fixture(), cli: { ...metadata().cli, [key]: 'private_marker' } })).toBe(false);
  });

  it('[REQ-341] derivedの固定値と置換欄・型・重複を厳密に対応させる', () => {
    const record = control({ result: 42 });
    expect(validateResultFixture({ ...record, input: { result: 42 } })).toBe(false);
    expect(validateResultFixture({ ...record, substitutions: [] })).toBe(false);
    expect(validateResultFixture({ ...record, substitutions: [{ field: 'result', jsonType: 'string' }] })).toBe(false);
    expect(validateResultFixture({ ...record, substitutions: [{ field: 'result', jsonType: 'number' }, { field: 'result', jsonType: 'number' }] })).toBe(false);
    expect(validateResultFixture({ ...fixture(), provenance: 'derived', substitutions: [] })).toBe(false);
  });

  it('[REQ-341] metarecordへinputを付けて観測入力へ読み替えることを拒否する', () => {
    const record = control(null);
    expect(validateResultFixture({ ...record, input: {} })).toBe(false);
    expect(validateResultFixture({ ...record, fields: {} })).toBe(false);
  });

  it('[REQ-341] schema合格だけで失敗した実行や不一致caseを収集成立へ読み替えない', () => {
    const valid = fixture();
    for (const changed of [
      { ...valid, case: 'error_max_turns' },
      { ...valid, exit: { ...valid.exit, code: 1 } },
      { ...valid, exit: { ...valid.exit, signal: 'SIGTERM' } },
      { ...valid, exit: { ...valid.exit, timedOut: true } },
      { ...valid, exit: { ...valid.exit, stdoutLimitHit: true } },
      control({ subtype: 'success', is_error: false, result: null }),
    ]) {
      expect(validateResultFixture(changed)).toBe(true);
      expect(matchesResultCase(changed)).toBe(false);
    }
  });
});
