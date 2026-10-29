import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregateBudgetClocks, collectProfile, profileEvent, renderSummary } from '../scripts/test-phase-profile.mjs';

const directories: string[] = [];
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'loomake-budget-clock-')); directories.push(dir); return dir; }
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { force: true, recursive: true }); });
const values = { wallElapsedMs: 46000.5, holderWaitMs: 6000.25, budgetMs: 40000, graceMs: 3000 };
const clock = (caseId: string, details = {}) => ({ caseId, event: 'budget-clock', at: 1, ...values, ...details });
const events = () => [clock('deadline-push'), clock('deadline-create')];

describe('期限試験の時計診断', () => {
  it('[REQ-295] 保持役の準備待ちを差し引き、2ケースを独立集計する', () => {
    const result = aggregateBudgetClocks(events());
    expect(result.complete).toBe(true);
    expect(result.cases).toHaveLength(2);
    for (const row of result.cases) {
      expect(row).toMatchObject({ ...values, budgetElapsedMs: 40000.25, complete: true, missing: [] });
    }
  });

  it('[REQ-295] 欠損と重複をゼロで補わない', () => {
    for (const rows of [[], [clock('deadline-push')], [...events(), clock('deadline-push')]]) {
      const result = aggregateBudgetClocks(rows);
      expect(result.complete).toBe(false);
      for (const row of result.cases.filter((item) => !item.complete)) {
        expect(row.missing.length).toBeGreaterThan(0);
        expect(row).toMatchObject({ wallElapsedMs: null, holderWaitMs: null, budgetMs: null, graceMs: null, budgetElapsedMs: null });
      }
    }
  });

  it('[REQ-295] 負・非有限・非数値・待ち超過・非正予算を不整合とする', () => {
    const invalid = [
      { wallElapsedMs: -1 }, { wallElapsedMs: Number.NaN }, { holderWaitMs: Infinity },
      { holderWaitMs: -1 }, { holderWaitMs: 47000 }, { budgetMs: 0 }, { budgetMs: -1 },
      { graceMs: -1 }, { graceMs: Number.NaN }, { wallElapsedMs: undefined }, { budgetMs: '40000' },
    ];
    for (const details of invalid) {
      const result = aggregateBudgetClocks([clock('deadline-push', details), clock('deadline-create')]);
      expect(result.complete).toBe(false);
      expect(result.cases[0].budgetElapsedMs).toBeNull();
      expect(result.cases[1].complete).toBe(true);
    }
    expect(aggregateBudgetClocks([clock('deadline-push', { wallElapsedMs: 0, holderWaitMs: 0, graceMs: 0 }), clock('deadline-create')]).complete).toBe(true);
  });

  it('[REQ-295][REQ-296] 保存先と追加flagを指定した場合だけ数値項目を記録する', () => {
    const dir = fixture(); const enabled = { LOOMAKE_TEST_PHASE_PROFILE_DIR: dir, LOOMAKE_TEST_BUDGET_CLOCK: '1' };
    profileEvent('deadline-push', 'budget-clock', values, { LOOMAKE_TEST_PHASE_PROFILE_DIR: dir });
    profileEvent('deadline-push', 'budget-clock', values, { LOOMAKE_TEST_BUDGET_CLOCK: '1' });
    expect(readdirSync(dir)).toEqual([]);
    profileEvent('deadline-push', 'budget-clock', { ...values, stdout: 'private', args: ['secret'], extra: 9, budgetElapsedMs: 123 }, enabled);
    const row = JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]), 'utf8'));
    expect(row).toEqual({ caseId: 'deadline-push', event: 'budget-clock', at: expect.any(Number), ...values });
  });

  it('[REQ-295][REQ-296] 区間が途中失敗しても時計を独立して保存し、日本語で表示する', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'events.jsonl'), events().map((row) => JSON.stringify(row)).join('\n'));
    const env = { LOOMAKE_TEST_BUDGET_CLOCK: '1', TEST_PHASE_OUTCOME: 'failure' };
    const result = collectProfile(dir, env);
    expect(result.complete).toBe(false);
    expect(result.budgetClocks!.complete).toBe(true);
    expect(result.context.testOutcome).toBe('failure');
    expect(result.cases.every((row) => row.totalMs === null)).toBe(true);
    expect(result.cases.flatMap((row) => row.phases).some((row) => row.name.includes('budget'))).toBe(false);
    const saved = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'));
    expect(saved.budgetClocks).toEqual(result.budgetClocks);
    const summary = readFileSync(join(dir, 'summary.md'), 'utf8');
    for (const label of ['実時間', '保持役の準備待ち', '予算上の経過時間', '猶予', '時計診断']) expect(summary).toContain(label);
    expect(summary).toContain('40000.25 ms');
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(32 * 1024);
  });

  it('[REQ-295][REQ-296] flagなしの旧形式には時計を付けず、追加flagで欠損を表示する', () => {
    const dir = fixture();
    const old = collectProfile(dir, {});
    expect(Object.hasOwn(old, 'budgetClocks')).toBe(false);
    expect(renderSummary(old)).not.toContain('時計診断');
    const enabled = collectProfile(dir, { LOOMAKE_TEST_BUDGET_CLOCK: '1' });
    expect(enabled.complete).toBe(false);
    expect(enabled.budgetClocks!.complete).toBe(false);
    expect(enabled.budgetClocks!.cases.every((row) => row.budgetElapsedMs === null)).toBe(true);
    expect(renderSummary(enabled)).toContain('不足または不整合');
  });
});
