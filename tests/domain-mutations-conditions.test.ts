import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_MUTATIONS, runMutations } from '../scripts/domain-mutations.mjs';

const root = join(import.meta.dirname, '..');
const normalReport = join(root, '.loomake/test-report.json');
const reportBytes = () => existsSync(normalReport) ? readFileSync(normalReport) : undefined;

describe('13条件を個別に実行するmutation試験', () => {
  it('[REQ-161] 要件にある13条件を同じIDと順序で選べる', () => {
    expect(DOMAIN_MUTATIONS.map((mutation) => [mutation.id, mutation.label])).toEqual([
      ['M01', '要件IDの桁数'], ['M02', '要件IDの終端'], ['M03', '状態の検証'],
      ['M04', 'ブロッキング値の大文字小文字'], ['M05', 'ブロッキング条件'], ['M06', '回答の有無'],
      ['M07', '確認待ち'], ['M08', '承認'], ['M09', '出典'], ['M10', 'テスト不足'],
      ['M11', 'ファイル順序'], ['M12', '対応ファイル'], ['M13', '必要IDの重複'],
    ]);
  });

  it.each(DOMAIN_MUTATIONS.map((mutation) => [mutation.id, mutation.label]))('[REQ-161][REQ-162][REQ-163] %s %s を独立したコピーで変えると既存テストが検出する', (id) => {
    const parent = join(root, '.loomake/quality');
    mkdirSync(parent, { recursive: true });
    const target = join(parent, `domain-condition-${randomUUID()}`);
    const before = reportBytes();
    try {
      const returned = runMutations(target, { only: [id] });
      const summary = JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'));
      expect(summary.selected).toEqual([id]);
      expect(summary.baseline.status).toBe('passed');
      expect(summary.baseline.tests).toHaveLength(10);
      expect(summary.mutations).toHaveLength(1);
      const mutation = summary.mutations[0];
      expect(mutation.id).toBe(id);
      expect(mutation.status).toBe('killed');
      expect(mutation.failedTests.length).toBeGreaterThan(0);
      for (const name of mutation.failedTests) expect(summary.baseline.tests).toContain(name);
      expect(mutation.beforeSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(mutation.afterSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(mutation.afterSha256).not.toBe(mutation.beforeSha256);
      expect(summary.originalsUnchanged).toBe(true);
      expect(summary.ok).toBe(true);
      for (const source of summary.sources) {
        expect(createHash('sha256').update(readFileSync(join(root, source.path))).digest('hex')).toBe(source.sha256);
      }
      expect(returned).toEqual(summary);
      expect(reportBytes()).toEqual(before);
    } finally { rmSync(target, { recursive: true, force: true }); }
  }, 60_000);

  it.each([[], ['unknown'], ['M01', 'M01']])('不正な選択%jは試行や保存を始めずに拒否する', (...ids) => {
    const target = join(root, '.loomake/quality', `invalid-domain-condition-${randomUUID()}`);
    const before = reportBytes();
    expect(() => runMutations(target, { only: ids })).toThrow();
    expect(existsSync(target)).toBe(false);
    expect(reportBytes()).toEqual(before);
  });

  it('空き要素のある選択は試行や保存を始めずに拒否する', () => {
    const target = join(root, '.loomake/quality', `sparse-domain-condition-${randomUUID()}`);
    const before = reportBytes();
    try {
      expect(() => runMutations(target, { only: new Array<string>(1) })).toThrow('登録されていない条件のIDがあります');
      expect(existsSync(target)).toBe(false);
      expect(reportBytes()).toEqual(before);
    } finally { rmSync(target, { recursive: true, force: true }); }
  });
});
