import { parseGhChecks, parseClaudeResult, parseCodexEvents, parseBiomeReport, parsePlaywrightReport } from '@loomake/core';
import type { ToolName, ToolObservation } from '@loomake/core';
import { runExternal, ProcessLimitError, type ExternalResult, type ProcessLimitKind } from '../runtime/process.js';
import { UsageError, RuntimeFailure } from '../runtime/errors.js';
import { maskSecrets, maskValue, createDiagnosticRedactor } from '../runtime/redact.js';

export type CollectRequest = {
  tool: ToolName; command: string; args: readonly string[]; cwd?: string; env?: NodeJS.ProcessEnv;
  timeoutMs: number; maxBuffer?: number;
};
export type CollectExit = { status: number | null; signal: NodeJS.Signals | null };
export type Collected = { tool: ToolName; diagnostics: string } & (
  | { outcome: 'parsed'; exit: CollectExit; observation: ToolObservation }
  | { outcome: 'unreadable'; exit: CollectExit; reason: string }
  | { outcome: 'not_found' | 'spawn_error'; reason: string }
  | { outcome: 'limited'; kind: ProcessLimitKind; reason: string });

const PARSERS = { gh: parseGhChecks, claude: parseClaudeResult, codex: parseCodexEvents, biome: parseBiomeReport, playwright: parsePlaywrightReport };
const TOOLS: readonly ToolName[] = ['gh', 'claude', 'codex', 'biome', 'playwright'];
const OUTPUT_ENV = ['PLAYWRIGHT_JSON_OUTPUT_FILE', 'PLAYWRIGHT_JSON_OUTPUT_DIR', 'PLAYWRIGHT_JSON_OUTPUT_NAME'];

function validate(request: CollectRequest): void {
  if (!TOOLS.includes(request.tool)) throw new UsageError('収集する tool を指定してください。');
  if (typeof request.command !== 'string' || !request.command || request.command.includes('\0')) {
    throw new UsageError('実行する command は空でない文字列にし、NUL を含めないでください。');
  }
  if (!Array.isArray(request.args) || !Array.from(request.args).every(arg => typeof arg === 'string' && !arg.includes('\0'))) {
    throw new UsageError('args は NUL を含まない文字列の配列にしてください。');
  }
  if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) throw new UsageError('timeoutMs は正の有限数にしてください。');
  if (request.maxBuffer !== undefined && (!Number.isSafeInteger(request.maxBuffer) || request.maxBuffer <= 0)) {
    throw new UsageError('maxBuffer は正の安全な整数にしてください。');
  }
}

function childEnv(request: CollectRequest): NodeJS.ProcessEnv | undefined {
  if (request.tool !== 'playwright') return request.env;
  return Object.fromEntries(Object.entries(request.env ?? process.env).filter(([key]) =>
    !OUTPUT_ENV.includes(process.platform === 'win32' ? key.toUpperCase() : key),
  ));
}

function diagnosticsOf(text: string): string {
  const parts: string[] = [];
  const redactor = createDiagnosticRedactor(part => parts.push(part));
  redactor.write(text); redactor.end();
  const masked = parts.join('');
  let start = Math.max(0, masked.length - 4096);
  const unit = masked.charCodeAt(start);
  if (unit >= 0xDC00 && unit <= 0xDFFF) start++;
  return masked.slice(start);
}

function collect(request: CollectRequest): Collected {
  validate(request);
  const env = childEnv(request);
  let result: ExternalResult;
  try {
    result = runExternal(request.command, request.args, {
      cwd: request.cwd, env, timeoutMs: request.timeoutMs, maxBuffer: request.maxBuffer, shell: false, untilDeadline: true,
    });
  } catch (error) {
    if (!(error instanceof ProcessLimitError)) throw error;
    return {
      tool: request.tool, outcome: 'limited', kind: error.kind,
      reason: '外部操作を制限しました。' + (error.reason ? ` ${maskSecrets(error.reason)}` : ''),
      diagnostics: diagnosticsOf(error.stderr),
    };
  }
  const diagnostics = diagnosticsOf(result.stderr);
  if (result.error) {
    const code = result.error.code;
    const suffix = typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? `（${code}）` : '';
    const outcome = code === 'ENOENT' ? 'not_found' : 'spawn_error';
    return { tool: request.tool, outcome, reason: maskSecrets('外部操作を起動できません。' + suffix), diagnostics };
  }
  const exit = { status: result.status, signal: result.signal };
  const parsed = PARSERS[request.tool](`${request.tool}:stdout`, result.stdout);
  if (parsed.errors.length || parsed.value === null) {
    const error = parsed.errors.at(0);
    const reason = error ? maskSecrets(`${error.line}行目：${error.message}`) : '出力を読み取れません。';
    return { tool: request.tool, outcome: 'unreadable', exit, reason, diagnostics };
  }
  try {
    return { tool: request.tool, outcome: 'parsed', exit, observation: maskValue(parsed.value), diagnostics };
  } catch {
    return { tool: request.tool, outcome: 'unreadable', exit, reason: '出力を安全に置換できません。', diagnostics };
  }
}

export function collectToolOutput(request: CollectRequest): Collected {
  try { return collect(request); }
  catch (error) {
    if (error instanceof UsageError) throw error;
    throw new RuntimeFailure('外部ツールの出力を収集できません。');
  }
}
