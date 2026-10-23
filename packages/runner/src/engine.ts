import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { UsageError } from '@loomake/kit';
import { StringDecoder } from 'node:string_decoder';
import { DEFAULT_MAX_OUTPUT_BYTES } from './config.js';
import { createDiagnosticRedactor } from './mask.js';

/** 初版で使えるエンジン（REQ-101） */
export { DEFAULT_MAX_OUTPUT_BYTES } from './config.js';

export const ENGINES = ['claude-code'] as const;
export type EngineName = (typeof ENGINES)[number];

/** 権限確認なしで動かすときに、通信を許可しておくドメインの既定（add-run-loop の確認事項 Q-04） */
export const DEFAULT_ALLOWED_DOMAINS = ['registry.npmjs.org', 'github.com', 'api.github.com', 'objects.githubusercontent.com', 'api.anthropic.com'];

export type EngineResult = {
  /** エンジンが返した本文。JSON の出力なら result の値、そうでなければ標準出力のまま */
  text: string;
  /** 標準出力の全体（記録用） */
  raw: string;
  exitCode: number | null;
  /** 時間の上限で止めたか */
  timedOut: boolean;
  /** 中断で止めたか */
  aborted: boolean;
  /** 出力が予算を超えて停止したか。 */
  outputLimitExceeded?: boolean;
};

export type EngineCall = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  prompt: string;
  /** 許可する Bash のコマンド（loomake.config.json の commands） */
  commands: string[];
  skipPermissions: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  /** stderrの転送先。省略するとprocess.stderrへ転送する。 */
  onStderr?: (text: string) => void;
};

const isWindows = process.platform === 'win32';
// Windows では npm で入れた claude は claude.cmd なので、シェル経由で呼ぶ。引数は二重引用符で囲む
const quote = (a: string) => (isWindows ? `"${a.replace(/"/g, '""')}"` : a);

/** claude コマンドがあるかを確かめ、なければ UsageError を投げる */
export function assertEngineAvailable(engine: string, env: NodeJS.ProcessEnv): asserts engine is EngineName {
  if (!(ENGINES as readonly string[]).includes(engine)) {
    throw new UsageError(`知らないエンジンです：${engine}。初版で使えるのは ${ENGINES.join('・')} だけです`);
  }
  const r = spawnSync('claude', ['--version'], { env, encoding: 'utf8', shell: isWindows });
  if (r.error || r.status !== 0) {
    throw new UsageError('claude コマンドが見つかりません。Claude Code を入れてから実行してください（npm install -g @anthropic-ai/claude-code）');
  }
}

/** Claude Code の headless 実行の引数（REQ-101・REQ-121） */
export function claudeArgs(commands: string[], skipPermissions: boolean): string[] {
  const base = ['-p', '--output-format', 'json'];
  if (skipPermissions) return [...base, '--dangerously-skip-permissions'];
  // ふだんは、ファイルの読み書きと commands の実行だけを許可する（add-run-loop の確認事項 Q-05）
  const tools = ['Read', 'Edit', 'Write', 'Glob', 'Grep', ...commands.map((c) => `Bash(${c}:*)`)];
  return [...base, '--permission-mode', 'acceptEdits', '--allowedTools', ...tools];
}

/** エンジンと子孫を停止し、POSIXでは猶予後にグループ全体を強制終了する。 */
function stop(child: ChildProcess): Promise<void> {
  if (isWindows && child.pid !== undefined) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    return Promise.resolve();
  }
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      if (child.pid !== undefined) process.kill(-child.pid, signal);
    } catch {
      // すでに終了したプロセスグループは停止済みとして扱う。
    }
  };
  killGroup('SIGTERM');
  return new Promise((resolve) => setTimeout(() => { killGroup('SIGKILL'); resolve(); }, 250));
}

/** Claude Code を呼び、指示を標準入力で渡す。時間の上限か中断で止める */
export function runClaude(call: EngineCall): Promise<EngineResult> {
  const maxOutputBytes = call.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) throw new UsageError('エンジンの出力上限は正の安全な整数にしてください');
  if (call.signal?.aborted) return Promise.resolve({ text: '', raw: '', exitCode: null, timedOut: false, aborted: true });
  return new Promise((resolve) => {
    const child = spawn('claude', claudeArgs(call.commands, call.skipPermissions).map(quote), {
      cwd: call.cwd,
      env: call.env,
      shell: isWindows,
      detached: !isWindows,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let raw = '';
    let timedOut = false;
    let aborted = false;
    let stopping: Promise<void> | undefined;
    let outputBytes = 0;
    let outputLimitExceeded = false;
    const accept = (data: string, sink: (text: string) => void) => {
      if (outputLimitExceeded) return;
      const bytes = Buffer.from(data, 'utf8');
      const left = maxOutputBytes - outputBytes;
      const retained = bytes.subarray(0, left);
      outputBytes += retained.length;
      const text = new StringDecoder('utf8').write(retained);
      if (text) sink(text);
      if (bytes.length > left) {
        outputLimitExceeded = true;
        stopping ??= stop(child);
      }
    };
    const diagnostics = createDiagnosticRedactor(call.onStderr ?? ((text) => { process.stderr.write(text); }));
    child.stdout.setEncoding('utf8').on('data', (data: string) => accept(data, (text) => { raw += text; }));
    child.stderr.setEncoding('utf8').on('data', (data: string) => accept(data, diagnostics.write));
    const timer = setTimeout(() => {
      timedOut = true;
      stopping ??= stop(child);
    }, Math.max(call.timeoutMs, 0));
    const onAbort = () => {
      aborted = true;
      stopping ??= stop(child);
    };
    call.signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', () => {});
    if (call.signal?.aborted) onAbort();
    child.on('close', async (code) => {
      clearTimeout(timer);
      call.signal?.removeEventListener('abort', onAbort);
      await stopping;
      diagnostics.end();
      let text = raw;
      try {
        const json = JSON.parse(raw) as { result?: unknown };
        if (typeof json.result === 'string') text = json.result;
      } catch {
        // JSON でなければ標準出力をそのまま使う
      }
      resolve({ text, raw, exitCode: code, timedOut, aborted, outputLimitExceeded });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(call.prompt);
  });
}
