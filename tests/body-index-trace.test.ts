import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseTrace } from '../packages/core/src/index.js';

it('[REQ-470][REQ-471] 本体索引の採用済み確認事項10件を公開parseTraceで読み取る', () => {
  const changes = join(import.meta.dirname, '../openspec/changes');
  const change = 'index-evidence-body-references';
  const active = join(changes, change);
  const archived = () => {
    const names = readdirSync(join(changes, 'archive')).filter((name) => name.endsWith(`-${change}`));
    expect(names).toHaveLength(1);
    return join(changes, 'archive', names[0]);
  };
  const file = join(existsSync(active) ? active : archived(), 'trace.md');
  const parsed = parseTrace(file, readFileSync(file, 'utf8'));
  expect(parsed.errors).toEqual([]);
  expect(parsed.value.questions.map((q) => q.ID)).toEqual([
    'QRef-22', 'QRef-23', 'QRef-24', 'QRef-25', 'QRef-26',
    'QRef-29', 'QRef-27', 'QRef-28', 'QRef-30', 'QRef-31',
  ]);
  for (const q of parsed.value.questions) {
    expect(q['回答'], q.ID).toMatch(/^A。/);
    expect(q['回答者'], q.ID).not.toBe('');
    expect(q['回答日'], q.ID).toBe(['QRef-27', 'QRef-28', 'QRef-30', 'QRef-31'].includes(q.ID) ? '2026-11-06' : '2026-11-05');
    if (['QRef-30', 'QRef-31'].includes(q.ID)) expect(q['回答者']).toBe('管理役root');
  }
});
