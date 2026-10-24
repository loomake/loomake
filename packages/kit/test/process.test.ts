import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProcessLimitError, runExternal, withProcessBudget } from '../src/runtime/process.js';
import { RuntimeFailure, UsageError } from '../src/runtime/errors.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const call = (code: string, options: Parameters<typeof runExternal>[2] = {}) => runExternal(process.execPath, ['-e', code], options);
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch { return false; }
}
function fixture(action: (dir: string) => void) { const dir = mkdtempSync(join(tmpdir(), 'loomake-process ')); try { action(dir); } finally { rmSync(dir, { recursive: true, force: true }); } }

describe('同期外部操作の監視', () => {
  it('[REQ-180][REQ-183] 引数・cwd・環境・通常の終了とstdout/stderrを維持する', () => fixture((dir) => {
    const result = runExternal(process.execPath, ['-e', 'console.log(JSON.stringify([process.cwd(),process.argv[1],process.env.PROCESS_TEST])); console.error("err"); process.exit(7)', 'a b;$`あ'], { cwd: dir, env: { ...process.env, PROCESS_TEST: 'value' } });
    expect(result.status).toBe(7);
    expect(JSON.parse(result.stdout)).toEqual([dir, 'a b;$`あ', 'value']);
    expect(result.stderr).toBe('err\n');
    expect(result.error).toBeUndefined();
  }));
  it('[REQ-180][REQ-183] 上限内の大きな出力を最後まで転送する', () => {
    const result = call('process.stdout.write("a".repeat(1024*1024)); process.stderr.write("b".repeat(1024*1024))', { maxBuffer: 2 * 1024 * 1024 });
    expect(result.stdout).toBe('a'.repeat(1024 * 1024));
    expect(result.stderr).toBe('b'.repeat(1024 * 1024));
  });
  it('[REQ-180][REQ-183] 実行ファイルの不存在を制限と区別する', () => {
    const result = runExternal('loomake-missing-executable-req180', []);
    expect(result.status).toBeNull();
    expect(result.error?.code).toBe('ENOENT');
  });
  it('[REQ-180][REQ-181] 終わらない子を期限で止める', () => {
    const start = Date.now();
    expect(() => call('process.on("SIGTERM",()=>{}); setInterval(()=>{},100)', { timeoutMs: 200 })).toThrow(ProcessLimitError);
    expect(Date.now() - start).toBeLessThan(3000);
  });
  it('[REQ-180] 合計出力をバイト数で制限し理由を区別する', () => {
    try { call('process.stdout.write("あ".repeat(2000)); process.stderr.write("x".repeat(2000)); setInterval(()=>{},100)', { maxBuffer: 4096 }); expect.fail('上限を超えた'); }
    catch (error) {
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect((error as ProcessLimitError).kind).toBe('output');
      const e = error as ProcessLimitError;
      expect(Buffer.byteLength(e.stdout) + Buffer.byteLength(e.stderr)).toBeLessThanOrEqual(4096);
    }
  });
  it('[REQ-180][REQ-182] 操作間で残り時間を共有し、期限後は起動しない', () => fixture((dir) => {
    withProcessBudget({ timeoutMs: 350 }, () => {
      expect(call('setTimeout(()=>{},180)').status).toBe(0);
      expect(() => call('setTimeout(()=>{},180)')).toThrow('時間の上限');
      expect(() => call(`require('node:fs').writeFileSync(${JSON.stringify(join(dir, 'started'))},'x')`)).toThrow('時間の上限');
      expect(existsSync(join(dir, 'started'))).toBe(false);
    });
    expect(call('console.log("new")').stdout).toBe('new\n');
  }));
  it('[REQ-182] ネストで外側の期限を延ばさず、並行するスコープへ漏らさない', async () => {
    await Promise.all([
      withProcessBudget({ timeoutMs: 60 }, async () => { await new Promise((r) => setTimeout(r, 100)); expect(() => withProcessBudget({ timeoutMs: 5000 }, () => call(''))).toThrow('時間の上限'); }),
      withProcessBudget({ timeoutMs: 5000 }, async () => { await new Promise((r) => setTimeout(r, 130)); expect(call('console.log("ok")').stdout).toBe('ok\n'); }),
    ]);
  });
  it('[REQ-181][REQ-182] 中断後に同じ共有予算で別の操作を始めない', () => fixture((dir) => {
    const file = join(dir, 'after');
    withProcessBudget({ timeoutMs: 3000 }, () => {
      expect(() => call("process.kill(process.ppid,'SIGINT');setInterval(()=>{},100)")).toThrow('中断');
      expect(() => call(`require('node:fs').writeFileSync(${JSON.stringify(file)},'x')`)).toThrow('中断');
      expect(existsSync(file)).toBe(false);
    });
  }));
  it('[REQ-181] 親が先に終わっても出力を握る子孫を残さない', () => fixture((dir) => {
    const file = join(dir, 'pid');
    const leaf = `require('node:fs').writeFileSync(${JSON.stringify(file)},String(process.pid));setInterval(()=>{},100)`;
    const parent = `const fs=require('node:fs');require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'inherit'}); const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(file)})) process.exit(0)},10)`;
    const start = Date.now();
    expect(call(parent, { timeoutMs: 2000 }).status).toBe(0);
    expect(alive(Number(readFileSync(file, 'utf8')))).toBe(false);
    expect(Date.now() - start).toBeLessThan(3000);
  }));
  it('[REQ-181] 監視役へのSIGINTを中断として返し、子を止める', () => fixture((dir) => {
    const file = join(dir, 'pid');
    const code = `require('node:fs').writeFileSync(${JSON.stringify(file)},String(process.pid)); process.on('SIGTERM',()=>{});process.kill(process.ppid,'SIGINT');setInterval(()=>{},100)`;
    try { call(code); expect.fail('中断される'); }
    catch (error) { expect(error).toBeInstanceOf(ProcessLimitError); expect((error as ProcessLimitError).kind).toBe('interrupted'); }
    expect(alive(Number(readFileSync(file, 'utf8')))).toBe(false);
  }));
});

describe('実行時の失敗の型', () => {
  it('[REQ-192][REQ-180] 制限による停止は実行時の失敗で、使い方の誤りと区別する', () => {
    const error = new ProcessLimitError('timeout', 'git');
    expect(error).toBeInstanceOf(RuntimeFailure);
    expect(error).not.toBeInstanceOf(UsageError);
  });
});

describe('1 操作の期限を使わない外部操作', () => {
  it('[REQ-182] untilDeadline の操作は 1 操作の期限を超えても止めず、共有の期限で止める', () => {
    const wait = (ms: number) => ['-e', `setTimeout(()=>{},${ms})`];
    withProcessBudget({ timeoutMs: 5_000, maxOperationMs: 200 }, () => {
      expect(runExternal(process.execPath, wait(600), { untilDeadline: true }).status).toBe(0);
      expect(() => runExternal(process.execPath, wait(600))).toThrow(ProcessLimitError);
    });
    withProcessBudget({ timeoutMs: 300, maxOperationMs: 200 }, () => {
      expect(() => runExternal(process.execPath, wait(2_000), { untilDeadline: true })).toThrow(ProcessLimitError);
    });
  });
});
