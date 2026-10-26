import { readFileSync } from 'node:fs';
import { RuntimeFailure, UsageError, formatVerifyResult, runDoctor, runInit, runVerify } from '@loomake/kit';
import { runRun } from '@loomake/runner';
import { runAgreement, runRecord, runReport } from '@loomake/trace';
import { didYouMean, parseOptions } from './args.js';

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
const TRACE_RECORD_USAGE = 'loomake trace record --change <id>';
const TRACE_REPORT_USAGE = 'loomake trace report --change <id> [--format md|json]';
const TRACE_ANSWER_USAGE = 'loomake trace answer --change <id> --question <Q-ID> --answer <回答> --by <回答者> [--date YYYY-MM-DD]';
const TRACE_APPROVE_USAGE = 'loomake trace approve --change <id> --assumption <A-ID> --by <承認者> [--date YYYY-MM-DD]';
const TRACE_USAGE = [TRACE_RECORD_USAGE, TRACE_REPORT_USAGE, TRACE_ANSWER_USAGE, TRACE_APPROVE_USAGE].join('\n       ');
const DOCTOR_USAGE = 'loomake doctor';
const COMMANDS = ['init', 'verify', 'trace', 'run', 'doctor'] as const;
type Command = (typeof COMMANDS)[number];
const COMMAND_USAGE: Record<Command, string> = { init: INIT_USAGE, verify: VERIFY_USAGE, trace: TRACE_USAGE, run: RUN_USAGE, doctor: DOCTOR_USAGE };
// 値を取るオプション。--change=<id> の形も受け付ける（REQ-041、improve-cli-help の仮定 A-01）

// 端末での幅。全角の文字は 2 桁と数え、オプションの説明の桁をそろえる
const width = (s: string) => {
  let n = 0;
  for (const c of s) n += c.charCodeAt(0) > 0xff ? 2 : 1;
  return n;
};

/** サブコマンドのヘルプ：使い方の行・説明・各オプションの説明（REQ-135） */
const help = (usage: string, description: string, options: [string, string][] = []) =>
  [
    `使い方: ${usage}`,
    description,
    ...(options.length ? ['', 'オプション:', ...options.map(([name, text]) => `  ${name}${' '.repeat(Math.max(1, 20 - width(name)))}${text}`)] : []),
  ].join('\n');

const TRACE_RECORD_HELP = help(TRACE_RECORD_USAGE, 'verify --done を実行し、結果をコミットの SHA と合わせて .loomake/evidence/<change-id>/ に記録する。未コミットの変更があれば記録しない。', [
  ['--change <id>', '記録する change'],
]);
const TRACE_REPORT_HELP = help(TRACE_REPORT_USAGE, 'いちばん新しい証拠の記録から、要件ごとのリリースレポートを標準出力に出す。', [
  ['--change <id>', 'レポートを作る change（進行中になければ archive から探す）'],
  ['--format md|json', '出力の形式。省くと md'],
]);
const TRACE_ANSWER_HELP = help(TRACE_ANSWER_USAGE, 'trace.md の確認事項へ回答を書く。すでに回答がある行は上書きしない。', [
  ['--change <id>', '回答する change'], ['--question <Q-ID>', '確認事項の ID'],
  ['--answer <回答>', '確認事項への回答'], ['--by <回答者>', '回答を決めた人'], ['--date YYYY-MM-DD', '回答日。省くと今日の日付'],
]);
const TRACE_APPROVE_HELP = help(TRACE_APPROVE_USAGE, 'trace.md の仮定に承認を書く。すでに承認がある行は上書きしない。', [
  ['--change <id>', '承認する change'], ['--assumption <A-ID>', '仮定の ID'],
  ['--by <承認者>', '承認を決めた人'], ['--date YYYY-MM-DD', '承認日。省くと今日の日付'],
]);
const COMMAND_HELP: Record<Command, string> = {
  init: help(INIT_USAGE, 'AGENTS.md・CLAUDE.md・loomake.config.json・Skill をプロジェクトに置く。内容の違う同名のファイルは、確かめてから上書きする。', [
    ['--codex', 'Skill を .agents/skills/ にも置く（Codex 用）'],
    ['--devcontainer', '.devcontainer/devcontainer.json を置く'],
  ]),
  verify: help(VERIFY_USAGE, '仕様ゲートと完了ゲートで、仕様・確認事項・テストを検査する。--change を省くと、品質コマンドだけを実行する。終了コードは合格 0・不合格 1・使い方の誤り 2・実行時の失敗 3。', [
    ['--change <id>', '検査する change'],
    ['--spec-only', '仕様ゲート：実装に入ってよいかを検査する'],
    ['--done', '完了ゲート：仕様ゲートに加え、タスク・要件ごとのテスト・品質コマンドを検査する'],
    ['--json', '結果を JSON で標準出力に出す（進捗は標準エラー）'],
    ['--skip-commands', '品質コマンドを実行せず、すでにあるテストのレポートを読む'],
  ]),
  trace: [TRACE_RECORD_HELP, '', TRACE_REPORT_HELP, '', TRACE_ANSWER_HELP, '', TRACE_APPROVE_HELP].join('\n'),
  run: help(RUN_USAGE, 'change のタスクをエンジンに 1 つずつ実装させ、完了ゲートが通るまで直させて、PR を作る。', [
    ['--change <id>', '実装する change'],
    ['--engine <名前>', '使うエンジン。省くと claude-code（いまは claude-code だけ）'],
    ['--dry-run', 'エンジンに渡す予定のタスクと最初の指示を表示するだけで、実装しない'],
    ['--skip-permissions', '権限確認なしでエンジンを動かす。LOOMAKE_SANDBOX=1 のときだけ使える'],
  ]),
  doctor: help(DOCTOR_USAGE, '導入状態を調べ、足りない設定と直し方を表示する。ファイルは変えず、品質コマンドも実行しない。'),
};

// 全体のヘルプ（REQ-135）
const HELP = [
  `使い方: ${USAGE}`,
  '',
  'コマンド:',
  '  init     AGENTS.md・CLAUDE.md・loomake.config.json・Skill をプロジェクトに置く',
  '  verify   仕様ゲートと完了ゲートで、仕様・確認事項・テストを検査する',
  '  trace    証拠を記録し（record）、リリースレポートを出す（report）。確認事項の回答（answer）と仮定の承認（approve）を書く',
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

/** CLI の本体。終了コード（合格 0・不合格 1・使い方の誤り 2・実行時の失敗 3）を返す（REQ-041・REQ-192） */
export async function main(argv: string[], io: Io): Promise<number> {
  // --name=value の形は、サブコマンドごとの parseOptions が扱う（REQ-194）
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
    // 打ち間違いには近いサブコマンドを示す（REQ-195）
    if (command && !command.startsWith('-')) io.stderr(`知らないコマンドです：${command}${didYouMean(command, COMMANDS)}`);
    io.stderr(`使い方: ${USAGE}`);
    return 2;
  }
  const cmd = command as Command;
  // サブコマンドの --help は、ほかの処理をせずに使い方だけを出す。trace は record と report を分ける（REQ-135）
  if (args.some(isHelp)) {
    // オブジェクトの添字で引くと constructor のような継承したプロパティを拾うので、名前を 1 つずつ比べる
    const sub = cmd !== 'trace' ? undefined : args[0] === 'record' ? TRACE_RECORD_HELP : args[0] === 'report' ? TRACE_REPORT_HELP : args[0] === 'answer' ? TRACE_ANSWER_HELP : args[0] === 'approve' ? TRACE_APPROVE_HELP : undefined;
    io.stdout(sub ?? COMMAND_HELP[cmd]);
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
  parseOptions(args, {});
  return runDoctor({ root: io.cwd, stdout: io.stdout });
}

function init(args: string[], io: Io): Promise<number> {
  const { flags } = parseOptions(args, { flags: ['--codex', '--devcontainer'] });
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

function verify(args: string[], io: Io): number {
  const { values, flags } = parseOptions(args, { values: ['--change'], flags: ['--spec-only', '--done', '--json', '--skip-commands'] });
  const changeId = values.get('--change');
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
    // --json のとき標準出力には JSON だけを出すので、進捗は標準エラーに出す
    progress: io.stderr,
  });
  io.stdout(flags.has('--json') ? JSON.stringify(result, null, 2) : `\n${formatVerifyResult(result)}`);
  return result.ok ? 0 : 1;
}

function trace(args: string[], io: Io): number {
  const [sub, ...rest] = args;
  const subs = ['record', 'report', 'answer', 'approve'];
  if (sub === 'answer' || sub === 'approve') return agreement(sub, rest, io);
  if (sub !== 'record' && sub !== 'report') {
    throw new UsageError(sub ? `知らないサブコマンドです：${sub}${didYouMean(sub, subs)}` : 'record・report・answer・approve のどれかを指定してください');
  }
  const { values } = parseOptions(rest, { values: sub === 'report' ? ['--change', '--format'] : ['--change'] });
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
  const { values } = parseOptions(args, { values: ['--change', target, '--by', '--date', ...(kind === 'answer' ? ['--answer'] : [])] });
  const changeId = values.get('--change');
  const id = values.get(target);
  if (!changeId || !id) throw new UsageError(`--change <id> と ${target} <ID> が必要です`);
  return runAgreement({ root: io.cwd, changeId, kind, id, answer: values.get('--answer'), by: values.get('--by'), date: values.get('--date'), stdout: io.stdout });
}

function run(args: string[], io: Io): Promise<number> {
  const { values, flags } = parseOptions(args, { values: ['--change', '--engine'], flags: ['--dry-run', '--skip-permissions'] });
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
