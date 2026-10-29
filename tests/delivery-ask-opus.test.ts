import { describe, expect, it } from 'vitest';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { askOpus, buildClaudeArgs, evaluateEvents, parseArgs } from '../.agents/skills/delivery/scripts/ask-opus.mjs';

const session = 'test-session';
function events() {
  return [
    { type: 'system', subtype: 'init', session_id: session, model: 'claude-opus-test', tools: ['Read', 'Glob', 'Grep'], mcp_servers: [], apiKeySource: 'none' },
    { type: 'result', subtype: 'success', is_error: false, session_id: session, result: '回答の目印', modelUsage: { 'claude-opus-test': {} }, permission_denials: [] },
  ];
}
const encode = (items: unknown[]) => items.map((item) => JSON.stringify(item)).join('\n');

describe('deliveryのOpus応答の検証', () => {
  it('実際のOpus・新しいセッション・拒否なしの回答を採用する', () => {
    expect(evaluateEvents(encode(events()), session)).toMatchObject({ models: ['claude-opus-test'], sessionId: session, permissionDenials: 0 });
  });
  it.each([
    ['別モデル', (items: ReturnType<typeof events>) => { Object.assign(items[1], { modelUsage: { 'claude-sonnet-test': {} } }); }],
    ['モデル情報なし', (items: ReturnType<typeof events>) => { Object.assign(items[1], { modelUsage: {} }); }],
    ['拒否', (items: ReturnType<typeof events>) => { Object.assign(items[1], { permission_denials: [{ tool_name: 'Write' }] }); }],
    ['拒否情報なし', (items: ReturnType<typeof events>) => { delete items[1].permission_denials; }],
    ['実行エラー', (items: ReturnType<typeof events>) => { items[1].is_error = true; }],
    ['空の回答', (items: ReturnType<typeof events>) => { items[1].result = ''; }],
    ['上限停止', (items: ReturnType<typeof events>) => { items[1].subtype = 'error_max_turns'; }],
    ['セッション不一致', (items: ReturnType<typeof events>) => { items[1].session_id = 'other-session'; }],
    ['編集できるツール', (items: ReturnType<typeof events>) => { items[0].tools = ['Read', 'Write']; }],
    ['MCP', (items: ReturnType<typeof events>) => { Object.assign(items[0], { mcp_servers: [{ name: 'external' }] }); }],
  ])('%sを成功と扱わない', (_name, mutate) => {
    const items = events();
    mutate(items);
    expect(() => evaluateEvents(encode(items), session)).toThrow();
  });
  it('壊れたJSONや最終結果の欠落を成功と扱わない', () => {
    expect(() => evaluateEvents('not JSON', session)).toThrow();
    expect(() => evaluateEvents(encode(events().slice(0, 1)), session)).toThrow();
  });
  it('新規セッション・読取ツール・hook/MCP無効を固定し、既存セッションを再開しない', () => {
    const args = buildClaudeArgs(session, '/request');
    expect(args).toEqual(['--print', '--model', 'opus', '--permission-mode', 'plan', '--tools', 'Read,Glob,Grep', '--allowedTools', 'Read(./**)',
      '--setting-sources', '', '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false,"permissions":{"blockReadsOutsideWorkingDirectories":true}}', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--no-session-persistence', '--session-id', session, '--add-dir', '/request', '--output-format', 'stream-json', '--verbose']);
  });
  it('未知の引数・短いhead・時間上限なしを受け付けない', () => {
    for (const args of [[], ['--role', 'unknown'], ['--head', '123'], ['--continue', 'yes'],
      ['--role', 'design', '--request', 'r', '--head', 'a'.repeat(40), '--timeout-min', '0']]) {
      expect(() => parseArgs(args)).toThrow();
    }
    expect(parseArgs(['--role', 'design', '--request', 'r', '--head', 'a'.repeat(40)])).toMatchObject({ role: 'design', timeoutMs: 1_200_000 });
  });
});

async function withCleanup(action: () => void | Promise<void>, cleanup: () => void | Promise<void>) {
  const errors: unknown[] = [];
  try { await action(); } catch (error) { errors.push(error); }
  try { await cleanup(); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, '試験と後片付けの失敗を保持しました。');
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
  if (process.platform === 'linux') {
    try { return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  if (process.platform === 'darwin') {
    const result = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status === 1 && !result.stdout.trim()) return false;
    if (result.status !== 0) throw new Error('子プロセスの状態を確認できませんでした。');
    return !/^Z/.test(result.stdout.trim());
  }
  return true;
}

function readFakePid(cwd: string): number | undefined {
  const file = join(cwd, '.loomake/pid');
  if (!existsSync(file)) return undefined;
  const pid = Number(readFileSync(file, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) throw new Error('偽プロセスのPIDが不正です。');
  return pid;
}

const windowsStopScript = String.raw`
$ErrorActionPreference = 'Stop'
$targetPidValue = [uint32]::Parse($env:LOOMAKE_CLEANUP_PID)
$expectedFixture = [IO.Path]::GetFullPath($env:LOOMAKE_CLEANUP_FIXTURE)
$record = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $targetPidValue)
if ($null -eq $record) { exit 0 }
if ([string]::IsNullOrWhiteSpace($record.CommandLine)) { throw 'Process command line unavailable' }
$escapedFixture = [regex]::Escape($expectedFixture)
$fixtureArgument = '(?:^|\s)(?:"' + $escapedFixture + '"|' + $escapedFixture + ')(?=\s|$)'
if (-not [regex]::IsMatch($record.CommandLine, $fixtureArgument, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
  throw 'Process fixture argument mismatch'
}
& taskkill.exe /PID $targetPidValue /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Owned process termination failed' }
`;

async function stopOwnedFake(cwd: string, timeoutMs: number) {
  const pid = readFakePid(cwd);
  if (pid === undefined || !alive(pid)) return;
  if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsStopScript], {
      env: { ...process.env, LOOMAKE_CLEANUP_PID: String(pid), LOOMAKE_CLEANUP_FIXTURE: join(cwd, '.loomake/fake.mjs') },
      encoding: 'utf8', shell: false, timeout: timeoutMs, killSignal: 'SIGKILL',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`所有する偽プロセスを確認・停止できませんでした。${result.stderr}`);
  } else {
    try { process.kill(-pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
  const deadline = Date.now() + timeoutMs;
  while (alive(pid) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  if (alive(pid)) throw new Error('所有する偽プロセスが後片付け後も動いています。');
}

async function withRepo(mode: string, check: (fixture: { cwd: string; input: ReturnType<typeof parseArgs>; options: { cwd: string; executable: string; prefixArgs: string[]; env: NodeJS.ProcessEnv } }) => Promise<void>) {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-opus-'));
  await withCleanup(async () => {
    execFileSync('git', ['init', '-q'], { cwd });
    writeFileSync(join(cwd, '.gitignore'), '.loomake/\n');
    execFileSync('git', ['add', '.gitignore'], { cwd });
    execFileSync('git', ['-c', 'user.name=Delivery test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], { cwd });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    mkdirSync(join(cwd, '.loomake'));
    const request = join(cwd, '.loomake/request.md');
    writeFileSync(request, '依頼の目印');
    const fixture = join(cwd, '.loomake/fake.mjs');
    writeFileSync(fixture, `import {writeFileSync} from 'node:fs';
const args=process.argv.slice(2); const id=args[args.indexOf('--session-id')+1];
writeFileSync('.loomake/pid', String(process.pid));
writeFileSync('.loomake/called', 'yes');
writeFileSync('.loomake/env.json', JSON.stringify({memory:process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, preserved:process.env.DELIVERY_TEST_SENTINEL}));
let request=''; for await (const chunk of process.stdin) request+=chunk;
const mode=process.env.DELIVERY_TEST_MODE;
if(mode==='timeout') { setInterval(()=>{},1000); }
else if(mode==='output') { process.stdout.write('x'.repeat(65536)); setInterval(()=>{},1000); }
else {
 if(mode==='dirty') writeFileSync('unexpected.txt','changed');
 const init={type:'system',subtype:'init',session_id:id,model:'claude-opus-test',tools:['Read','Glob','Grep'],mcp_servers:[],apiKeySource:'none'};
 const result={type:'result',subtype:'success',is_error:false,session_id:id,result:'回答の目印',modelUsage:{'claude-opus-test':{}},permission_denials:[]};
 console.log(JSON.stringify(init)); console.log(JSON.stringify(result));
 if(mode==='exit') process.exitCode=3;
}
`);
    await check({ cwd, input: { role: 'design', request, head, timeoutMs: 3000 },
      options: { cwd, executable: process.execPath, prefixArgs: [fixture], env: { ...process.env, DELIVERY_TEST_MODE: mode, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0', DELIVERY_TEST_SENTINEL: 'kept' } } });
  }, () => rmSync(cwd, { recursive: true, force: true }));
}

describe('deliveryのClaude起動', () => {
  it('assertion・所有子cleanup・外側rmの失敗をすべて保持する', async () => {
    const assertion = new Error('assertion');
    const ownedCleanup = new Error('owned cleanup');
    const removal = new Error('rm');
    const failure: unknown = await withCleanup(
      () => withCleanup(() => { throw assertion; }, () => { throw ownedCleanup; }),
      () => { throw removal; },
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    if (!(failure instanceof AggregateError)) throw new Error('外側の失敗集約が必要です。');
    expect(failure.errors[1]).toBe(removal);
    const inner: unknown = failure.errors[0];
    expect(inner).toBeInstanceOf(AggregateError);
    if (!(inner instanceof AggregateError)) throw new Error('内側の失敗集約が必要です。');
    expect(inner.errors).toEqual([assertion, ownedCleanup]);
    await expect(withCleanup(() => {}, () => { throw removal; })).rejects.toBe(removal);
  });
  it('fixtureの所有子を停止してから削除できる', async () => {
    await withRepo('timeout', async ({ cwd, input, options }) => {
      const child = spawn(options.executable, options.prefixArgs, {
        cwd, env: options.env, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'ignore', 'ignore'],
      });
      const closed = once(child, 'close');
      await withCleanup(async () => {
        await once(child, 'spawn');
        child.stdin!.end();
        const deadline = Date.now() + input.timeoutMs;
        while (!existsSync(join(cwd, '.loomake/called')) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
        expect(existsSync(join(cwd, '.loomake/called'))).toBe(true);
        const pid = readFakePid(cwd);
        expect(pid).toBe(child.pid);
        expect(alive(pid!)).toBe(true);
        await stopOwnedFake(cwd, input.timeoutMs);
        await closed;
        expect(alive(pid!)).toBe(false);
      }, async () => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        await closed;
      });
    });
  });
  if (process.platform === 'win32') {
    it('Windowsのfixture引数が一致しないPIDへ停止命令を出さない', async () => {
      await withRepo('timeout', async ({ cwd, input }) => {
        const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd, shell: false, stdio: 'ignore' });
        const closed = once(child, 'close');
        await withCleanup(async () => {
          await once(child, 'spawn');
          writeFileSync(join(cwd, '.loomake/pid'), String(child.pid));
          await expect(stopOwnedFake(cwd, input.timeoutMs)).rejects.toThrow('所有する偽プロセスを確認・停止できませんでした。');
          expect(alive(child.pid!)).toBe(true);
        }, async () => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
          await closed;
        });
      });
    });
  }
  it('成果物を保存し、返す要約に依頼や回答の本文を混ぜない', async () => {
    await withRepo('success', async ({ cwd, input, options }) => {
      const result = await askOpus(input, options);
      expect(result.ok).toBe(true);
      expect(JSON.parse(readFileSync(join(cwd, '.loomake/env.json'), 'utf8'))).toEqual({ memory: '1', preserved: 'kept' });
      expect(JSON.stringify(result)).not.toMatch(/依頼の目印|回答の目印/);
      expect(result.dir).toBeTruthy();
      const dir = result.dir!;
      expect(readFileSync(join(dir, 'request.md'), 'utf8')).toContain('依頼の目印');
      expect(readFileSync(join(dir, 'result.md'), 'utf8')).toBe('回答の目印');
      expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toMatchObject({ ok: true, head: input.head });
    });
  });
  it('head不一致・未コミット変更ではClaudeを起動しない', async () => {
    await withRepo('success', async ({ cwd, input, options }) => {
      expect((await askOpus({ ...input, head: 'a'.repeat(40) }, options)).ok).toBe(false);
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
      writeFileSync(join(cwd, 'dirty.txt'), 'dirty');
      expect((await askOpus(input, options)).ok).toBe(false);
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
    });
  });
  it.each([
    ['timeout', '実行時間', { timeoutMs: 100 }, {}],
    ['output', '出力', {}, { maxOutputBytes: 1024 }],
    ['dirty', '未コミット', {}, {}],
    ['exit', '終了コード', {}, {}],
  ])('%sの工程を未実施として保存する', async (mode, reason, changeInput, changeOptions) => {
    await withRepo(mode, async ({ input, options }) => {
      const result = await askOpus({ ...input, ...changeInput }, { ...options, ...changeOptions });
      expect(result).toMatchObject({ ok: false, status: '未実施' });
      if (!('reason' in result)) throw new Error('失敗結果が必要です');
      expect(result.reason).toContain(reason);
      expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
    });
  });

  it('除外されていない保存先では正しい理由を返し、ディレクトリも作らない', async () => {
    await withRepo('success', async ({ cwd, input, options }) => {
      writeFileSync(join(cwd, '.gitignore'), '');
      execFileSync('git', ['add', '.gitignore'], { cwd });
      execFileSync('git', ['-c', 'user.name=Delivery test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'unignore'], { cwd });
      writeFileSync(join(cwd, '.git/info/exclude'), '.loomake/request.md\n.loomake/fake.mjs\n');
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
      expect(await askOpus({ ...input, head }, options)).toMatchObject({ ok: false, dir: null, reason: '成果物の保存先がGitの除外対象になっていません。' });
      expect(existsSync(join(cwd, '.loomake/claude'))).toBe(false);
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
    });
  });
  it.each([['空', '', '空'], ['上限超過', 'x'.repeat(200 * 1024 + 1), '200KiB']])('%sの依頼は起動前に拒む', async (_name, content, reason) => {
    await withRepo('success', async ({ cwd, input, options }) => {
      writeFileSync(input.request, content);
      expect(await askOpus(input, options)).toMatchObject({ ok: false, dir: null, reason: expect.stringContaining(reason) });
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
    });
  });
  it('通常ファイルではないディレクトリの依頼を読取前に拒む', async () => {
    await withRepo('success', async ({ cwd, input, options }) => {
      rmSync(input.request);
      mkdirSync(input.request);
      expect(await askOpus(input, options)).toMatchObject({ ok: false, dir: null, reason: '依頼ファイルには通常ファイルを指定してください。' });
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
      expect(existsSync(join(cwd, '.loomake/claude'))).toBe(false);
    });
  });
  if (process.platform !== 'win32') {
    it('通常ファイルではないFIFOの依頼を期限内に拒みClaudeを起動しない', async () => {
      await withRepo('success', async ({ cwd, input, options }) => {
        rmSync(input.request);
        execFileSync('mkfifo', [input.request]);
        const modulePath = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
        const code = `import {askOpus} from ${JSON.stringify(pathToFileURL(modulePath).href)};
console.log(JSON.stringify(await askOpus(${JSON.stringify({ ...input, timeoutMs: 100 })},${JSON.stringify({ ...options, env: undefined })})));`;
        const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
          cwd, env: options.env, encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL',
        });
        expect(child.error).toBeUndefined();
        expect(child.signal).toBeNull();
        expect(child.status).toBe(0);
        expect(JSON.parse(child.stdout)).toMatchObject({ ok: false, dir: null, reason: '依頼ファイルには通常ファイルを指定してください。' });
        expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
        expect(existsSync(join(cwd, '.loomake/claude'))).toBe(false);
      });
    });
  }
  it('ツリー外、接頭辞が似た隣接ディレクトリ、外向きsymlinkの依頼を起動前に拒む', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'loomake-outside-'));
    try {
      const externalRequest = join(outside, 'request.md');
      writeFileSync(externalRequest, '無害な試験用の依頼');
      await withRepo('success', async ({ cwd, input, options }) => {
        const linkedRequest = join(cwd, '.loomake/linked.md');
        symlinkSync(externalRequest, linkedRequest);
        mkdirSync(join(cwd, '.loomake-sibling'));
        writeFileSync(join(cwd, '.loomake-sibling/request.md'), '無害な試験用の依頼');
        writeFileSync(join(cwd, '.git/info/exclude'), '.loomake-sibling/\n');
        for (const request of [externalRequest, linkedRequest, '.loomake-sibling/request.md']) {
          expect(await askOpus({ ...input, request }, options)).toMatchObject({ ok: false, dir: null, reason: expect.stringContaining('実パス') });
          expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
        }
      });
      await withRepo('success', async ({ cwd, input, options }) => {
        rmSync(join(cwd, '.loomake'), { recursive: true });
        symlinkSync(outside, join(cwd, '.loomake'), 'junction');
        writeFileSync(join(cwd, '.git/info/exclude'), '.loomake\n');
        expect(await askOpus(input, options)).toMatchObject({ ok: false, dir: null, reason: expect.stringContaining('実パス') });
      });
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
  it('成果物ディレクトリの外向きsymlinkへ書き込まない', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'loomake-output-'));
    try {
      await withRepo('success', async ({ cwd, input, options }) => {
        symlinkSync(outside, join(cwd, '.loomake/claude'), 'junction');
        expect(await askOpus(input, options)).toMatchObject({ ok: false, dir: null, reason: expect.stringContaining('実パス') });
        expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
      });
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });
  it('Claudeが見つからない場合は未実施を保存する', async () => {
    await withRepo('success', async ({ cwd, input, options }) => {
      const result = await askOpus(input, { ...options, executable: join(cwd, '.loomake/not-installed'), prefixArgs: [] });
      expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('起動できません') });
      expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8')).exitCode).not.toBe(0);
    });
  });
  async function checkInterrupted(trigger: string) {
    await withRepo('timeout', async ({ cwd, input, options }) => {
      await withCleanup(async () => {
        const modulePath = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
        const code = `import {askOpus} from ${JSON.stringify(pathToFileURL(modulePath).href)};
import {existsSync} from 'node:fs';
const timer=setInterval(()=>{if(existsSync('.loomake/called')) {clearInterval(timer);${trigger};}},10);
console.log(JSON.stringify(await askOpus(${JSON.stringify(input)},${JSON.stringify({ ...options, env: undefined })})));
clearInterval(timer);`;
        const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
          cwd, env: options.env, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
        });
        expect(child.error).toBeUndefined();
        expect(child.signal).toBeNull();
        expect(child.status, child.stderr).toBe(0);
        const result = JSON.parse(child.stdout);
        expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('中断') });
        expect(JSON.parse(readFileSync(join(result.dir, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
        const pid = readFakePid(cwd);
        expect(pid).toBeDefined();
        expect(alive(pid!)).toBe(false);
      }, () => stopOwnedFake(cwd, input.timeoutMs));
    });
  }
  it('SIGINTイベントで子プロセスを止め、未実施を保存する', () => checkInterrupted("process.emit('SIGINT')"));
  it.skipIf(process.platform === 'win32')('SIGINTで子プロセスを止め、未実施を保存する', () => checkInterrupted("process.kill(process.pid,'SIGINT')"));

  it('CLIの正常な実行はJSON要約と終了コード0を返す（Windows npm版は未対応）', async () => {
    await withRepo('success', async ({ cwd, input }) => {
      const bin = join(cwd, '.loomake/bin');
      mkdirSync(bin);
      const executable = join(bin, process.platform === 'win32' ? 'claude.cmd' : 'claude');
      writeFileSync(executable, `#!${process.execPath}\n` + readFileSync(join(cwd, '.loomake/fake.mjs'), 'utf8'));
      chmodSync(executable, 0o700);
      const script = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
      const child = spawnSync(process.execPath, [script, '--role', input.role, '--request', input.request, '--head', input.head], {
        cwd, encoding: 'utf8', timeout: 10000, env: { ...process.env, PATH: bin + (process.platform === 'win32' ? ';' : ':') + process.env.PATH },
      });
      if (process.platform === 'win32') {
        expect(child.status).toBe(1);
        expect(JSON.parse(child.stdout)).toMatchObject({ ok: false, status: '未実施' });
      } else {
        expect(child.status).toBe(0);
        expect(JSON.parse(child.stdout)).toMatchObject({ ok: true, status: '実施済み' });
        expect(child.stdout.trim().split('\n')).toHaveLength(1);
        expect(child.stdout).not.toMatch(/依頼の目印|回答の目印/);
      }
    });
  });
  it('CLIの不正引数はJSON要約と終了コード2を返す', () => {
    const script = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
    const result = spawnSync(process.execPath, [script, '--resume', 'old'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, status: '未実施' });
  });
});
