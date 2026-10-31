import { UsageError } from '@loomake/kit';

/** サブコマンドが受け付けるオプション。values は値をとるもの、flags は値をとらないもの */
export type OptionSpec = { values?: readonly string[]; flags?: readonly string[] };
export type ParsedOptions = { values: Map<string, string>; flags: Set<string> };

/** 必須性・既定値は説明用。検査と補完は各handlerの既存処理が担当する。 */
export type CliOption = {
  name: string;
  kind: 'value' | 'flag';
  label: string;
  description: string;
  required: string;
  defaultValue: string;
  choices?: string;
  condition?: string;
  helpOrder?: number;
};
export type CliCommand = {
  name: string;
  usage: string;
  description: string;
  options: readonly CliOption[];
  operations?: readonly CliCommand[];
};

/** --scope の受理値。verify と trace record が同じ定義を使う（REQ-312・REQ-135） */
export const SCOPES = ['local', 'ci'] as const;

const traceOperations = [
  {
    name: 'record', usage: 'loomake trace record --change <id> [--scope local|ci]',
    description: 'verify --done を実行し、結果をコミットの SHA と合わせて .loomake/evidence/<change-id>/ に記録する。未コミットの変更があれば記録しない。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: '記録する change', required: '必須', defaultValue: 'なし' },
      { name: '--scope', kind: 'value', choices: SCOPES.join(' / '), label: '--scope local|ci', description: '記録する verify の範囲。省くと ci。local の記録は最終 CI の合格ではない', required: '任意', defaultValue: 'ci' },
    ],
  },
  {
    name: 'report', usage: 'loomake trace report --change <id> [--format md|json]',
    description: 'いちばん新しい証拠の記録から、要件ごとのリリースレポートを標準出力に出す。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: 'レポートを作る change（進行中になければ archive から探す）', required: '必須', defaultValue: 'なし' },
      { name: '--format', kind: 'value', label: '--format md|json', description: '出力の形式。省くと md', required: '任意', defaultValue: 'md', choices: 'md / json' },
    ],
  },
  {
    name: 'answer', usage: 'loomake trace answer --change <id> --question <Q-ID> --answer <回答> --by <回答者> [--date YYYY-MM-DD]',
    description: 'trace.md の確認事項へ回答を書く。すでに回答がある行は上書きしない。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: '回答する change', required: '必須', defaultValue: 'なし', helpOrder: 0 },
      { name: '--question', kind: 'value', choices: 'trace.mdの確認事項表に存在するID', label: '--question <Q-ID>', description: '確認事項の ID', required: '必須', defaultValue: 'なし', helpOrder: 1 },
      { name: '--by', kind: 'value', choices: '前後の空白を除いて空でない、改行を含まない文字列', label: '--by <回答者>', description: '回答を決めた人', required: '必須', defaultValue: 'なし', helpOrder: 3 },
      { name: '--date', kind: 'value', label: '--date YYYY-MM-DD', description: '回答日。省くと今日の日付', required: '任意', defaultValue: '実行環境のローカル日付', choices: 'YYYY-MM-DDの実在する日', helpOrder: 4 },
      { name: '--answer', kind: 'value', choices: '前後の空白を除いて空でない、改行を含まない文字列', label: '--answer <回答>', description: '確認事項への回答', required: '必須', defaultValue: 'なし', helpOrder: 2 },
    ],
  },
  {
    name: 'approve', usage: 'loomake trace approve --change <id> --assumption <A-ID> --by <承認者> [--date YYYY-MM-DD]',
    description: 'trace.md の仮定に承認を書く。すでに承認がある行は上書きしない。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: '承認する change', required: '必須', defaultValue: 'なし' },
      { name: '--assumption', kind: 'value', choices: 'trace.mdの仮定表に存在するID', label: '--assumption <A-ID>', description: '仮定の ID', required: '必須', defaultValue: 'なし' },
      { name: '--by', kind: 'value', choices: '前後の空白を除いて空でない、改行を含まない文字列', label: '--by <承認者>', description: '承認を決めた人', required: '必須', defaultValue: 'なし' },
      { name: '--date', kind: 'value', label: '--date YYYY-MM-DD', description: '承認日。省くと今日の日付', required: '任意', defaultValue: '実行環境のローカル日付', choices: 'YYYY-MM-DDの実在する日' },
    ],
  },
] as const satisfies readonly CliCommand[];

/** CLIの受理名・候補順とヘルプ・リファレンスの生成元。配列順は解析候補の優先順。 */
export const CLI_COMMANDS = [
  {
    name: 'init', usage: 'loomake init [--codex] [--devcontainer]',
    summary: 'AGENTS.md・CLAUDE.md・loomake.config.json・Skill をプロジェクトに置く',
    description: 'AGENTS.md・CLAUDE.md・loomake.config.json・Skill をプロジェクトに置く。内容の違う同名のファイルは、確かめてから上書きする。',
    options: [
      { name: '--codex', kind: 'flag', label: '--codex', description: 'Skill を .agents/skills/ にも置く（Codex 用）', required: '任意', defaultValue: 'false' },
      { name: '--devcontainer', kind: 'flag', label: '--devcontainer', description: '.devcontainer/devcontainer.json を置く', required: '任意', defaultValue: 'false' },
    ],
  },
  {
    name: 'verify', usage: 'loomake verify [--change <id> (--spec-only | --done)] [--json] [--skip-commands] [--scope local|ci]',
    summary: '仕様ゲートと完了ゲートで、仕様・確認事項・テストを検査する',
    description: '仕様ゲートと完了ゲートで、仕様・確認事項・テストを検査する。--change を省くと、品質コマンドだけを実行する。終了コードは合格 0・不合格 1・使い方の誤り 2・実行時の失敗 3。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: '検査する change', required: '条件付き必須', defaultValue: 'なし（省略時は品質コマンドのみ）', condition: '--spec-onlyまたは--doneを指定するとき必須。指定時はどちらか片方のゲートが必要' },
      { name: '--spec-only', kind: 'flag', label: '--spec-only', description: '仕様ゲート：実装に入ってよいかを検査する', required: '条件付き必須', defaultValue: 'false', condition: '--change指定時は--doneとのどちらか片方が必須。--changeなしでは指定不可' },
      { name: '--done', kind: 'flag', label: '--done', description: '完了ゲート：仕様ゲートに加え、タスク・要件ごとのテスト・品質コマンドを検査する', required: '条件付き必須', defaultValue: 'false', condition: '--change指定時は--spec-onlyとのどちらか片方が必須。--changeなしでは指定不可' },
      { name: '--json', kind: 'flag', label: '--json', description: '結果を JSON で標準出力に出す（進捗は標準エラー）', required: '任意', defaultValue: 'false' },
      { name: '--skip-commands', kind: 'flag', label: '--skip-commands', description: '品質コマンドを実行せず、テストのレポートも読まずに、その項目を証拠不足にする（終了コード 1）。coverage は出さない', required: '任意', defaultValue: 'false' },
      { name: '--scope', kind: 'value', choices: SCOPES.join(' / '), label: '--scope local|ci', description: '結果の範囲。省くと --done は ci、--spec-only と --change なしは local（--change なしの ci は使えない）', required: '任意', defaultValue: '--done は ci、--spec-only と --change なしは local', condition: '--change なしで指定できるのは local だけ。環境変数 CI では既定値を変えない' },
    ],
  },
  {
    name: 'trace', usage: traceOperations.map((operation) => operation.usage).join('\n       '),
    summary: '証拠を記録し（record）、リリースレポートを出す（report）。確認事項の回答（answer）と仮定の承認（approve）を書く',
    description: 'record・report・answer・approveの操作を指定する。', options: [], operations: traceOperations,
  },
  {
    name: 'run', usage: 'loomake run --change <id> [--engine claude-code] [--dry-run] [--skip-permissions]',
    summary: 'change のタスクをエンジンに 1 つずつ実装させ、完了ゲートを通して PR を作る',
    description: 'change のタスクをエンジンに 1 つずつ実装させ、完了ゲートが通るまで直させて、PR を作る。',
    options: [
      { name: '--change', kind: 'value', choices: '英小文字・数字と、間に1つずつのハイフンで表すchange-id', label: '--change <id>', description: '実装する change', required: '必須', defaultValue: 'なし' },
      { name: '--engine', kind: 'value', label: '--engine <名前>', description: '使うエンジン。省くと claude-code（いまは claude-code だけ）', required: '任意', defaultValue: 'claude-code', choices: 'claude-code' },
      { name: '--dry-run', kind: 'flag', label: '--dry-run', description: 'エンジンに渡す予定のタスクと最初の指示を表示するだけで、実装しない', required: '任意', defaultValue: 'false' },
      { name: '--skip-permissions', kind: 'flag', label: '--skip-permissions', description: '権限確認なしでエンジンを動かす。LOOMAKE_SANDBOX=1 のときだけ使える', required: '任意', defaultValue: 'false', condition: 'LOOMAKE_SANDBOX=1が必要' },
    ],
  },
  {
    name: 'doctor', usage: 'loomake doctor', summary: '導入状態を調べ、足りない設定と直し方を表示する',
    description: '導入状態を調べ、足りない設定と直し方を表示する。ファイルは変えず、品質コマンドも実行しない。', options: [],
  },
] as const satisfies readonly (CliCommand & { summary: string })[];

export type Command = (typeof CLI_COMMANDS)[number]['name'];
export const COMMANDS = CLI_COMMANDS.map((command) => command.name);
export const USAGE = `loomake <${COMMANDS.join(' | ')}> [オプション]`;
export const SHARED_OPERATIONS = [
  { names: ['-h', '--help'], label: '-h, --help', description: '使い方を表示する', condition: '先頭では全体、コマンド以降ではそのhelpを業務処理前に表示する' },
  { names: ['-v', '--version'], label: '-v, --version', description: '版を表示する', condition: '先頭引数として指定する。サブコマンドの固有オプションではない' },
] as const;

export const CLI_REFERENCE = {
  commands: CLI_COMMANDS,
  sharedOperations: SHARED_OPERATIONS,
  syntax: [
    '値付きオプションは --name value と --name=value を受け付ける。空値は拒否する。',
    '空白区切りで次の値が -- から始まるときは値不足とする。等号区切りでは -- から始まる値も渡せる。',
    '値付きオプションを反復すると最後の値を使う。flagの反復は1回と同じで、flagに等号で値を付けると拒否する。',
    '知らないコマンド・オプション・位置引数は拒否する。近い候補があるときは日本語で示す。',
    '受理したコマンドの引数にhelpがあれば業務処理より先に表示する。versionは先頭の引数としてだけ扱う。',
  ],
} as const;

export function commandDefinition(name: Command): CliCommand {
  // nameはCOMMANDSで受理した名前か、既存handlerの名前に限る。
  const command = CLI_COMMANDS.find((item) => item.name === name);
  if (!command) throw new Error(`コマンドの定義がありません：${name}`);
  return command;
}

export function traceOperation(name: string | undefined): CliCommand | undefined {
  return traceOperations.find((item) => item.name === name);
}

export function optionSpec(command: CliCommand): OptionSpec {
  return {
    values: command.options.filter((option) => option.kind === 'value').map((option) => option.name),
    flags: command.options.filter((option) => option.kind === 'flag').map((option) => option.name),
  };
}

export function helpOptions(command: CliCommand): readonly CliOption[] {
  return command.options.map((option, index) => ({ option, index }))
    .sort((a, b) => (a.option.helpOrder ?? a.index) - (b.option.helpOrder ?? b.index)).map(({ option }) => option);
}

// 全角を2桁とする既存の配置を保つ。
const width = (text: string) => {
  let n = 0;
  for (const c of text) n += c.charCodeAt(0) > 0xff ? 2 : 1;
  return n;
};

export function commandHelp(command: CliCommand): string {
  if (command.operations) return command.operations.map(commandHelp).join('\n\n');
  return [
    `使い方: ${command.usage}`, command.description,
    ...(command.options.length ? ['', 'オプション:', ...helpOptions(command)
      .map((option) => `  ${option.label}${' '.repeat(Math.max(1, 20 - width(option.label)))}${option.description}`)] : []),
  ].join('\n');
}

export const HELP = [
  `使い方: ${USAGE}`, '', 'コマンド:',
  ...CLI_COMMANDS.map((command) => `  ${command.name}${' '.repeat(9 - command.name.length)}${command.summary}`),
  '', 'オプション:',
  ...SHARED_OPERATIONS.map((operation) => `  ${operation.label.padEnd(15)}${operation.description}`),
  '', '各コマンドの使い方は、loomake <コマンド> --help で表示します。',
].join('\n');

export const isHelp = (arg: string | undefined) => SHARED_OPERATIONS[0].names.some((name) => name === arg);
export const isVersion = (arg: string | undefined) => SHARED_OPERATIONS[1].names.some((name) => name === arg);

/** 編集距離（挿入・削除・置換を 1 とする） */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** 編集距離が 2 以下で最も近い候補（REQ-195）。なければ undefined */
export function suggest(input: string, candidates: readonly string[]): string | undefined {
  let best: { name: string; d: number } | undefined;
  for (const name of candidates) {
    const d = distance(input, name);
    if (d <= 2 && (!best || d < best.d)) best = { name, d };
  }
  return best?.name;
}

/** 「もしかして」の 1 文。候補がなければ空 */
export const didYouMean = (input: string, candidates: readonly string[]) => {
  const hit = suggest(input, candidates);
  return hit ? `。もしかして：${hit}` : '';
};

/** オプションを解析する。`--name value` と `--name=value` を受け付ける（REQ-194） */
export function parseOptions(args: readonly string[], spec: OptionSpec): ParsedOptions {
  const valueNames = spec.values ?? [];
  const flagNames = spec.flags ?? [];
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq < 0 ? arg : arg.slice(0, eq);
    if (valueNames.includes(name)) {
      const value = eq < 0 ? args[++i] : arg.slice(eq + 1);
      if (!value || (eq < 0 && value.startsWith('--'))) throw new UsageError(`${name} には値を続けてください`);
      values.set(name, value);
    } else if (eq < 0 && flagNames.includes(name)) {
      flags.add(name);
    } else {
      throw new UsageError(`知らないオプションです：${arg}${didYouMean(name, [...valueNames, ...flagNames])}`);
    }
  }
  return { values, flags };
}
