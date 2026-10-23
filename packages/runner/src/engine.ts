import { spawn, spawnSync } from 'node:child_process';
import { UsageError } from '@loomake/kit';

/** 初版で使えるエンジン（REQ-101） */
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

/** Claude Code を呼び、指示を標準入力で渡す。時間の上限か中断で止める */
export function runClaude(call: EngineCall): Promise<EngineResult> {
  return new Promise((resolve) => {
    const child = spawn('claude', claudeArgs(call.commands, call.skipPermissions).map(quote), {
      cwd: call.cwd,
      env: call.env,
      shell: isWindows,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let raw = '';
    let timedOut = false;
    let aborted = false;
    child.stdout.setEncoding('utf8').on('data', (d: string) => (raw += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Math.max(call.timeoutMs, 0));
    const onAbort = () => {
      aborted = true;
      child.kill();
    };
    call.signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', () => {});
    child.on('close', (code) => {
      clearTimeout(timer);
      call.signal?.removeEventListener('abort', onAbort);
      let text = raw;
      try {
        const json = JSON.parse(raw) as { result?: unknown };
        if (typeof json.result === 'string') text = json.result;
      } catch {
        // JSON でなければ標準出力をそのまま使う
      }
      resolve({ text, raw, exitCode: code, timedOut, aborted });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(call.prompt);
  });
}
