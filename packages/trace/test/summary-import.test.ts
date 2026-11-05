import { describe, expect, it, vi } from 'vitest';
import { summaryFixture } from './summary-fixture.js';

const metadata = vi.hoisted(() => ({ reads: 0 }));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, readFileSync: (...args: Parameters<typeof fs.readFileSync>) => {
    if (args[0] instanceof URL && args[0].pathname.endsWith('/trace/package.json')) {
      metadata.reads++; throw new Error('metadata読み取りを観測');
    }
    return fs.readFileSync(...args);
  } };
});
describe('要約metadataの遅延読取', () => {
  it('[REQ-461] importではpackage metadataを読まず、実記録用の生成時だけ読む', async () => {
    const { executionSummary } = await import('../src/summary-record.js');
    expect(metadata.reads).toBe(0);
    expect(() => executionSummary('/missing-summary-project', '/missing-summary-change', summaryFixture().verify, 0, 1, {})).toThrow('metadata読み取りを観測');
    expect(metadata.reads).toBe(1);
  });
});
