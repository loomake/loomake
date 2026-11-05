import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { collectToolOutput, type CollectRequest, ghPrChecksArgs, biomeArgs, playwrightTestArgs, UsageError, withProcessBudget } from '../src/index.js';
import * as runtime from '../src/runtime/process.js';

// 共有予算と中断の試験では監視役・子を複数回起動するため、既存 process 試験と同じ上限を使う。
vi.setConfig({ testTimeout: 60_000 });
const gh = [{ name: 'unit', bucket: 'pass' }];
const request = (code: string, options: Partial<CollectRequest> = {}): CollectRequest => ({
  tool: 'gh', command: process.execPath, args: ['-e', code], timeoutMs: 10_000, ...options,
});
function fixture(action: (dir: string) => void) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-collect ')));
  try { action(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const emit = (value: unknown, status = 0) => `process.stdout.write(${JSON.stringify(JSON.stringify(value))});process.exitCode=${status}`;
describe('collectToolOutput', () => {
  it.each([
    ['gh', gh, 'checks'],
    ['claude', { type: 'result', subtype: 'success', is_error: false, result: 'response' }, 'agent-result'],
    ['codex', null, 'agent-result'],
    ['biome', { summary: { errors: 0, warnings: 0, infos: 0, diagnosticsNotPrinted: 0 }, diagnostics: [] }, 'diagnostics'],
    ['playwright', { suites: [], errors: [], stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } }, 'tests'],
  ] as const)('[REQ-449] %s の payload を終了状態と分けて収集する', (tool, payload, kind) => {
    const code = tool === 'codex' ? 'process.stdout.write(\'{"type":"turn.started"}\\n{"type":"turn.completed","usage":{}}\')' : emit(payload, 7);
    expect(collectToolOutput(request(code, { tool }))).toMatchObject({
      tool, outcome: 'parsed', exit: { status: tool === 'codex' ? 0 : 7, signal: null }, observation: { tool, kind }, diagnostics: '',
    });
  });
  it('[REQ-449] 空 stdout の gh は終了 1 でも unreadable、途中 JSON は終了 0 でも unreadable', () => {
    expect(collectToolOutput(request('process.exitCode=1'))).toMatchObject({ outcome: 'unreadable', exit: { status: 1, signal: null } });
    expect(collectToolOutput(request('process.stdout.write("{broken")'))).toMatchObject({
      outcome: 'unreadable', exit: { status: 0, signal: null }, reason: '1行目：JSON として読めません',
    });
  });
  it('[REQ-449] 存在しない command と起動できないファイルを分類する', () => fixture(dir => {
    expect(collectToolOutput(request('', { command: join(dir, 'missing') }))).toMatchObject({ outcome: 'not_found', reason: '外部操作を起動できません。（ENOENT）' });
    const file = join(dir, 'not-executable.exe'); writeFileSync(file, 'invalid executable');
    expect(collectToolOutput(request('', { command: file }))).toMatchObject({ outcome: 'spawn_error' });
  }));
  it('[REQ-449] timeout と output の上限を区別する', () => {
    expect(collectToolOutput(request('setInterval(()=>{},100)', { timeoutMs: 250 }))).toMatchObject({ outcome: 'limited', kind: 'timeout' });
    expect(collectToolOutput(request('process.stdout.write("x".repeat(10000));setInterval(()=>{},100)', { maxBuffer: 1000 })))
      .toMatchObject({ outcome: 'limited', kind: 'output' });
  });
  it('[REQ-449] 共有期限を延ばさず、期限後は次の子を起動しない', () => fixture(dir => {
    const marker = join(dir, 'after');
    withProcessBudget({ timeoutMs: 2000 }, () => {
      expect(collectToolOutput(request('setTimeout(()=>{console.log("[]")},1200)'))).toMatchObject({ outcome: 'parsed' });
      expect(collectToolOutput(request('setTimeout(()=>{console.log("[]")},1200)'))).toMatchObject({ outcome: 'limited', kind: 'timeout' });
      expect(collectToolOutput(request(`require('node:fs').writeFileSync(${JSON.stringify(marker)},'x')`))).toMatchObject({ outcome: 'limited', kind: 'timeout' });
      expect(existsSync(marker)).toBe(false);
    });
  }));
  it('[REQ-449] 中断状態を共有し、次の子を起動しない', () => fixture(dir => {
    const marker = join(dir, 'after');
    withProcessBudget({ timeoutMs: 10_000 }, () => {
      expect(collectToolOutput(request('process.kill(process.ppid,"SIGINT");setInterval(()=>{},100)')))
        .toMatchObject({ outcome: 'limited', kind: 'interrupted' });
      expect(collectToolOutput(request(`require('node:fs').writeFileSync(${JSON.stringify(marker)},'x')`)))
        .toMatchObject({ outcome: 'limited', kind: 'interrupted' });
      expect(existsSync(marker)).toBe(false);
    });
  }));
  it('[REQ-449] 正しい payload の後のシグナル終了も実際の終了状態を残す', () => {
    const code = `process.stdout.write('[]',()=>process.kill(process.pid,'SIGTERM'))`;
    const result = collectToolOutput(request(code));
    expect(result.outcome).toBe('parsed');
    if (process.platform === 'win32') expect(result).toMatchObject({ exit: { status: 1, signal: null } });
    else expect(result).toMatchObject({ exit: { status: null, signal: 'SIGTERM' } });
  });
  it('[REQ-449] 起動は 1 回で shell:false・untilDeadline:true と指定値を渡す', () => {
    const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue({ status: 3, signal: null, stdout: '[]', stderr: '' });
    const env = { ...process.env, COLLECT_TEST: 'ok' };
    try {
      withProcessBudget({ timeoutMs: 10_000, maxOperationMs: 1 }, () => {
        expect(collectToolOutput(request('', { env, cwd: '.', timeoutMs: 1234, maxBuffer: 4567 })).outcome).toBe('parsed');
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(process.execPath, ['-e', ''], {
        cwd: '.', env, timeoutMs: 1234, maxBuffer: 4567, shell: false, untilDeadline: true,
      });
    } finally { spy.mockRestore(); }
  });
  it('[REQ-449] untilDeadline は操作単位の上限を使わず、共有期限を使う', () => {
    withProcessBudget({ timeoutMs: 5000, maxOperationMs: 1 }, () => {
      expect(collectToolOutput(request(emit([])))).toMatchObject({ outcome: 'parsed' });
    });
  });
  it('[REQ-449] Playwright は子 env の複製から 3 変数だけを除く', () => {
    const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue({ status: 0, signal: null, stdout: '{}', stderr: '' });
    const env = {
      PLAYWRIGHT_JSON_OUTPUT_FILE: 'report.json', PLAYWRIGHT_JSON_OUTPUT_DIR: 'out', PLAYWRIGHT_JSON_OUTPUT_NAME: 'name',
      playwright_json_output_file: 'lower', OTHER: 'keep', PLAYWRIGHT_HTML_OUTPUT_DIR: 'html',
    };
    const original = { ...env };
    try {
      collectToolOutput(request('', { tool: 'playwright', env }));
      expect(spy.mock.calls[0][2]?.env).toEqual({
        OTHER: 'keep', PLAYWRIGHT_HTML_OUTPUT_DIR: 'html', ...(process.platform === 'win32' ? {} : { playwright_json_output_file: 'lower' }),
      });
      expect(env).toEqual(original); expect(spy.mock.calls[0][2]?.env).not.toBe(env);
      collectToolOutput(request('', { tool: 'playwright' }));
      const inherited = spy.mock.calls[1][2]?.env;
      expect(inherited).not.toBe(process.env);
      expect(inherited?.PLAYWRIGHT_JSON_OUTPUT_FILE).toBeUndefined();
      expect(inherited?.PLAYWRIGHT_JSON_OUTPUT_DIR).toBeUndefined();
      expect(inherited?.PLAYWRIGHT_JSON_OUTPUT_NAME).toBeUndefined();
    } finally { spy.mockRestore(); }
  });
  it('[REQ-449] 実際の子に cwd・引数・env を渡す', () => fixture(dir => {
    const code = `const valid=process.cwd()===${JSON.stringify(dir)}&&process.argv[1]==='a b;$あ'&&process.env.COLLECT_TEST==='value';console.log(valid?'[]':'{')`;
    expect(collectToolOutput(request(code, { args: ['-e', code, 'a b;$あ'], cwd: dir, env: { ...process.env, COLLECT_TEST: 'value' } })))
      .toMatchObject({ outcome: 'parsed' });
  }));
  it.each([
    ...[0, -1, NaN, Infinity, undefined].map(timeoutMs => ({ timeoutMs })),
    ...[0, -1, 0.5, 2 ** 53].map(maxBuffer => ({ maxBuffer })),
    { tool: 'future' }, { command: '' }, { command: 'x\0y' }, { command: 3 },
    { args: null }, { args: ['x\0y'] }, { args: [1] }, { args: Array(1) },
  ])('[REQ-449] 不正な request は起動前に UsageError にする: %j', override => {
    const spy = vi.spyOn(runtime, 'runExternal');
    try {
      expect(() => collectToolOutput({ ...request(''), ...override } as CollectRequest)).toThrow(UsageError);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});

describe('引数の生成', () => {
  it('[REQ-449] 読み取り専用 gh・Biome の none・Playwright の JSON args を新しい配列で返す', () => {
    expect(ghPrChecksArgs(12)).toEqual(['pr', 'checks', '12', '--json', 'name,bucket,workflow,link']);
    expect(ghPrChecksArgs(12, { repo: 'owner/repo.name' })).toEqual(['pr', 'checks', '12', '--json', 'name,bucket,workflow,link', '--repo', 'owner/repo.name']);
    const paths = Object.freeze(['a b.ts']);
    expect(biomeArgs('lint', paths)).toEqual(['lint', '--reporter', 'json', '--max-diagnostics', 'none', 'a b.ts']);
    expect(biomeArgs('ci', paths)[0]).toBe('ci');
    expect(playwrightTestArgs([])).toEqual(['test', '--reporter', 'json']);
    expect(playwrightTestArgs(paths)).toEqual(['test', '--reporter', 'json', 'a b.ts']);
    expect(ghPrChecksArgs(12)).not.toBe(ghPrChecksArgs(12));
    expect(biomeArgs('ci', paths)).not.toBe(biomeArgs('ci', paths));
    expect(playwrightTestArgs(paths)).not.toBe(playwrightTestArgs(paths));
  });
  it('[REQ-449] 不正な pr・repo・mode・path を固定文の UsageError にする', () => {
    const calls = [
      ...[0, -1, 0.5, 2 ** 53, NaN].map(pr => () => ghPrChecksArgs(pr)),
      ...['', 'owner/repo/other', '-x', 'owner/x\0y'].map(repo => () => ghPrChecksArgs(1, { repo })),
      () => biomeArgs('other' as 'lint', ['a']), () => biomeArgs('ci', []),
      ...['', '-flag', 'a\0b'].flatMap(path => [() => biomeArgs('lint', [path]), () => playwrightTestArgs([path])]),
      () => biomeArgs('ci', Array(1)), () => playwrightTestArgs(Array(1)),
    ];
    for (const call of calls) expect(call).toThrow(UsageError);
  });
});
