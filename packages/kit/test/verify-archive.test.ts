import { describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAbortedResult, loadVerifyQualitySchema, runExternal, runVerify, UsageError, verifyExitCode } from '@loomake/kit';
import { resolveChangeDir } from '../src/runtime/change-files.js';
import { CHANGE, commitAll, QUALITY_YAML, vitestCommand, withProject } from './project.js';

import { copyChangeToArchive, verifyContextCases } from './verify-context-fixtures.js';

const contexts = verifyContextCases();
const collision = contexts.find(c => c.name === 'ADDED/after')!;
contexts.push({ ...collision, name: 'ADDED collision INFO', files: { ...collision.files, files: Object.fromEntries(
  Object.entries(collision.files.files!).map(([path, text]) => [path, text.replace('システムはNewを持つ SHALL。', '異なる本文を保持する SHALL。')])) } });
const schema = await loadVerifyQualitySchema();
const archive = (root: string) => {
  const target = copyChangeToArchive(root); rmSync(join(root, 'openspec/changes', CHANGE), { recursive: true }); return target;
};
const specOnly = (root: string) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', qualitySchema: schema });
const strict = { openspecValidate: true, commands: {} };
const checked = (result: ReturnType<typeof runVerify>, id: string) => !isAbortedResult(result) ? result.checks.find(c => c.id === id) : undefined;
function isolatedStage<T>(root: string, fn: (path: string) => T): T {
  const path = join(root, 'isolated-temp'); mkdirSync(path);
  const names = ['TMPDIR', 'TMP', 'TEMP']; const saved = names.map(name => process.env[name]);
  for (const name of names) process.env[name] = path;
  try { return fn(path); } finally { names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; }); }
}

describe('archive verification', () => {
  it('[REQ-394] rejects missing/ambiguous/undated archives but accepts date glyphs without calendar rules', () => withProject({}, root => {
    const path = archive(root), changes = join(root, 'openspec/changes');
    cpSync(path, join(changes, 'archive', `2026-11-04-${CHANGE}`), { recursive: true });
    expect(checked(specOnly(root), 'change の存在')).toMatchObject({ result: 'FAIL', reason: expect.stringContaining('複数') });
    rmSync(join(changes, 'archive', `2026-11-04-${CHANGE}`), { recursive: true });
    const undated = join(changes, 'archive', CHANGE); renameSync(path, undated);
    expect(resolveChangeDir(changes, CHANGE)).toMatchObject({ kind: 'missing' });
    renameSync(undated, join(changes, 'archive', `2026-99-99-${CHANGE}`));
    expect(resolveChangeDir(changes, CHANGE)).toMatchObject({ kind: 'archived' });
    expect(() => runVerify({ root, changeId: '../sample', gate: 'spec-only' })).toThrow(UsageError);
  }));
  it('[REQ-394] rejects a newly supported archive under a nonstandard openspecDir', () => withProject({ config: { ...strict, openspecDir: 'other' } }, root => {
    archive(root); renameSync(join(root, 'openspec'), join(root, 'other'));
    expect(checked(specOnly(root), 'change の存在')).toMatchObject({ result: 'FAIL', reason: expect.stringContaining('標準root') });
  }));
  it.each(['pass', 'tasks', 'coverage', 'quality'])('[REQ-394] runs original-repo CI and preserves %s results', kind => withProject({ quality: kind === 'quality' ? QUALITY_YAML.replace('== 0', '== 1') : true,
    tasks: kind === 'tasks' ? '## 1. Tasks\n- [ ] 1.1 pending\n' : undefined,
    config: { openspecValidate: true, commands: { test: vitestCommand() } },
    files: { 'tests/a.test.ts': `import {writeFileSync} from 'node:fs';it('[${kind === 'coverage' ? 'REQ-999' : 'REQ-012'}] real test',()=>{writeFileSync('observed-cwd.txt',process.cwd());expect(true).toBe(true)});` },
  }, root => {
    const path = archive(root), sha = commitAll(root); mkdirSync(join(root, '.loomake'), { recursive: true });
    writeFileSync(join(root, '.loomake/test-report.json'), '{"old":true}');
    const result = runVerify({ root, changeId: CHANGE, gate: 'done', qualitySchema: schema });
    expect(verifyExitCode(result)).toBe(kind === 'pass' ? 0 : 1);
    if (kind === 'pass') expect(result).toMatchObject({ scope: 'ci', verdict: 'PASS', coverage: { 'REQ-012': ['tests/a.test.ts'] } });
    else expect(checked(result, kind === 'tasks' ? 'tasks.md' : kind === 'coverage' ? '要件ごとのテスト' : 'quality:PQ-900')?.result).toBe('FAIL');
    expect(checked(result, 'quality:subjects')).toMatchObject({ result: 'PASS' });
    expect(checked(result, 'openspec validate')?.reason).toContain('隔離複写');
    expect(readFileSync(join(root, 'observed-cwd.txt'), 'utf8')).toBe(root);
    expect(runExternal('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim()).toBe(sha);
    expect(existsSync(path)).toBe(true); expect(existsSync(join(root, 'openspec/changes', CHANGE))).toBe(false);
  }), 60_000);
  it.each(contexts)('[REQ-394] preserves archived strict context: $name', ({ files, expected }) => withProject(files, root => {
    archive(root);
    isolatedStage(root, stage => {
      const result = specOnly(root);
      expect(checked(result, 'openspec validate')).toMatchObject({ result: expected, reason: expect.stringContaining('隔離複写') });
      expect(verifyExitCode(result)).toBe(expected === 'PASS' ? 0 : 1); expect(readdirSync(stage)).toEqual([]);
    });
  }));
  it.each(['budget', 'link', 'missing-cli'])('[REQ-394] does not pass %s failures and removes staged inputs', kind => withProject({ config: strict }, root => {
    const path = archive(root);
    isolatedStage(root, stage => {
      const savedPath = process.env.PATH;
      try {
        if (kind === 'budget') writeFileSync(join(root, 'openspec/config.yaml'), 'x'.repeat(1024 * 1024 + 1));
        else if (kind === 'link') symlinkSync(join(path, 'tasks.md'), join(path, 'linked.md'));
        else process.env.PATH = '';
        if (kind === 'missing-cli') expect(verifyExitCode(specOnly(root))).toBe(1);
        else expect(() => specOnly(root)).toThrow(UsageError);
        expect(readdirSync(stage)).toEqual([]);
      } finally { if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath; }
    });
  }));
});
