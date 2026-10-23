import { UsageError, formatVerifyResult, runInit, runVerify } from '@loomake/kit';
import { runRecord } from '@loomake/trace';

export type Io = {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** 確認を受け付けられるか（標準入力が TTY か）。省略すると受け付けない */
  interactive?: boolean;
  /** 質問を出して、入力された答えを返す */
  prompt?: (question: string) => Promise<string>;
};

const USAGE = 'loomake <init | verify | trace> [オプション]';
const INIT_USAGE = 'loomake init [--codex] [--devcontainer]';
const VERIFY_USAGE = 'loomake verify [--change <id> (--spec-only | --done)] [--json] [--skip-commands]';
const TRACE_USAGE = 'loomake trace record --change <id>';
const INIT_FLAGS = new Set(['--codex', '--devcontainer']);
const VERIFY_FLAGS = new Set(['--spec-only', '--done', '--json', '--skip-commands']);

/** CLI の本体。終了コード（合格 0・不合格 1・使い方の誤り 2）を返す（REQ-041） */
export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...args] = argv;
  if (command !== 'verify' && command !== 'init' && command !== 'trace') {
    io.stderr(`使い方: ${USAGE}`);
    return 2;
  }
  try {
    if (command === 'init') return await init(args, io);
    return command === 'verify' ? verify(args, io) : trace(args, io);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    io.stderr(`loomake ${command}: ${e.message}`);
    io.stderr(`使い方: ${{ init: INIT_USAGE, verify: VERIFY_USAGE, trace: TRACE_USAGE }[command]}`);
    return 2;
  }
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
  if (sub !== 'record') throw new UsageError(sub ? `知らないサブコマンドです：${sub}` : 'record を指定してください');
  let changeId: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--change') {
      changeId = rest[++i];
      if (!changeId || changeId.startsWith('--')) throw new UsageError('--change には change-id を続けてください');
    } else {
      throw new UsageError(`知らないオプションです：${a}`);
    }
  }
  if (!changeId) throw new UsageError('--change <id> が必要です');
  // verify の進捗は標準エラーに出す（verify と同じ）
  return runRecord({ root: io.cwd, changeId, stdout: io.stdout, progress: io.stderr });
}
