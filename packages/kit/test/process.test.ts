import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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
    // macOS には /proc がない。止めた子の親（監視役）も止まっていると、launchd が回収するまでゾンビとして残り、kill(pid, 0) が通る
    // （main の run 40669766883 の macOS で、止めた子がこの状態で生きていると判定された）。ゾンビは ps の状態で見分ける
    if (process.platform === 'darwin') return !/^Z/.test(execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    return true;
  } catch { return false; }
}
// macOS の tmpdir は /var → /private/var のシンボリックリンクなので、子プロセスの cwd と比べられるよう実パスにする
function fixture(action: (dir: string) => void) { const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-process '))); try { action(dir); } finally { rmSync(dir, { recursive: true, force: true }); } }

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
    // 1 操作は単独なら予算内（1200ms < 2000ms）、2 操作の合計は予算を超える（2400ms > 2000ms）。
    // 監視役と子の起動の時間も期限に含めるので、1 つ目の操作には起動のための余裕を 800ms 残す
    withProcessBudget({ timeoutMs: 2000 }, () => {
      expect(call('setTimeout(()=>{},1200)').status).toBe(0);
      expect(() => call('setTimeout(()=>{},1200)')).toThrow('時間の上限');
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
    catch (error) {
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect((error as ProcessLimitError).kind).toBe('interrupted');
      // POSIX では監視役が SIGINT を受けて結果を書くので、利用者の中断として理由を持たない。
      // Windows では SIGINT が強制終了になり、監視役が結果を書かずに終わった理由を持つ（REQ-250）
      if (process.platform !== 'win32') expect((error as ProcessLimitError).reason).toBeUndefined();
    }
    expect(alive(Number(readFileSync(file, 'utf8')))).toBe(false);
  }));
  it.runIf(process.platform !== 'win32')('[REQ-333] 監視役へのSIGHUPを理由のない中断として返し、子孫を止めて同じ予算の次を起動しない', () => fixture((dir) => {
    const parentFile = join(dir, 'parent');
    const leafFile = join(dir, 'leaf');
    const after = join(dir, 'after');
    const leaf = "const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},100)";
    const code = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(parentFile)},String(process.pid));process.on('SIGTERM',()=>{});require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)},'--',${JSON.stringify(leafFile)}],{stdio:'ignore'});`
      + `const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(leafFile)})){clearInterval(timer);process.kill(process.ppid,'SIGHUP');}},10);setInterval(()=>{},100)`;
    let leafPid: number | undefined;
    try {
      withProcessBudget({ timeoutMs: 20_000 }, () => {
        let error: unknown;
        try { call(code); } catch (caught) { error = caught; }
        leafPid = Number(readFileSync(leafFile, 'utf8'));
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('interrupted');
        expect((error as ProcessLimitError).reason).toBeUndefined();
        expect(alive(leafPid)).toBe(false);
        expect(() => call(`require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`)).toThrow('中断');
        expect(existsSync(after)).toBe(false);
      });
    } finally {
      if (existsSync(parentFile)) {
        const pid = Number(readFileSync(parentFile, 'utf8'));
        try { process.kill(-pid, 'SIGKILL'); } catch { /* 対象は停止済み */ }
      }
    }
  }));
  it('[REQ-181][REQ-250][REQ-337] 監視役が結果を書かずに終わったら、子孫を止め、理由を含む中断として返し、同じ予算で次を始めない', () => fixture((dir) => {
    const parentFile = join(dir, 'parent');
    const leafFile = join(dir, 'leaf');
    const after = join(dir, 'after');
    const leaf = `require('node:fs').writeFileSync(${JSON.stringify(leafFile)},String(process.pid));setInterval(()=>{},100)`;
    // 孫が起動したのを確かめてから、監視役を SIGKILL で止める。監視役は結果を書けない
    const code = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(parentFile)},String(process.pid));`
      + `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore'});`
      + `const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(leafFile)})){clearInterval(timer);process.kill(process.ppid,'SIGKILL');setInterval(()=>{},100);}},10)`;
    withProcessBudget({ timeoutMs: 20_000 }, () => {
      let error: unknown;
      try { call(code); } catch (e) { error = e; }
      expect(error).toBeInstanceOf(ProcessLimitError);
      expect(error).not.toBeInstanceOf(UsageError);
      expect((error as ProcessLimitError).kind).toBe('interrupted');
      expect((error as ProcessLimitError).reason).toContain('監視役が結果を書かずに終了しました');
      expect(String(error)).toContain('中断');
      expect(alive(Number(readFileSync(parentFile, 'utf8')))).toBe(false);
      expect(alive(Number(readFileSync(leafFile, 'utf8')))).toBe(false);
      expect(() => call(`require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`)).toThrow('中断');
      let nextError: unknown;
      try { call(`require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`); } catch (e) { nextError = e; }
      expect(nextError).toBeInstanceOf(ProcessLimitError);
      expect((nextError as ProcessLimitError).kind).toBe('interrupted');
      expect((nextError as ProcessLimitError).reason).toBe((error as ProcessLimitError).reason);
      expect((nextError as ProcessLimitError).cleanup).toBeUndefined();
      expect(existsSync(after)).toBe(false);
    });
  }));
});

it.runIf(process.platform !== 'win32')('[REQ-250][REQ-337] 利用者の中断のあとの後続の拒否はreasonを持たない', () => fixture((dir) => {
  const after = join(dir, 'after');
  const code = "process.kill(process.ppid,'SIGINT');setInterval(()=>{},100)";
  withProcessBudget({ timeoutMs: 20_000 }, () => {
    expect(() => call(code)).toThrow(ProcessLimitError);
    let nextError: unknown;
    try { call(`require('node:fs').writeFileSync(${JSON.stringify(after)},'x')`); } catch (e) { nextError = e; }
    expect(nextError).toBeInstanceOf(ProcessLimitError);
    expect((nextError as ProcessLimitError).kind).toBe('interrupted');
    expect((nextError as ProcessLimitError).reason).toBeUndefined();
    expect(existsSync(after)).toBe(false);
  });
}));

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
