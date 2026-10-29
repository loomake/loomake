import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    expect(args).toEqual(['--print', '--model', 'opus', '--permission-mode', 'plan', '--tools', 'Read,Glob,Grep', '--allowedTools', 'Read,Glob,Grep',
      '--setting-sources', '', '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false}', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
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

async function withRepo(mode: string, check: (fixture: { cwd: string; input: ReturnType<typeof parseArgs>; options: Parameters<typeof askOpus>[1] }) => Promise<void>) {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-opus-'));
  try {
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
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}

describe('deliveryのClaude起動', () => {
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
  it('CLIの不正引数はJSON要約と終了コード2を返す', () => {
    const script = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
    const result = spawnSync(process.execPath, [script, '--resume', 'old'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, status: '未実施' });
  });
});
