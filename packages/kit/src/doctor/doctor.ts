import { existsSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_TEST_REPORT, UsageError, loadConfig, type LoomakeConfig } from '../verify/config.js';

export type DoctorLevel = 'ok' | 'warn' | 'error';

/** 診断の 1 項目。注意と問題には直し方を付ける */
export type DoctorCheck = { level: DoctorLevel; message: string; fix?: string };

export type DoctorOptions = {
  root: string;
  stdout: (text: string) => void;
  /** 実行ファイルを探す PATH。テストで決めるために渡す。省くと process.env.PATH */
  path?: string;
};

const win = process.platform === 'win32';

/** 実行ファイルを PATH と node_modules/.bin から探す。実行はしない（improve-project-onboarding の仮定 A-03） */
function findExecutable(root: string, name: string, path: string): boolean {
  const dirs = [join(root, 'node_modules', '.bin'), ...path.split(delimiter).filter(Boolean)];
  const exts = win ? ['', '.cmd', '.exe', '.bat'] : [''];
  return dirs.some((d) => exts.some((e) => existsSync(join(d, `${name}${e}`)) && statSync(join(d, `${name}${e}`)).isFile()));
}

const git = (root: string, args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const isIgnored = (root: string, path: string) => git(root, ['check-ignore', '-q', '--no-index', '--', path]).status === 0;

/** プロジェクトの導入状態を調べる。ファイルを変えず、品質コマンドも実行しない（REQ-134） */
export function diagnose(root: string, path = process.env.PATH ?? ''): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const ok = (message: string) => checks.push({ level: 'ok', message });
  const warn = (message: string, fix: string) => checks.push({ level: 'warn', message, fix });
  const error = (message: string, fix: string) => checks.push({ level: 'error', message, fix });

  let config: LoomakeConfig | undefined;
  if (!existsSync(join(root, 'loomake.config.json'))) {
    error('loomake.config.json がありません', 'loomake init を実行してください');
  } else {
    try {
      config = loadConfig(root);
      ok('loomake.config.json を読めます');
    } catch (e) {
      if (!(e instanceof UsageError)) throw e;
      error(`loomake.config.json を読めません：${e.message}`, 'loomake.config.json を直してください');
    }
  }
  if (existsSync(join(root, 'AGENTS.md'))) ok('AGENTS.md があります');
  else error('AGENTS.md がありません', 'loomake init を実行してください');

  const openspecDir = config?.openspecDir ?? 'openspec';
  if (existsSync(join(root, openspecDir))) ok(`${openspecDir}/ があります`);
  else error(`${openspecDir}/ がありません`, 'openspec init を実行してください');

  if (config) {
    for (const name of ['lint', 'typecheck', 'test'] as const) {
      const cmd = config.commands[name]?.trim();
      if (!cmd) {
        const fix = `loomake.config.json の commands.${name} に、このプロジェクトで使うコマンドを書いてください`;
        if (name === 'test') error('test のコマンドが設定されていません。要件ごとのテストを確かめられません', fix);
        else warn(`${name} のコマンドが設定されていません`, fix);
        continue;
      }
      const exe = cmd.split(/\s+/)[0];
      if (findExecutable(root, exe, path)) ok(`${name} のコマンド（${cmd}）の ${exe} が見つかります`);
      else error(`${name} のコマンド（${cmd}）の ${exe} が見つかりません`, `${exe} を入れるか、loomake.config.json の commands.${name} を直してください`);
    }
  }

  const report = (config?.tests.report ?? DEFAULT_TEST_REPORT).replace(/^\.\//, '');
  if (git(root, ['--version']).status !== 0) {
    error('git が見つかりません', 'git を入れてください');
  } else if (git(root, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    error('git のリポジトリの中にありません', 'git init を実行してください');
  } else {
    if (isIgnored(root, report)) ok(`テストのレポート（${report}）は .gitignore で除外されています`);
    else error(`テストのレポート（${report}）が .gitignore で除外されていません。loomake run が始められません`, `.gitignore に ${report} の行を足してください`);
    // 証拠の記録の名前は記録のたびに変わるので、置き場の中の仮のパスで調べる（improve-project-onboarding の仮定 A-04）
    if (!isIgnored(root, '.loomake/evidence/doctor-check.json')) ok('証拠の記録（.loomake/evidence/）をコミットできます');
    else
      error(
        '証拠の記録（.loomake/evidence/）が .gitignore で除外されていて、コミットできません',
        '.gitignore で .loomake/ を除外しているなら、.loomake/* と !.loomake/evidence/ の 2 行に分けてください',
      );
  }

  const validate = config?.openspecValidate ?? 'auto';
  if (validate !== false) {
    if (findExecutable(root, 'openspec', path)) ok('openspec コマンドが見つかります');
    else if (validate === true) error('openspec コマンドが見つかりません', 'npm install -g @fission-ai/openspec を実行してください');
    else warn('openspec コマンドが見つかりません。verify は openspec validate を飛ばします', 'npm install -g @fission-ai/openspec を実行してください');
  }
  for (const [name, fix] of [
    ['claude', 'loomake run を使うなら、Claude Code を入れてください'],
    ['gh', 'loomake run で PR を作るなら、GitHub CLI を入れて gh auth login を実行してください'],
  ]) {
    if (findExecutable(root, name, path)) ok(`${name} コマンドが見つかります`);
    else warn(`${name} コマンドが見つかりません`, fix);
  }
  return checks;
}

const MARK: Record<DoctorLevel, string> = { ok: '✔', warn: '⚠', error: '✖' };

/** 診断の結果を表示する。終了コード（問題なし 0・問題あり 1）を返す */
export function runDoctor(options: DoctorOptions): number {
  const checks = diagnose(options.root, options.path);
  const lines = checks.flatMap((c) => [`${MARK[c.level]} ${c.message}`, ...(c.fix ? [`  → ${c.fix}`] : [])]);
  const errors = checks.filter((c) => c.level === 'error').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  options.stdout(['loomake doctor', '', ...lines, '', `問題 ${errors} 件、注意 ${warns} 件`].join('\n'));
  return errors ? 1 : 0;
}
