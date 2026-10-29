import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLI_REFERENCE, type CliCommand } from '../packages/cli/src/args.js';
import { cliReferenceText, renderCliReference, runCliReference } from '../scripts/generate-cli-reference.mjs';

const root = resolve(import.meta.dirname, '..');
const page = join(root, 'docs/guide/3.reference/5.cli.md');
const render = () => renderCliReference(CLI_REFERENCE);

it('[REQ-323][REQ-325] ソース定義から全コマンド・操作と既存ページを再生成できる', () => {
  const rendered = render();
  expect(readFileSync(page, 'utf8').replace(/\r\n/g, '\n')).toBe(rendered);
  for (const command of ['init', 'verify', 'trace', 'run', 'doctor', 'trace record', 'trace report', 'trace answer', 'trace approve']) {
    expect(rendered).toContain(`## loomake ${command}\n`);
  }
  for (const option of ['--codex', '--devcontainer', '--change', '--spec-only', '--done', '--json', '--skip-commands', '--format', '--question', '--answer', '--by', '--date', '--assumption', '--engine', '--dry-run', '--skip-permissions']) {
    expect(rendered).toContain(option);
  }
  expect(rendered).toContain('-h, --help');
  expect(rendered).toContain('-v, --version');
  expect(rendered).toContain('--name value と --name=value');
  expect(rendered).toContain('先頭引数として指定する');
  expect(rendered).toContain('## loomake doctor\n\n使い方: loomake doctor\n');
  expect(rendered).toContain('固有オプションなし。');
  expect(rendered.split('\n').filter((line) => line.startsWith('| --'))).toHaveLength(23);
  expect(rendered).toMatch(/^title: \S/m);
  expect(rendered).toMatch(/^description: \S/m);
  expect(rendered).toContain('packages/cli/src/args.ts');
  expect(rendered).toContain('node scripts/generate-cli-reference.mjs --check');
});

it('[REQ-325] 開発用入口は不正引数とビルド不足を日本語で失敗にする', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-cli-reference-entry-'));
  try {
    const script = join(dir, 'generate-cli-reference.mjs');
    copyFileSync(join(root, 'scripts/generate-cli-reference.mjs'), script);
    const invalid = spawnSync(process.execPath, [script, '--unknown'], { encoding: 'utf8' });
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('使い方:');
    const missing = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('CLIのビルド済み定義を読み込めません');
    expect(missing.stderr).toContain('pnpm build');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CLI生成器の実パスと別名からの起動', () => {
  function withEntrypoint(route: 'real' | 'alias', check: (script: string, outputPath: string, sentinel: string) => void) {
    const directory = mkdtempSync(join(tmpdir(), 'loomake cli entry '));
    try {
      const real = join(realpathSync(directory), 'real');
      const alias = join(directory, 'alias');
      mkdirSync(join(real, 'scripts'), { recursive: true });
      mkdirSync(join(real, 'packages/cli/dist'), { recursive: true });
      mkdirSync(join(real, 'docs/guide/3.reference'), { recursive: true });
      writeFileSync(join(real, 'package.json'), '{"type":"module"}');
      writeFileSync(join(real, 'packages/cli/dist/args.js'), `export const CLI_REFERENCE = ${JSON.stringify(CLI_REFERENCE)};`);
      copyFileSync(join(root, 'scripts/generate-cli-reference.mjs'), join(real, 'scripts/generate-cli-reference.mjs'));
      symlinkSync(real, alias, process.platform === 'win32' ? 'junction' : 'dir');
      const sentinel = join(real, 'unrelated.txt');
      writeFileSync(sentinel, 'unrelated');
      check(join(route === 'real' ? real : alias, 'scripts/generate-cli-reference.mjs'), join(real, 'docs/guide/3.reference/5.cli.md'), sentinel);
      expect(readFileSync(sentinel, 'utf8')).toBe('unrelated');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it.each(['real', 'alias'] as const)('[REQ-325] %s経由でも欠落check1・生成0・一致check0・改変check1を返しcheckで書き換えない', (route) => {
    withEntrypoint(route, (script, outputPath) => {
      const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
      const missing = run('--check');
      expect(missing.status, missing.stderr).toBe(1);
      expect(missing.stdout).toBe('');
      expect(missing.stderr).toContain(outputPath);
      expect(missing.stderr).toContain('再生成してください');
      expect(existsSync(outputPath)).toBe(false);
      const generated = run();
      expect(generated.status, generated.stderr).toBe(0);
      expect(generated.stderr).toBe('');
      expect(generated.stdout).toContain('書き出しました');
      expect(readFileSync(outputPath, 'utf8')).toBe(render());
      const original = readFileSync(outputPath);
      const matched = run('--check');
      expect(matched.status, matched.stderr).toBe(0);
      expect(matched.stderr).toBe('');
      expect(matched.stdout).toContain('リファレンスは一致しています');
      expect(readFileSync(outputPath)).toEqual(original);
      writeFileSync(outputPath, 'modified');
      const modified = run('--check');
      expect(modified.status).toBe(1);
      expect(modified.stdout).toBe('');
      expect(modified.stderr).toContain('生成内容と違います');
      expect(readFileSync(outputPath, 'utf8')).toBe('modified');
    });
  });

  it.each(['real', 'alias'] as const)('[REQ-325] %s経由の不明引数と未対応の組合せは2を返してファイルを作成・変更しない', (route) => {
    withEntrypoint(route, (script, outputPath) => {
      for (const args of [['--unknown'], ['--check', '--unknown'], ['--check', '--check']]) {
        const invalid = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
        expect(invalid.status, invalid.stderr).toBe(2);
        expect(invalid.stdout).toBe('');
        expect(invalid.stderr).toContain('使い方: node scripts/generate-cli-reference.mjs [--check]');
        expect(existsSync(outputPath)).toBe(false);
      }
      writeFileSync(outputPath, 'original');
      expect(spawnSync(process.execPath, [script, '--unknown']).status).toBe(2);
      expect(readFileSync(outputPath, 'utf8')).toBe('original');
    });
  });

  it.each(['real', 'alias'] as const)('[REQ-325] %s経由のimportはargvなし・解決不能・別entryでも無出力でファイルを作成・変更しない', (route) => {
    withEntrypoint(route, (script, outputPath, sentinel) => {
      for (const entry of [undefined, join(outputPath, 'missing'), sentinel]) {
        const code = `process.argv = [process.execPath, ${JSON.stringify(entry) ?? 'undefined'}, '--unknown']; await import(${JSON.stringify(pathToFileURL(script).href)});`;
        const imported = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
        expect(imported.status, imported.stderr).toBe(0);
        expect(imported.stdout).toBe('');
        expect(imported.stderr).toBe('');
        expect(existsSync(outputPath)).toBe(false);
      }
      writeFileSync(outputPath, 'original');
      const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(script).href)});`], { encoding: 'utf8' });
      expect(imported.status, imported.stderr).toBe(0);
      expect(imported.stdout).toBe('');
      expect(imported.stderr).toBe('');
      expect(readFileSync(outputPath, 'utf8')).toBe('original');
    });
  });
});

it('[REQ-323] 入力の必須性・相互条件・動的既定値と受理値を表に残す', () => {
  const rendered = render();
  expect(rendered).toContain('| --codex | flag（値なし） | 任意 | false |');
  expect(rendered).toContain('| --format md&#124;json | 値付き | 任意 | md | md / json |');
  expect(rendered).toContain('| --engine &lt;名前&gt; | 値付き | 任意 | claude-code | claude-code |');
  expect(rendered).toContain('| --question &lt;Q-ID&gt; | 値付き | 必須 | なし |');
  expect(rendered).toContain('| --answer &lt;回答&gt; | 値付き | 必須 | なし |');
  expect(rendered).toContain('| --date YYYY-MM-DD | 値付き | 任意 | 実行環境のローカル日付 |');
  expect(rendered).toContain('条件付き必須');
  expect(rendered).toContain('--change指定時は--doneとのどちらか片方が必須');
  expect(rendered).toContain('LOOMAKE&#95;SANDBOX=1が必要');
  expect(rendered).toContain('trace.mdの確認事項表に存在するID');
  expect(rendered).toContain('英小文字・数字と、間に1つずつのハイフン');
  expect(rendered.indexOf('| --answer')).toBeLessThan(rendered.indexOf('| --by'));
  expect(rendered).not.toContain('--scope');
  expect(rendered).not.toContain('decision');
});

it('[REQ-325] 定義の変更を期待生成内容へ反映し時刻や絶対パスを含めない', () => {
  expect(render()).toBe(render());
  expect(render()).toMatch(/\n$/);
  expect(render()).not.toMatch(/\n\n$/);
  expect(render()).not.toContain(root);
  const changed = { ...CLI_REFERENCE, commands: CLI_REFERENCE.commands.map((command) => ({ ...command, description: `${command.description}追加注記` })) };
  expect(renderCliReference(changed)).not.toBe(render());
  expect(renderCliReference(changed)).toContain('追加注記');
});

it('[REQ-325] Markdown・改行・HTMLを構文として実行せず文字列として表示する', () => {
  const malicious = '|`\\[]*_#<script>alert("x")</script>\r\n次の行';
  const command: CliCommand = {
    name: malicious, usage: malicious, description: malicious,
    options: [{ name: '--x', kind: 'value', label: malicious, description: malicious, required: malicious, defaultValue: malicious, choices: malicious, condition: malicious }],
  };
  const rendered = renderCliReference({ commands: [command], sharedOperations: [{ names: ['--help'], label: malicious, description: malicious, condition: malicious }], syntax: [malicious] });
  expect(rendered).not.toContain('<script>');
  expect(rendered).toContain('&#124;&#96;&#92;&#91;&#93;&#42;&#95;&#35;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>次の行');
  expect(cliReferenceText('a\rb\nc')).toBe('a<br>b<br>c');
  expect(() => cliReferenceText(1)).toThrow('表示値は文字列');
});

describe('CLIリファレンスの生成と読み取り専用check', () => {
  async function withOutput(fn: (outputPath: string, stdout: string[], stderr: string[]) => Promise<void>) {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-cli-reference-'));
    try { await fn(join(dir, 'page.md'), [], []); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('[REQ-325] 書出し・再生成・一致とCRLFのcheckは成功しcheckが改行を変更しない', async () => {
    await withOutput(async (outputPath, stdout, stderr) => {
      const options = { definition: CLI_REFERENCE, outputPath, stdout: (text: string) => stdout.push(text), stderr: (text: string) => stderr.push(text) };
      expect(await runCliReference(options)).toBe(0);
      const first = readFileSync(outputPath, 'utf8');
      expect(await runCliReference(options)).toBe(0);
      expect(readFileSync(outputPath, 'utf8')).toBe(first);
      expect(await runCliReference({ ...options, check: true })).toBe(0);
      writeFileSync(outputPath, first.replace(/\n/g, '\r\n'));
      const bytes = readFileSync(outputPath);
      expect(await runCliReference({ ...options, check: true })).toBe(0);
      expect(readFileSync(outputPath)).toEqual(bytes);
      expect(stderr).toEqual([]);
    });
  });

  it.each(['missing', 'modified', 'definition'] as const)('[REQ-325] %sの不一致を非0と日本語で示し生成物を修復しない', async (kind) => {
    await withOutput(async (outputPath, _stdout, stderr) => {
      const current = kind === 'modified' ? render().replace('省略時', '改変') : render();
      if (kind !== 'missing') writeFileSync(outputPath, current);
      const definition = kind === 'definition' ? { ...CLI_REFERENCE, syntax: [...CLI_REFERENCE.syntax, '新しい説明'] } : CLI_REFERENCE;
      const result = await runCliReference({ definition, outputPath, check: true, stdout: () => {}, stderr: (text) => stderr.push(text) });
      expect(result).toBe(1);
      expect(stderr.join('\n')).toContain(outputPath);
      expect(stderr.join('\n')).toContain('再生成してください');
      if (kind === 'missing') expect(existsSync(outputPath)).toBe(false);
      else expect(readFileSync(outputPath, 'utf8')).toBe(current);
    });
  });

  it.each(['load', 'read', 'render', 'write'] as const)('[REQ-325] %s失敗を非0で返し既存内容を変更しない', async (kind) => {
    await withOutput(async (outputPath, _stdout, stderr) => {
      writeFileSync(outputPath, '元の内容');
      const result = await runCliReference({
        definition: kind === 'load' ? undefined : CLI_REFERENCE,
        loadDefinition: async () => { throw new Error('定義の読取失敗'); },
        outputPath: kind === 'read' || kind === 'write' ? join(outputPath, 'missing.md') : outputPath,
        check: kind !== 'write', stdout: () => {}, stderr: (text) => stderr.push(text),
        render: kind === 'render' ? () => { throw new Error('描画失敗'); } : renderCliReference,
      });
      expect(result).toBe(1);
      expect(stderr.join('\n')).toContain('生成・照合に失敗しました');
      expect(stderr.join('\n')).toContain('再生成してください');
      expect(readFileSync(outputPath, 'utf8')).toBe('元の内容');
    });
  });
});
