#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

/** @typedef {import('../packages/cli/src/args.js').CliCommand} CliCommand */
/** @typedef {{commands: readonly CliCommand[], sharedOperations: readonly {names: readonly string[], label: string, description: string, condition: string}[], syntax: readonly string[]}} CliReference */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const regenerate = 'pnpm build && node scripts/generate-cli-reference.mjs';
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '|': '&#124;', '`': '&#96;', '\\': '&#92;', '[': '&#91;', ']': '&#93;', '*': '&#42;', '_': '&#95;', '#': '&#35;' };

/** 定義に含まれる文字列を、表やHTMLの構文として解釈させない。 */
export function cliReferenceText(value) {
  if (typeof value !== 'string') throw new Error('CLI定義の表示値は文字列にしてください');
  return value.replace(/[&<>"'|`\\[\]*_#]/g, (character) => entities[character]).replace(/\r\n|\r|\n/g, '<br>');
}

/** @param {CliReference} definition */
export function renderCliReference(definition) {
  const text = cliReferenceText;
  const lines = [
    '---', 'title: CLIリファレンス', 'description: 現行のloomake CLIの全コマンド・操作・オプションと必須条件・既定値を共通定義から生成したリファレンス。', '---', '',
    '# CLIリファレンス', '',
    '生成元: `packages/cli/src/args.ts` の共通定義。生成ページを直接編集せず、定義を更新して再生成する。', '',
    `再生成: \`${regenerate}\`。照合: \`node scripts/generate-cli-reference.mjs --check\`。`, '',
    '## 共通操作と構文', '',
    '| 操作 | 説明 | 適用条件 |', '|---|---|---|',
    ...definition.sharedOperations.map((operation) => `| ${text(operation.label)} | ${text(operation.description)} | ${text(operation.condition)} |`), '',
    ...definition.syntax.map((rule) => `- ${text(rule)}`), '',
  ];
  /** @param {CliCommand} command @param {string} path */
  function appendCommand(command, path) {
    lines.push(`## ${text(path)}`, '', `使い方: ${text(command.usage)}`, '', text(command.description), '');
    if (command.operations) {
      lines.push(`操作: ${command.operations.map((operation) => text(operation.name)).join(' / ')}`, '');
      for (const operation of command.operations) appendCommand(operation, `${path} ${operation.name}`);
      return;
    }
    if (!command.options.length) {
      lines.push('固有オプションなし。', '');
      return;
    }
    lines.push('| オプション | 種類 | 必須性 | 省略時 | 受理値・条件 | 説明 |', '|---|---|---|---|---|---|');
    const sorted = command.options.map((option, index) => ({ option, index }))
      .sort((a, b) => (a.option.helpOrder ?? a.index) - (b.option.helpOrder ?? b.index));
    for (const { option } of sorted) {
      if (option.kind !== 'value' && option.kind !== 'flag') throw new Error(`未対応のCLIオプションの種類です：${option.name}`);
      const condition = [option.choices, option.condition].filter((value) => value !== undefined).map(text).join('。') || '追加条件なし';
      lines.push(`| ${text(option.label)} | ${option.kind === 'value' ? '値付き' : 'flag（値なし）'} | ${text(option.required)} | ${text(option.defaultValue)} | ${condition} | ${text(option.description)} |`);
    }
    lines.push('');
  }
  for (const command of definition.commands) appendCommand(command, `loomake ${command.name}`);
  return lines.join('\n');
}

/** @returns {Promise<CliReference>} */
async function loadBuiltDefinition() {
  try {
    const built = await import(new URL('../packages/cli/dist/args.js', import.meta.url).href);
    if (!built.CLI_REFERENCE) throw new Error('ビルド済みファイルにCLIの共通定義がありません');
    return built.CLI_REFERENCE;
  } catch (error) {
    throw new Error('CLIのビルド済み定義を読み込めません。pnpm buildを実行してください', { cause: error });
  }
}

/**
 * @param {{definition?: CliReference, loadDefinition?: () => Promise<CliReference>, outputPath?: string, check?: boolean, stdout?: (text: string) => void, stderr?: (text: string) => void, render?: (definition: CliReference) => string}} options
 */
export async function runCliReference({
  definition,
  loadDefinition = loadBuiltDefinition,
  outputPath = join(root, 'docs/guide/3.reference/5.cli.md'),
  check = false,
  stdout = (text) => console.log(text),
  stderr = (text) => console.error(text),
  render = renderCliReference,
} = {}) {
  try {
    const rendered = render(definition ?? await loadDefinition());
    if (check) {
      const current = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
      if (current !== rendered) {
        stderr(`${outputPath} がCLI定義からの生成内容と違います。${regenerate} で再生成してください。`);
        return 1;
      }
      stdout(`リファレンスは一致しています：${outputPath}`);
    } else {
      writeFileSync(outputPath, rendered, 'utf8');
      stdout(`書き出しました：${outputPath}`);
    }
    return 0;
  } catch (error) {
    stderr(`${outputPath} の生成・照合に失敗しました：${error instanceof Error ? error.message : String(error)}。${regenerate} で再生成してください。`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--check')) {
    console.error('使い方: node scripts/generate-cli-reference.mjs [--check]');
    process.exitCode = 2;
  } else {
    process.exitCode = await runCliReference({ check: args[0] === '--check' });
  }
}
