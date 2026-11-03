import { afterEach, expect, it, vi } from 'vitest';
import { closeSync, mkdirSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyResultSchemas } from '@loomake/core';
import { loadConfig, runVerify, RuntimeFailure, UsageError, verifyAbortedResult, verifyExitCode, type VerifyOptions } from '@loomake/kit';
import { main } from '../src/main.js';
import { loadRunConfig } from '../../runner/src/run/prepare.js';
import { CHANGE, withProject } from '../../kit/test/project.js';

const denied = vi.hoisted(() => ({ file: '' }));
vi.mock('node:fs', async original => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, closeSync: vi.fn(fs.closeSync), openSync: vi.fn((...args: Parameters<typeof fs.openSync>) => {
    if (String(args[0]) === denied.file) throw Object.assign(new Error('EACCES: test read denied'), { code: 'EACCES' });
    return fs.openSync(...args);
  }) };
});
afterEach(() => { denied.file = ''; vi.clearAllMocks(); });
const { verifyResultSchema } = await loadVerifyResultSchemas();
const modes = ['bare', 'spec-only', 'done'] as const;
type Mode = typeof modes[number];
const options = (root: string, mode: Mode): VerifyOptions => ({ root, ...(mode === 'bare' ? {} : { changeId: CHANGE, gate: mode }) });
const argv = (mode: Mode) => mode === 'bare' ? ['verify'] : ['verify', '--change', CHANGE, `--${mode}`];
const thrown = (action: () => unknown): unknown => { try { action(); } catch (error) { return error; } };
async function cli(root: string, args: string[]) {
  const out: string[] = [], err: string[] = [], saved = process.env.CI;
  try {
    process.env.CI = '1';
    const code = await main(args, { cwd: root, stdout: text => out.push(text), stderr: text => err.push(text) });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally { if (saved === undefined) delete process.env.CI; else process.env.CI = saved; }
}

it.each(modes)('[REQ-395] %s APIのOS読取失敗だけをruntime/3に分ける', mode => withProject({}, root => {
  denied.file = join(root, 'loomake.config.json');
  const error = thrown(() => runVerify(options(root, mode)));
  expect(error).toBeInstanceOf(RuntimeFailure); expect(error).not.toBeInstanceOf(UsageError);
  const result = verifyAbortedResult(error, mode === 'bare' ? null : CHANGE);
  expect(result.run.errors[0].kind).toBe('runtime'); expect(verifyExitCode(result)).toBe(3);
}));
it.each(modes)('[REQ-395][REQ-311] %s CLIのJSON/textはOS読取失敗3で使い方を出さない', mode => withProject({}, async root => {
  denied.file = join(root, 'loomake.config.json');
  const json = await cli(root, [...argv(mode), '--json']), text = await cli(root, argv(mode));
  expect([json.code, text.code]).toEqual([3, 3]); expect(text.stdout).toBe('');
  const result = JSON.parse(json.stdout);
  expect(verifyResultSchema.safeParse(result).success).toBe(true);
  expect(result).toMatchObject({ change: mode === 'bare' ? null : CHANGE, run: { status: 'aborted', errors: [{ kind: 'runtime', target: mode === 'bare' ? 'verify' : CHANGE }] } });
  for (const output of [json, text]) { expect(output.stderr).toContain('loomake.config.json を読めません'); expect(output.stderr).not.toContain('使い方:'); }
}));
it.each(['{bad', '{"commands":[]}', '[]'])('[REQ-395] 構文・内容不正%sはconfig/2を保つ', content => withProject({ files: { 'loomake.config.json': content } }, async root => {
  const result = verifyAbortedResult(thrown(() => runVerify({ root })), null);
  expect(result.run.errors[0].kind).toBe('config'); expect(verifyExitCode(result)).toBe(2);
  for (const args of [['verify'], ['verify', '--json']]) { const output = await cli(root, args); expect(output.code).toBe(2); expect(output.stderr).toContain('使い方:'); }
}));
it('[REQ-395] 設定の不在は既定値とbare verifyの0を保つ', () => withProject({}, async root => {
  rmSync(join(root, 'loomake.config.json')); expect(loadConfig(root).commands).toEqual({});
  expect(verifyExitCode(runVerify({ root }))).toBe(0);
  expect((await cli(root, ['verify', '--json'])).code).toBe(0);
}));
it('[REQ-395] 共有loadConfig・doctor・trace・runnerの既存分類を保つ', () => withProject({}, async root => {
  denied.file = join(root, 'loomake.config.json');
  for (const action of [() => loadConfig(root), () => loadRunConfig(root)]) {
    const error = thrown(action); expect(error).toBeInstanceOf(UsageError); expect(error).not.toBeInstanceOf(RuntimeFailure);
    expect(String(error)).toContain('loomake.config.json を読めません（');
  }
  const doctor = await cli(root, ['doctor']); expect(doctor.code).toBe(1); expect(doctor.stdout).toContain('loomake.config.json を読めません：');
  const trace = await cli(root, ['trace', 'record', '--change', CHANGE]); expect(trace.code).toBe(2); expect(trace.stderr).toContain('使い方:');
}));
it.each(['oversized', 'directory', 'link'])('[REQ-395][REQ-172] 意図した入力拒否%sはconfig/2を保つ', kind => withProject({}, async root => {
  const file = join(root, 'loomake.config.json');
  if (kind === 'oversized') truncateSync(file, 1024 * 1024 + 1);
  else { rmSync(file); if (kind === 'directory') mkdirSync(file); else symlinkSync(root, file, process.platform === 'win32' ? 'junction' : 'dir'); }
  expect(thrown(() => runVerify({ root }))).toBeInstanceOf(UsageError);
  const output = await cli(root, ['verify', '--json']); expect(output.code).toBe(2); expect(JSON.parse(output.stdout).run.errors[0].kind).toBe('config');
}));
it('[REQ-395] readのfinallyで起こるcloseSync例外の既存分類を保つ', async () => {
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
  withProject({}, root => {
    vi.mocked(closeSync).mockImplementationOnce(fd => { fs.closeSync(fd); throw new Error('EIO: test close failed'); });
    const result = verifyAbortedResult(thrown(() => runVerify({ root })), null);
    expect(result.run.errors[0].kind).toBe('config'); expect(verifyExitCode(result)).toBe(2);
  });
});
