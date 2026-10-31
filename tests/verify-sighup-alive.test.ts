import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createProcessAlive } from '../scripts/process-alive.mjs';

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
