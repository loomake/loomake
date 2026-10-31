import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, fsyncSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { askOpus, buildClaudeArgs, evaluatePriorEvents, parseArgs } from '../.agents/skills/delivery/scripts/ask-opus.mjs';

const independent = '独立した観測結果です。\n比較前の見解。';
const prior = 'PRIOR_ONLY_SENTINEL: 先行担当の仮説';
const fixture = String.raw`
import {createInterface} from 'node:readline';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const args=process.argv.slice(2), id=args[args.indexOf('--session-id')+1], dir=args[args.indexOf('--add-dir')+1];
const mode=process.env.PRIOR_TEST_MODE;
const view='独立した観測結果です。\n比較前の見解。';
const init=()=>({type:'system',subtype:'init',session_id:id,model:'claude-opus-test',tools:['Read','Glob','Grep'],mcp_servers:[]});
const assistant=(model='claude-opus-test')=>({type:'assistant',session_id:id,message:{model,content:[{type:'text',text:view}]}});
const result=(text)=>({type:'result',subtype:'success',is_error:false,session_id:id,result:text,modelUsage:{'claude-opus-test':{}},permission_denials:[]});
const send=items=>process.stdout.write(items.map(item=>JSON.stringify(item)).join('\n')+'\n');
writeFileSync('.loomake/called','yes');
let turn=0;
for await(const line of createInterface({input:process.stdin})) {
 const input=JSON.parse(line); turn++;
 if(turn===1) {
  writeFileSync('.loomake/first-prompt',input.message.content);
  if(mode==='timeout-first') {setInterval(()=>{},1000);continue;}
  if(mode==='output') {process.stdout.write('x'.repeat(65536));setInterval(()=>{},1000);continue;}
  if(mode==='invalid-json') {process.stdout.write('invalid\n');setInterval(()=>{},1000);continue;}
  if(mode==='save-fail') mkdirSync(join(dir,'independent-view.md'));
  if(mode==='dirty') writeFileSync('unexpected.txt','dirty');
  const events=[init(),assistant(),result(view)];
  if(mode==='first-order') [events[0],events[1]]=[events[1],events[0]];
  if(mode==='first-error') events[2].is_error=true;
  if(mode==='first-denied') events[2].permission_denials=[{tool_name:'Read'}];
  if(mode==='first-model') events[1].message.model='claude-sonnet-test';
  if(mode==='first-session') events[1].session_id='wrong-session';
  if(mode==='first-usage') events[2].modelUsage={};
  if(mode==='prior-first') events.splice(2,0,{type:'assistant',session_id:id,message:{model:'claude-opus-test',content:[{type:'tool_use',name:'Read',input:{file_path:'.loomake/prior/hypothesis.md'}}]}});
  if(mode==='windows-prior-directory') events.splice(2,0,{type:'assistant',session_id:id,message:{model:'claude-opus-test',content:[{type:'tool_use',name:'Read',input:{file_path:'.loomake\\prior\\other.md'}}]}});
  if(mode==='common-name') events.splice(2,0,{type:'assistant',session_id:id,message:{model:'claude-opus-test',content:[{type:'tool_use',id:'agents-read',name:'Read',input:{file_path:'AGENTS.md'}}]}},{type:'user',session_id:id,message:{content:[{type:'tool_result',tool_use_id:'agents-read',content:'規約本文です。'}]}});
  if(mode==='docs-read') events.splice(2,0,{type:'assistant',session_id:id,message:{model:'claude-opus-test',content:[{type:'tool_use',id:'docs-read',name:'Read',input:{file_path:'docs/dev/agent-workflow.md'}}]}},{type:'user',session_id:id,message:{content:[{type:'tool_result',tool_use_id:'docs-read',content:'使用例: --prior .loomake/prior/hypothesis.md'}]}});
  if(mode==='glob-leak') events.splice(2,0,{type:'user',session_id:id,message:{content:[{type:'tool_result',content:'.loomake/prior/hypothesis.md'}]}});
  if(mode==='split') {
   const raw=Buffer.from(events.map(item=>JSON.stringify(item)).join('\n')+'\n');
   const boundary=raw.lastIndexOf(Buffer.from('独'))+1;
   process.stdout.write(raw.subarray(0,boundary));
   await new Promise(resolve=>setTimeout(resolve,10));
   process.stdout.write(raw.subarray(boundary));
  } else send(events);
  if(mode==='one-result') process.exit(0);
 } else {
  writeFileSync('.loomake/prior-received','yes');
  const file=join(dir,'independent-view.md');
  writeFileSync('.loomake/order-ok',String(existsSync(file)&&readFileSync(file,'utf8')===view));
  writeFileSync('.loomake/second-prompt',input.message.content);
  if(mode==='timeout-second') {setInterval(()=>{},1000);continue;}
  const events=[init(),assistant(),result('比較と修正方針です。')];
  if(mode==='second-order') [events[0],events[1]]=[events[1],events[0]];
  if(mode==='second-opus-model') events[1].message.model='claude-opus-other';
  if(mode==='second-init-model') events[0].model='claude-opus-other';
  if(mode==='second-tools') events[0].tools=['Read'];
  if(mode==='second-error') events[2].is_error=true;
  if(mode==='second-denied') events[2].permission_denials=[{tool_name:'Read'}];
  if(mode==='second-model') events[1].message.model='claude-sonnet-test';
  if(mode==='second-session') events[1].session_id='wrong-session';
  if(mode==='second-usage') events[2].modelUsage={};
  if(mode==='extra-result') events.push(result('余分な回答'));
  send(events);
 }
}
`;

async function withPrior(mode: string, check: (f: {
  cwd: string;
  input: { role: string; request: string; head: string; timeoutMs: number; prior: string };
  options: { cwd: string; executable: string; prefixArgs: string[]; env: NodeJS.ProcessEnv };
}) => Promise<void>) {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-opus-prior-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd });
    writeFileSync(join(cwd, '.gitignore'), '.loomake/\n');
    execFileSync('git', ['add', '.gitignore'], { cwd });
    execFileSync('git', ['-c', 'user.name=Delivery test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], { cwd });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    mkdirSync(join(cwd, '.loomake/prior'), { recursive: true });
    writeFileSync(join(cwd, '.loomake/request.md'), '仕様と観測事実だけです。');
    writeFileSync(join(cwd, '.loomake/prior/hypothesis.md'), prior);
    writeFileSync(join(cwd, '.loomake/fake.mjs'), fixture);
    await check({ cwd, input: { role: 'second-opinion', request: '.loomake/request.md', prior: '.loomake/prior/hypothesis.md', head, timeoutMs: 3000 },
      options: { cwd, executable: process.execPath, prefixArgs: [join(cwd, '.loomake/fake.mjs')], env: { ...process.env, PRIOR_TEST_MODE: mode } } });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}

function expectUnsent(cwd: string) {
  expect(existsSync(join(cwd, '.loomake/prior-received'))).toBe(false);
}

describe('独立見解の保存後に同じOpusへ先行仮説を渡す', () => {
  it('second-opinionだけにpriorを許可し、重複と別roleを拒む', () => {
    const args = ['--role', 'second-opinion', '--request', 'request', '--head', 'a'.repeat(40), '--prior', 'prior'];
    expect(parseArgs(args)).toMatchObject({ role: 'second-opinion', prior: 'prior' });
    for (const role of ['design', 'review']) expect(() => parseArgs(['--role', role, ...args.slice(2)])).toThrow('second-opinion');
    expect(() => parseArgs([...args, '--prior', 'other'])).toThrow();
  });

  it('prior時だけstream入力とpriorディレクトリのRead拒否を加える', () => {
    const args = buildClaudeArgs('session', '/request', true);
    expect(args.slice(-2)).toEqual(['--input-format', 'stream-json']);
    const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
    expect(settings).toEqual({ disableAllHooks: true, autoMemoryEnabled: false, permissions: { blockReadsOutsideWorkingDirectories: true, deny: ['Read(./.loomake/prior/**)'] } });
    expect(args).toContain('--no-session-persistence');
    expect(args).not.toContain('--resume');
  });

  it.each(['success', 'split', 'docs-read', 'common-name'])('%s: 保存・fsyncしてから第二入力を送り、本文を要約へ出さない', async (mode) => {
    await withPrior(mode, async ({ cwd, input, options }) => {
      if (mode === 'common-name') { input.prior = '.loomake/prior/AGENTS.md'; writeFileSync(join(cwd, input.prior), prior); }
      let syncCalls = 0;
      const result = await askOpus(input, { ...options, syncIndependentView: (fd: number) => { syncCalls++; fsyncSync(fd); } });
      expect(result).toMatchObject({ ok: true, turns: 2, sessionId: expect.any(String), independentViewSavedAt: expect.any(String), priorSentAt: expect.any(String) });
      expect(syncCalls).toBe(process.platform === 'win32' ? 1 : 2);
      expect(readFileSync(join(cwd, '.loomake/order-ok'), 'utf8')).toBe('true');
      expect(readFileSync(join(cwd, '.loomake/first-prompt'), 'utf8')).not.toContain(prior);
      expect(readFileSync(join(cwd, '.loomake/second-prompt'), 'utf8')).toContain(prior);
      expect(readFileSync(join(result.dir!, 'independent-view.md'), 'utf8')).toBe(independent);
      expect(readFileSync(join(result.dir!, 'result.md'), 'utf8')).toBe('比較と修正方針です。');
      expect(JSON.stringify(result)).not.toMatch(/PRIOR_ONLY_SENTINEL|独立した観測|比較と修正方針/);
      expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8'))).toMatchObject({ ok: true, turns: 2 });
    });
  });

  it.each([
    ['prior-first', '先行仮説'], ['windows-prior-directory', '先行仮説'], ['glob-leak', '先行仮説'], ['first-error', '成功結果'], ['first-denied', '権限拒否'],
    ['first-model', 'Opus以外'], ['first-order', '開始情報'], ['first-session', 'セッション'], ['first-usage', 'modelUsage'], ['save-fail', '保存'],
    ['dirty', '未コミット'], ['invalid-json', 'JSON'],
  ])('%s: 第一段階で失敗したら仮説を送らない', async (mode, reason) => {
    await withPrior(mode, async ({ cwd, input, options }) => {
      const result = await askOpus(input, options);
      expect(result).toMatchObject({ ok: false, reason: expect.stringContaining(reason) });
      expectUnsent(cwd);
      expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
    });
  });

  it.each(process.platform === 'win32' ? [1] : [1, 2])('%d回目のfsync自体が失敗したら仮説を送らず未実施にする', async (failAt) => {
    await withPrior('success', async ({ cwd, input, options }) => {
      let calls = 0;
      const result = await askOpus(input, { ...options, syncIndependentView: (fd: number) => { calls++; if (calls === failAt) throw new Error('injected fsync failure'); fsyncSync(fd); } });
      expect(calls).toBe(failAt);
      expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('保存') });
      expectUnsent(cwd);
    });
  });

  it.each(['second-error', 'second-denied', 'second-model', 'second-opus-model', 'second-order', 'second-init-model', 'second-tools', 'second-session', 'second-usage', 'extra-result', 'one-result'])('%s: 二段階全体が成功しなければ未実施にする', async (mode) => {
    await withPrior(mode, async ({ input, options }) => {
      expect(await askOpus(input, options)).toMatchObject({ ok: false, status: '未実施' });
    });
  });

  it.each(['timeout-first', 'timeout-second'])('%s: 二段階共通の期限で止める', async (mode) => {
    await withPrior(mode, async ({ cwd, input, options }) => {
      expect(await askOpus({ ...input, timeoutMs: 1000 }, options)).toMatchObject({ ok: false, reason: expect.stringContaining('上限') });
      if (mode === 'timeout-second') expect(readFileSync(join(cwd, '.loomake/prior-received'), 'utf8')).toBe('yes');
      else expectUnsent(cwd);
    });
  });

  it('二段階でも出力量の上限を保つ', async () => {
    await withPrior('output', async ({ input, options }) => {
      expect(await askOpus(input, { ...options, maxOutputBytes: 1024 })).toMatchObject({ ok: false, reason: expect.stringContaining('出力') });
    });
  });

  it.each(['outside', 'empty', 'directory', 'large', 'same', 'symlink'])('%sのpriorを起動前に拒む', async (mode) => {
    await withPrior('success', async ({ cwd, input, options }) => {
      let path = join(cwd, input.prior);
      if (mode === 'outside') { path = join(cwd, '.loomake/outside.md'); writeFileSync(path, prior); }
      if (mode === 'empty') writeFileSync(path, '');
      if (mode === 'large') writeFileSync(path, 'x'.repeat(200 * 1024 + 1));
      if (mode === 'directory') path = join(cwd, '.loomake/prior');
      if (mode === 'same') input.request = input.prior;
      if (mode === 'symlink') {
        const outside = join(cwd, '.loomake/outside.md'); writeFileSync(outside, prior);
        path = join(cwd, '.loomake/prior/link.md'); symlinkSync(outside, path);
      }
      expect(await askOpus({ ...input, prior: path }, options)).toMatchObject({ ok: false });
      expect(existsSync(join(cwd, '.loomake/called'))).toBe(false);
    });
  });

  it.each(['first', 'second'])('%s段階でassistantより後のinitを拒む', (phase) => {
    const id = 'session';
    const turn = (text: string) => [
      { type: 'system', subtype: 'init', session_id: id, model: 'claude-opus-test', tools: ['Read'], mcp_servers: [] },
      { type: 'assistant', session_id: id, message: { model: 'claude-opus-test' } },
      { type: 'result', session_id: id, subtype: 'success', is_error: false, result: text, permission_denials: [], modelUsage: { 'claude-opus-test': {} } },
    ];
    const first = turn('first');
    const second = turn('second');
    const target = phase === 'first' ? first : second;
    [target[0], target[1]] = [target[1], target[0]];
    expect(() => evaluatePriorEvents([...first, ...second].map(event => JSON.stringify(event)).join('\n'), id)).toThrow('開始情報');
  });

  it('独立評価の単一段階検証を各段階に掛け、余分なinitを受理しない', () => {
    const id = 'session';
    const turn = (text: string) => [
      { type: 'system', subtype: 'init', session_id: id, model: 'claude-opus-test', tools: ['Read'], mcp_servers: [] },
      { type: 'assistant', session_id: id, message: { model: 'claude-opus-test' } },
      { type: 'result', session_id: id, subtype: 'success', is_error: false, result: text, permission_denials: [], modelUsage: { 'claude-opus-test': {} } },
    ];
    const encode = (items: unknown[]) => items.map(item => JSON.stringify(item)).join('\n');
    expect(evaluatePriorEvents(encode([...turn('first'), ...turn('second')]), id)).toMatchObject({ result: 'second', independentResult: 'first', turns: 2 });
    const first = turn('first'); first.splice(1, 0, first[0]);
    expect(() => evaluatePriorEvents(encode([...first, ...turn('second')]), id)).toThrow('不足・重複');
  });
});
