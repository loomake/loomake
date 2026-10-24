import { readFileSync } from 'node:fs';
import { RuntimeFailure, UsageError, formatVerifyResult, runDoctor, runInit, runVerify } from '@loomake/kit';
import { runRun } from '@loomake/runner';
import { runRecord, runReport } from '@loomake/trace';

export type Io = {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** 確認を受け付けられるか（標準入力が TTY か）。省略すると受け付けない */
  interactive?: boolean;
  /** 質問を出して、入力された答えを返す */
  prompt?: (question: string) => Promise<string>;
  /** 中断の合図。loomake run に渡す */
  signal?: AbortSignal;
};

const USAGE = 'loomake <init | verify | trace | run | doctor> [オプション]';
const INIT_USAGE = 'loomake init [--codex] [--devcontainer]';
const VERIFY_USAGE = 'loomake verify [--change <id> (--spec-only | --done)] [--json] [--skip-commands]';
const RUN_USAGE = 'loomake run --change <id> [--engine claude-code] [--dry-run] [--skip-permissions]';
const RUN_FLAGS = new Set(['--dry-run', '--skip-permissions']);
const TRACE_USAGE = 'loomake trace record --change <id> | loomake trace report --change <id> [--format md|json]';
const DOCTOR_USAGE = 'loomake doctor';
const INIT_FLAGS = new Set(['--codex', '--devcontainer']);
const COMMANDS = ['init', 'verify', 'trace', 'run', 'doctor'] as const;
type Command = (typeof COMMANDS)[number];
const COMMAND_USAGE: Record<Command, string> = { init: INIT_USAGE, verify: VERIFY_USAGE, trace: TRACE_USAGE, run: RUN_USAGE, doctor: DOCTOR_USAGE };

// 全体のヘルプ（REQ-135）
const HELP = [
  `使い方: ${USAGE}`,
  '',
  'コマンド:',
  '  init     AGENTS.md・CLAUDE.md・loomake.config.json・Skill をプロジェクトに置く',
  '  verify   仕様ゲートと完了ゲートで、仕様・確認事項・テストを検査する',
  '  trace    証拠を記録し（record）、検収レポートを出す（report）',
  '  run      change のタスクをエンジンに 1 つずつ実装させ、完了ゲートを通して PR を作る',
  '  doctor   導入状態を調べ、足りない設定と直し方を表示する',
  '',
  'オプション:',
  '  -h, --help     使い方を表示する',
  '  -v, --version  版を表示する',
  '',
  '各コマンドの使い方は、loomake <コマンド> --help で表示します。',
].join('\n');

const isHelp = (a: string | undefined) => a === '--help' || a === '-h';
// src/ からも dist/ からも、loomake の package.json は 1 つ上にある
const version = () => (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const VERIFY_FLAGS = new Set(['--spec-only', '--done', '--json', '--skip-commands']);

/** CLI の本体。終了コード（合格 0・不合格 1・使い方の誤り 2・実行時の失敗 3）を返す（REQ-041・REQ-192） */
export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...args] = argv;
  if (isHelp(command)) {
    io.stdout(HELP);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.stdout(version());
    return 0;
  }
  if (!COMMANDS.includes(command as Command)) {
    io.stderr(`使い方: ${USAGE}`);
    return 2;
  }
  const cmd = command as Command;
  // サブコマンドの --help は、ほかの処理をせずに使い方だけを出す（REQ-135）
  if (args.some(isHelp)) {
    io.stdout(`使い方: ${COMMAND_USAGE[cmd]}`);
    return 0;
  }
  try {
    if (cmd === 'init') return await init(args, io);
    if (cmd === 'run') return await run(args, io);
    if (cmd === 'doctor') return doctor(args, io);
    return cmd === 'verify' ? verify(args, io) : trace(args, io);
  } catch (e) {
    // 実行時の失敗は使い方を表示せず、終了コード 3 で使い方の誤りと区別する（REQ-192）
    if (e instanceof RuntimeFailure) {
      io.stderr(`loomake ${cmd}: ${e.message}`);
      return 3;
    }
    if (!(e instanceof UsageError)) throw e;
    io.stderr(`loomake ${cmd}: ${e.message}`);
    io.stderr(`使い方: ${COMMAND_USAGE[cmd]}`);
    return 2;
  }
}

function doctor(args: string[], io: Io): number {
  for (const a of args) throw new UsageError(`知らないオプションです：${a}`);
  return runDoctor({ root: io.cwd, stdout: io.stdout });
}

function init(args: string[], io: Io): Promise<number> {
  for (const a of args) if (!INIT_FLAGS.has(a)) throw new UsageError(`知らないオプションです：${a}`);
  const { prompt } = io;
  return runInit({
    root: io.cwd,
    codex: args.includes('--codex'),
    devcontainer: args.includes('--devcontainer'),
    interactive: Boolean(io.interactive && prompt),
    // 既定は上書きしない。y か yes のときだけ承諾とみなす（add-init-cli の仮定 A-03）
    confirm: async (question) => /^y(es)?$/i.test(((await prompt?.(question)) ?? '').trim()),
    stdout: io.stdout,
  });
}

function verify(args: string[], io: Io): number {
  let changeId: string | undefined;
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--change') {
      changeId = args[++i];
      if (!changeId || changeId.startsWith('--')) throw new UsageError('--change には change-id を続けてください');
    } else if (VERIFY_FLAGS.has(a)) {
      flags.add(a);
    } else {
      throw new UsageError(`知らないオプションです：${a}`);
    }
  }
  const specOnly = flags.has('--spec-only');
  const done = flags.has('--done');
  if ((specOnly || done) && !changeId) throw new UsageError('--spec-only・--done には --change <id> が必要です');
  if (specOnly && done) throw new UsageError('--spec-only と --done は同時に指定できません');
  if (changeId && !specOnly && !done) throw new UsageError('--change を指定するときは --spec-only か --done を付けてください');

  const result = runVerify({
    root: io.cwd,
    changeId,
    gate: done ? 'done' : 'spec-only',
    skipCommands: flags.has('--skip-commands'),
    // --json のとき標準出力には JSON だけを出すので、進捗は標準エラーに出す（add-verify-cli の仮定 A-03）
    progress: io.stderr,
  });
  io.stdout(flags.has('--json') ? JSON.stringify(result, null, 2) : `\n${formatVerifyResult(result)}`);
  return result.ok ? 0 : 1;
}

function trace(args: string[], io: Io): number {
  const [sub, ...rest] = args;
  if (sub !== 'record' && sub !== 'report') throw new UsageError(sub ? `知らないサブコマンドです：${sub}` : 'record か report を指定してください');
  let changeId: string | undefined;
  let format: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--change' || (a === '--format' && sub === 'report')) {
      const value = rest[++i];
      if (!value || value.startsWith('--')) throw new UsageError(`${a} には値を続けてください`);
      if (a === '--change') changeId = value;
      else format = value;
    } else {
      throw new UsageError(`知らないオプションです：${a}`);
    }
  }
  if (!changeId) throw new UsageError('--change <id> が必要です');
  // verify の進捗は標準エラーに出す（verify と同じ）
  if (sub === 'record') return runRecord({ root: io.cwd, changeId, stdout: io.stdout, progress: io.stderr });
  // 初版は Markdown と JSON だけ。省いたら Markdown（add-trace-report の仮定 A-07）
  if (format === 'html') throw new UsageError('HTML の形式は次の版で対応します。いまは md か json を指定してください');
  if (format !== undefined && format !== 'md' && format !== 'json') throw new UsageError(`--format は md か json にしてください：${format}`);
  return runReport({ root: io.cwd, changeId, format: format ?? 'md', stdout: io.stdout });
}

function run(args: string[], io: Io): Promise<number> {
  let changeId: string | undefined;
  let engine: string | undefined;
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--change' || a === '--engine') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new UsageError(`${a} には値を続けてください`);
      if (a === '--change') changeId = value;
      else engine = value;
    } else if (RUN_FLAGS.has(a)) {
      flags.add(a);
    } else {
      throw new UsageError(`知らないオプションです：${a}`);
    }
  }
  if (!changeId) throw new UsageError('--change <id> が必要です');
  const { prompt } = io;
  return runRun({
    root: io.cwd,
    changeId,
    engine,
    dryRun: flags.has('--dry-run'),
    skipPermissions: flags.has('--skip-permissions'),
    interactive: Boolean(io.interactive && prompt),
    confirm: async (question) => /^y(es)?$/i.test(((await prompt?.(question)) ?? '').trim()),
    stdout: io.stdout,
    progress: io.stderr,
    signal: io.signal,
  });
}
