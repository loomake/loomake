import { expect, it } from 'vitest';
import { cpSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isAbortedResult, runVerify, verifyExitCode } from '@loomake/kit';
import { CHANGE, withProject } from './project.js';
import { copyChangeToArchive, verifyContextCases } from './verify-context-fixtures.js';

it.each(['valid', 'empty', 'file', 'dangling', 'outward', 'outward-valid'])('[REQ-037] active %s wins over a valid archive', kind =>
  withProject({ config: { openspecValidate: true, commands: {} } }, root => {
    const archived = copyChangeToArchive(root), active = join(root, 'openspec/changes', CHANGE), outside = join(root, '..', basename(root) + '-outside');
    try {
      if (kind !== 'valid') rmSync(active, { recursive: true });
      if (kind === 'empty') mkdirSync(active);
      else if (kind === 'file') writeFileSync(active, 'invalid active file');
      else if (kind !== 'valid') {
        mkdirSync(outside); if (kind === 'outward-valid') cpSync(archived, outside, { recursive: true });
        symlinkSync(outside, active, process.platform === 'win32' ? 'junction' : 'dir');
        if (kind === 'dangling') rmSync(outside, { recursive: true });
      }
      const result = runVerify({ root, changeId: CHANGE, gate: 'spec-only' });
      expect(verifyExitCode(result)).toBe(kind === 'valid' ? 0 : 1);
      expect(!isAbortedResult(result) && result.checks.find(c => c.id === 'change の存在')?.reason).not.toContain('archive/');
    } finally { rmSync(outside, { recursive: true, force: true }); }
  }));
it.each(verifyContextCases())('[REQ-037] active strict contract: $name', ({ files, expected }) => withProject(files, root => {
  const result = runVerify({ root, changeId: CHANGE, gate: 'spec-only' });
  expect(!isAbortedResult(result) && result.checks.find(c => c.id === 'openspec validate')?.result).toBe(expected);
  expect(verifyExitCode(result)).toBe(expected === 'PASS' ? 0 : 1);
}));
