import { loadVerifyQualitySchema } from '@loomake/kit';
import { it, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExternal } from '../src/runtime/process.js';
import { runVerify } from '../src/verify/run.js';
import { withProject, CHANGE } from './project.js';
const qualitySchema = await loadVerifyQualitySchema();
vi.mock('../src/runtime/process.js', async (original) => ({ ...await original<typeof import('../src/runtime/process.js')>(), runExternal: vi.fn() }));
it('[REQ-424][REQ-038] rechecks a report swapped by external validation before deletion', () => {
  const outside = mkdtempSync(join(tmpdir(), 'loomake-report-outside-'));
  try {
    writeFileSync(join(outside, 'report.json'), 'untouched');
    withProject({ config: { openspecValidate: true, tests: { report: 'reports/report.json' }, commands: {} } }, (root) => {
      mkdirSync(join(root, 'reports'));
      vi.mocked(runExternal).mockImplementationOnce(() => {
        rmSync(join(root, 'reports'), { recursive: true }); symlinkSync(outside, join(root, 'reports'), 'dir');
        return { status: 0, signal: null, stdout: '', stderr: '' };
      });
      expect(() => runVerify({ root, qualitySchema, changeId: CHANGE, gate: 'done', scope: 'local' })).toThrow(/tests.report/);
      expect(readFileSync(join(outside, 'report.json'), 'utf8')).toBe('untouched');
    });
  } finally { rmSync(outside, { recursive: true, force: true }); }
});
it('[REQ-424][REQ-038] removes only a safe internal final link', () => {
  withProject({ config: { openspecValidate: false, tests: { report: 'report.json' }, commands: {} } }, (root) => {
    writeFileSync(join(root, 'target.json'), 'untouched'); symlinkSync(join(root, 'target.json'), join(root, 'report.json'));
    runVerify({ root, qualitySchema, changeId: CHANGE, gate: 'done', scope: 'local' });
    expect(readFileSync(join(root, 'target.json'), 'utf8')).toBe('untouched');
    expect(() => readFileSync(join(root, 'report.json'))).toThrow();
  });
});
