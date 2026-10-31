import { readFileSync } from 'node:fs';
import { CHANGE_ID, RuntimeFailure, UsageError, formatVerifyResult, runDoctor, runInit, runVerify, verifyAbortedResult, verifyExitCode } from '@loomake/kit';
import { runRun } from '@loomake/runner';
import { runAgreement, runRecord, runReport } from '@loomake/trace';
import { COMMANDS, HELP, USAGE, commandDefinition, commandHelp, didYouMean, isHelp, isVersion, optionSpec, parseOptions, traceOperation, type Command } from './args.js';

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

// src/ からも dist/ からも、loomake の package.json は 1 つ上にある
const version = () => (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** CLI の本体。終了コード（合格 0・不合格 1・使い方の誤り 2・実行時の失敗 3）を返す（REQ-041・REQ-192） */
export async function main(argv: string[], io: Io): Promise<number> {
  // --name=value の形は、サブコマンドごとの parseOptions が扱う（REQ-194）
  const [command, ...args] = argv;
  if (isHelp(command)) {
    io.stdout(HELP);
    return 0;
  }
  if (isVersion(command)) {
    io.stdout(version());
    return 0;
  }
  if (!COMMANDS.includes(command as Command)) {
    // 打ち間違いには近いサブコマンドを示す（REQ-195）
    if (command && !command.startsWith('-')) io.stderr(`知らないコマンドです：${command}${didYouMean(command, COMMANDS)}`);
    io.stderr(`使い方: ${USAGE}`);
    return 2;
  }
  const cmd = command as Command;
  // サブコマンドの --help は、ほかの処理をせずに使い方だけを出す。trace は record と report を分ける（REQ-135）
  if (args.some(isHelp)) {
    // オブジェクトの添字で引くと constructor のような継承したプロパティを拾うので、名前を 1 つずつ比べる
    const sub = cmd === 'trace' ? traceOperation(args[0]) : undefined;
    io.stdout(commandHelp(sub ?? commandDefinition(cmd)));
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
    io.stderr(`使い方: ${commandDefinition(cmd).usage}`);
    return 2;
  }
}

function doctor(args: string[], io: Io): number {
  parseOptions(args, optionSpec(commandDefinition('doctor')));
  return runDoctor({ root: io.cwd, stdout: io.stdout });
}

function init(args: string[], io: Io): Promise<number> {
  const { flags } = parseOptions(args, optionSpec(commandDefinition('init')));
  const { prompt } = io;
  return runInit({
    root: io.cwd,
    codex: flags.has('--codex'),
    devcontainer: flags.has('--devcontainer'),
    interactive: Boolean(io.interactive && prompt),
    // 既定は上書きしない。y か yes のときだけ承諾とみなす
    confirm: async (question) => /^y(es)?$/i.test(((await prompt?.(question)) ?? '').trim()),
    stdout: io.stdout,
  });
}

// 値として読まれない、単独の --json。構文の誤りでも JSON で返すかを決めるのに使う（R-F15）
const standaloneJson = (args: string[]) => args.some((arg, i) => arg === '--json' && args[i - 1] !== '--change');

/**
 * verify の結果を 2.0.0 で出し、終了コードを verifyExitCode で決める（REQ-311・REQ-041）。
 * --json のときは、使い方・設定の誤りと実行時の失敗も aborted の JSON を標準出力に出す。診断は標準エラーに出す
 */
function verify(args: string[], io: Io): number {
  const json = standaloneJson(args);
  let changeId: string | undefined;
  let result;
  try {
    const { values, flags } = parseOptions(args, optionSpec(commandDefinition('verify')));
    changeId = values.get('--change');
    const specOnly = flags.has('--spec-only');
    const done = flags.has('--done');
    if ((specOnly || done) && !changeId) throw new UsageError('--spec-only・--done には --change <id> が必要です');
    if (specOnly && done) throw new UsageError('--spec-only と --done は同時に指定できません');
    if (changeId && !specOnly && !done) throw new UsageError('--change を指定するときは --spec-only か --done を付けてください');

    result = runVerify({
      root: io.cwd,
      changeId,
      gate: done ? 'done' : 'spec-only',
      skipCommands: flags.has('--skip-commands'),
      // --json のとき標準出力には JSON だけを出すので、進捗は標準エラーに出す
      progress: io.stderr,
    });
  } catch (e) {
    if (!json || !(e instanceof UsageError || e instanceof RuntimeFailure)) throw e;
    const known = changeId !== undefined && CHANGE_ID.test(changeId) && changeId !== 'archive' ? changeId : null;
    const aborted = verifyAbortedResult(e, known, changeId ?? 'verify');
    io.stdout(JSON.stringify(aborted, null, 2));
    io.stderr(`loomake verify: ${e.message}`);
    if (e instanceof UsageError) io.stderr(`使い方: ${commandDefinition('verify').usage}`);
    return verifyExitCode(aborted);
  }
  io.stdout(json ? JSON.stringify(result, null, 2) : `\n${formatVerifyResult(result)}`);
  return verifyExitCode(result);
}

function trace(args: string[], io: Io): number {
  const [sub, ...rest] = args;
  const subs = commandDefinition('trace').operations?.map((operation) => operation.name) ?? [];
  if (sub === 'answer' || sub === 'approve') return agreement(sub, rest, io);
  if (sub !== 'record' && sub !== 'report') {
    throw new UsageError(sub ? `知らないサブコマンドです：${sub}${didYouMean(sub, subs)}` : 'record・report・answer・approve のどれかを指定してください');
  }
  const { values } = parseOptions(rest, optionSpec(traceOperation(sub) ?? commandDefinition('trace')));
  const changeId = values.get('--change');
  const format = values.get('--format');
  if (!changeId) throw new UsageError('--change <id> が必要です');
  // verify の進捗は標準エラーに出す（verify と同じ）
  if (sub === 'record') return runRecord({ root: io.cwd, changeId, stdout: io.stdout, progress: io.stderr });
  // 初版は Markdown と JSON だけ。省いたら Markdown
  if (format === 'html') throw new UsageError('HTML の形式は次の版で対応します。いまは md か json を指定してください');
  if (format !== undefined && format !== 'md' && format !== 'json') throw new UsageError(`--format は md か json にしてください：${format}`);
  return runReport({ root: io.cwd, changeId, format: format ?? 'md', stdout: io.stdout });
}

// 確認事項の回答と仮定の承認を trace.md に書く（REQ-202・REQ-203）
function agreement(kind: 'answer' | 'approve', args: string[], io: Io): number {
  const target = kind === 'answer' ? '--question' : '--assumption';
  const { values } = parseOptions(args, optionSpec(traceOperation(kind) ?? commandDefinition('trace')));
  const changeId = values.get('--change');
  const id = values.get(target);
  if (!changeId || !id) throw new UsageError(`--change <id> と ${target} <ID> が必要です`);
  return runAgreement({ root: io.cwd, changeId, kind, id, answer: values.get('--answer'), by: values.get('--by'), date: values.get('--date'), stdout: io.stdout });
}

function run(args: string[], io: Io): Promise<number> {
  const { values, flags } = parseOptions(args, optionSpec(commandDefinition('run')));
  const changeId = values.get('--change');
  if (!changeId) throw new UsageError('--change <id> が必要です');
  const { prompt } = io;
  return runRun({
    root: io.cwd,
    changeId,
    engine: values.get('--engine'),
    dryRun: flags.has('--dry-run'),
    skipPermissions: flags.has('--skip-permissions'),
    interactive: Boolean(io.interactive && prompt),
    confirm: async (question) => /^y(es)?$/i.test(((await prompt?.(question)) ?? '').trim()),
    stdout: io.stdout,
    progress: io.stderr,
    signal: io.signal,
  });
}
