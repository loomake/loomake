import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createProcessAlive, createProcessIdentityRecorder } from '../scripts/process-alive.mjs';

const error = (code: string) => Object.assign(new Error(code), { code });
const psResult = (stdout: string | null, status: number | null = 0) => ({ stdout, status });

describe('SIGHUP smoke の生存確認', () => {
  it.each([0, 1])('ps が空（終了コード %s）のときは kill で消滅を再確認する', (status) => {
    const kill = vi.fn().mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw error('ESRCH'); });
    const alive = createProcessAlive({ platform: 'darwin', kill, ps: () => psResult('', status) });
    expect(alive(123)).toBe(false);
    expect(kill.mock.calls).toEqual([[123, 0], [123, 0]]);
  });

  it.each([0, 1])('ps が空でも再確認で存在する PID は生存のままにする（終了コード %s）', (status) => {
    const kill = vi.fn();
    const alive = createProcessAlive({ platform: 'darwin', kill, ps: () => psResult(' ', status) });
    expect(alive(123)).toBe(true);
    expect(kill.mock.calls).toEqual([[123, 0], [123, 0]]);
  });

  it('再確認の EPERM を停止とみなさない', () => {
    const kill = vi.fn().mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw error('EPERM'); });
    expect(() => createProcessAlive({ platform: 'darwin', kill, ps: () => psResult('') })(123)).toThrow('EPERM');
  });

  it('ps の起動失敗を停止とみなさない', () => {
    const failure = error('ENOENT');
    expect(() => createProcessAlive({ platform: 'darwin', kill: vi.fn(), ps: () => ({ ...psResult(null, null), error: failure }) })(123)).toThrow(failure);
  });

  it.each([null, undefined])('ps の利用できない出力 %s を停止とみなさない', (stdout) => {
    expect(() => createProcessAlive({ platform: 'darwin', kill: vi.fn(), ps: () => ({ stdout, status: 0 }) })(123)).toThrow();
  });

  it.each([1, 2, null])('ps の未知の終了状態 %s を停止とみなさない', (status) => {
    expect(() => createProcessAlive({ platform: 'darwin', kill: vi.fn(), ps: () => psResult('S', status) })(123)).toThrow();
  });

  it('kill の ESRCH だけを停止とする', () => {
    const ps = vi.fn();
    const alive = createProcessAlive({ platform: 'darwin', kill: () => { throw error('ESRCH'); }, ps });
    expect(alive(123)).toBe(false);
    expect(ps).not.toHaveBeenCalled();
  });

  it('kill の EPERM は試験を失敗させる', () => {
    expect(() => createProcessAlive({ platform: 'darwin', kill: () => { throw error('EPERM'); } })(123)).toThrow('EPERM');
  });

  it('macOS の zombie は実行中の子に数えない', () => {
    expect(createProcessAlive({ platform: 'darwin', kill: vi.fn(), ps: () => psResult(' Z+\n') })(123)).toBe(false);
  });

  it.each(['S', 'R+', 'U'])('macOS の状態 %s は生存として残す', (stat) => {
    expect(createProcessAlive({ platform: 'darwin', kill: vi.fn(), ps: () => psResult(stat) })(123)).toBe(true);
  });

  it('Linux で読み取り前に /proc が消えたときだけ停止にする', () => {
    expect(createProcessAlive({ platform: 'linux', kill: vi.fn(), readStat: () => { throw error('ENOENT'); } })(123)).toBe(false);
  });

  it.each(['EACCES', 'ESRCH'])('Linux の読み取りエラー %s を停止とみなさない', (code) => {
    expect(() => createProcessAlive({ platform: 'linux', kill: vi.fn(), readStat: () => { throw error(code); } })(123)).toThrow(code);
  });

  it.each([['Z', false], ['S', true]] as const)('Linux の状態 %s を確かめる', (state, expected) => {
    expect(createProcessAlive({ platform: 'linux', kill: vi.fn(), readStat: () => `123 (fixture) ${state} 1 123 123` })(123)).toBe(expected);
  });

  it('ps が空になる前後の確認を同じ PID の時刻付き記録に残す', () => {
    const entries: Record<string, unknown>[] = [];
    const kill = vi.fn().mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw error('ESRCH'); });
    const alive = createProcessAlive({ platform: 'darwin', kill, ps: () => psResult('', 1), onProbe: (entry) => entries.push(entry) });
    expect(alive(123)).toBe(false);
    expect(entries).toEqual([
      { time: expect.any(Number), pid: 123, source: 'kill', result: 'present' },
      { time: expect.any(Number), pid: 123, source: 'ps', status: 1, raw: '', code: undefined },
      { time: expect.any(Number), pid: 123, source: 'kill-recheck', result: 'missing', code: 'ESRCH' },
    ]);
  });

  it('存在しない ps 相当コマンドの実 spawnSync は error と利用できない出力を返す', () => {
    const result = spawnSync(`loomake-missing-ps-${process.pid}`, [], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
    expect(result.error).toMatchObject({ code: 'ENOENT' });
    expect([null, undefined]).toContain(result.stdout);
    expect(result.output).toBe(null);
    expect(result.status).toBe(null);
  });
});


describe('SIGHUP smoke の identity 記録', () => {
  it('macOS の両時点に lstart と command を残し、PID 再利用の差を比較できる', () => {
    let failed = false;
    const recorder = createProcessIdentityRecorder({ pids: () => [123, 456], platform: 'darwin', ps: () => psResult(failed ? '1 123 S Sun Nov  1 01:00:01 2026 replacement\n' : '1 123 S Sun Nov  1 01:00:00 2026 fixture\n') });
    recorder.capture('ready');
    failed = true;
    recorder.capture('failure');
    expect(recorder.identities).toHaveLength(4);
    expect(recorder.identities.map(({ pid, phase, lstart, command }) => ({ pid, phase, lstart, command }))).toEqual([
      { pid: 123, phase: 'ready', lstart: 'Sun Nov  1 01:00:00 2026', command: 'fixture' },
      { pid: 456, phase: 'ready', lstart: 'Sun Nov  1 01:00:00 2026', command: 'fixture' },
      { pid: 123, phase: 'failure', lstart: 'Sun Nov  1 01:00:01 2026', command: 'replacement' },
      { pid: 456, phase: 'failure', lstart: 'Sun Nov  1 01:00:01 2026', command: 'replacement' },
    ]);
  });

  it('2 PID・2時点を超えて採取せず、長い command と raw の省略を記録する', () => {
    let owned = [123, 456, 789];
    const recorder = createProcessIdentityRecorder({ pids: () => owned, platform: 'darwin', ps: () => psResult(`1 123 S Sun Nov  1 01:00:00 2026 ${'x'.repeat(5000)}`) });
    recorder.capture('ready');
    owned = [999];
    for (let i = 0; i < 20; i++) { recorder.capture('ready'); recorder.capture('failure'); }
    expect(recorder.identities.map(({ pid }) => pid)).toEqual([123, 456, 123, 456]);
    expect(recorder.identities.every((entry) => entry.command?.length === 4096 && entry.raw?.length === 4096 && entry.commandTruncated && entry.rawTruncated)).toBe(true);
  });

  it('失敗時の診断エラーは記録して返し、元の例外を上書きしない', () => {
    let failed = false;
    const recorder = createProcessIdentityRecorder({ pids: () => [123, 456], platform: 'darwin', ps: () => failed ? { ...psResult(null, 1), error: error('EACCES') } : psResult('1 123 S Sun Nov  1 01:00:00 2026 fixture') });
    recorder.capture('ready');
    failed = true;
    expect(() => recorder.capture('failure')).not.toThrow();
    expect(recorder.identities.slice(2)).toMatchObject([{ pid: 123, phase: 'failure', error: 'EACCES' }, { pid: 456, phase: 'failure', error: 'EACCES' }]);
  });

  it('Linux の両時点に開始tickとcommandを残す', () => {
    let failed = false;
    const recorder = createProcessIdentityRecorder({ pids: () => [123], platform: 'linux', readStat: () => `123 (${failed ? 'replacement' : 'fixture'}) S 1 123 123 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${failed ? '999' : '100'}` });
    recorder.capture('ready');
    failed = true;
    recorder.capture('failure');
    expect(recorder.identities).toMatchObject([{ pid: 123, phase: 'ready', command: 'fixture', starttime: '100' }, { pid: 123, phase: 'failure', command: 'replacement', starttime: '999' }]);
  });
});
