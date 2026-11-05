import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { expect, it } from 'vitest';
import { runClaude } from '../src/engine.js';
import { killOwnedProcess } from './process-state.js';

// 通常終了後の保証は POSIX のみ。時間切れと中断は全 OS で実プロセスを検査する。
const modes = process.platform === 'win32' ? ['timeout', 'abort'] as const : ['timeout', 'abort', 'normal'] as const;
it.each(modes)('[REQ-139][REQ-212] 別セッションの子が出力先を保持しても %s 後に戻る', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'loomake-escaped-output-'));
  const pidFile = join(root, 'child.pid');
  const controller = new AbortController();
  let watchdog: NodeJS.Timeout | undefined;
  let abort: NodeJS.Timeout | undefined;
  let pending: ReturnType<typeof runClaude> | undefined;
  try {
    const descendant = "const fs=require('node:fs');fs.writeFileSync('child.pid',String(process.pid));setInterval(()=>{},1000);";
    const source = `#!/usr/bin/env node
const fs=require('node:fs');
require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{detached:true,stdio:['ignore',1,2]});
const ready=setInterval(()=>{
  if(!fs.existsSync('child.pid'))return;
  clearInterval(ready);
  process.stdout.write('{"result":"parent output"}',()=>{
  fs.writeFileSync('ready','yes');
  ${mode === 'normal' ? 'process.exit(0);' : 'setInterval(()=>{},1000);'}
  });
},5);
`;
    const entry = join(root, 'claude');
    writeFileSync(entry, source); chmodSync(entry, 0o755);
    writeFileSync(entry + '.cmd', '@node "%~dp0claude" %*\r\n');
    pending = runClaude({ cwd: root, env: { ...process.env, PATH: root + delimiter + (process.env.PATH ?? '') }, prompt: '', commands: [], skipPermissions: false, timeoutMs: mode === 'timeout' ? 750 : 10000, signal: controller.signal });
    if (mode === 'abort') {
      const waitReady = () => {
        if (existsSync(join(root, 'ready'))) controller.abort();
        else abort = setTimeout(waitReady, 5);
      };
      waitReady();
    }
    const outcome = await Promise.race([
      pending.then(result => ({ result })),
      new Promise<{ watchdog: true }>(resolve => { watchdog = setTimeout(() => resolve({ watchdog: true }), 2500); }),
    ]);
    expect(outcome).toHaveProperty('result');
    if (!('result' in outcome)) throw new Error('出力の読み取りが完了しませんでした');
    expect(existsSync(join(root, 'ready'))).toBe(true);
    expect(outcome.result.timedOut).toBe(mode === 'timeout');
    expect(outcome.result.aborted).toBe(mode === 'abort');
    expect(outcome.result.raw).toBe('{"result":"parent output"}');
    if (mode === 'normal') expect(outcome.result.exitCode).toBe(0);
  } finally {
    clearTimeout(watchdog); clearTimeout(abort);
    controller.abort();
    if (existsSync(pidFile)) killOwnedProcess(Number(readFileSync(pidFile, 'utf8')));
    await pending;
    rmSync(root, { recursive: true, force: true });
  }
});
