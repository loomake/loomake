import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { createInputReader } from '../input.js';
import { runExternal, withProcessBudget } from '../process.js';
import { classifyCommand } from './command.js';
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

function kind(path: string, directory = false): boolean {
  try { const stats = statSync(path); return directory ? stats.isDirectory() : stats.isFile(); } catch { return false; }
}
/** 実行ファイルを探す。品質コマンドを実行せず、パスとPOSIXの権限を確認する。 */
function findExecutable(root: string, name: string, path: string): boolean {
  const direct = isAbsolute(name) || /[/\\]/.test(name);
  const candidates = direct ? [resolve(root, name)] : [join(root, 'node_modules', '.bin'), ...path.split(delimiter).filter(Boolean)].map((dir) => join(dir, name));
  const exts = win ? ['', '.cmd', '.exe', '.bat', '.com'] : [''];
  return candidates.some((base) => exts.some((ext) => {
    const file = base + ext;
    try { if (!kind(file)) return false; if (!win) accessSync(file, constants.X_OK); return true; } catch { return false; }
  }));
}
const git = (root: string, args: string[]) => runExternal('git', args, { cwd: root });
function isIgnored(root: string, path: string): boolean {
  const result = git(root, ['check-ignore', '-q', '--no-index', '--', path]);
  if (result.error || (result.status !== 0 && result.status !== 1)) throw new UsageError(`git check-ignore が正常な判定を返しません（終了コード ${result.status ?? 'なし'}）`);
  return result.status === 0;
}

/** プロジェクトの導入状態を調べる。ファイルを変えず、品質コマンドも実行しない（REQ-134） */
export function diagnose(root: string, path = process.env.PATH ?? ''): DoctorCheck[] {
  return withProcessBudget({ timeoutMs: 30_000 }, () => diagnoseProject(root, path));
}

function diagnoseProject(root: string, path: string): DoctorCheck[] {
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
  if (existsSync(join(root, 'AGENTS.md')) && !kind(join(root, 'AGENTS.md'))) error('AGENTS.md を通常のファイルにしてください', 'AGENTS.md の種類と配置を確認してください');
  else if (kind(join(root, 'AGENTS.md'))) ok('AGENTS.md があります');
  else error('AGENTS.md がありません', 'loomake init を実行してください');

  const openspecDir = config?.openspecDir ?? 'openspec';
  if (existsSync(resolve(root, openspecDir)) && !kind(resolve(root, openspecDir), true)) error(`${openspecDir}/ をディレクトリにしてください`, 'openspecDir の設定と配置を確認してください');
  else if (kind(resolve(root, openspecDir), true)) ok(`${openspecDir}/ があります`);
  else error(`${openspecDir}/ がありません`, 'openspec init を実行してください');

  if (config) {
    let manifest: Record<string, unknown> | undefined;
    let manifestError: string | undefined;
    let reportedManifestError = false;
    const scripts = () => {
      if (manifest || manifestError) return manifest;
      try {
        const text = createInputReader().read(join(root, 'package.json'));
        let value: unknown;
        try { value = JSON.parse(text); } catch { throw new UsageError('package.json のJSON形式が不正です'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UsageError('package.json はオブジェクトにしてください');
        const entries = (value as Record<string, unknown>).scripts;
        if (entries !== undefined && (!entries || typeof entries !== 'object' || Array.isArray(entries))) throw new UsageError('package.json の scripts はオブジェクトにしてください');
        manifest = (entries ?? {}) as Record<string, unknown>;
      } catch (cause) { manifestError = `package.json を確認できません：${(cause as Error).message}`; }
      return manifest;
    };
    for (const name of ['lint', 'typecheck', 'test'] as const) {
      const cmd = config.commands[name]?.trim();
      if (!cmd) {
        const fix = `loomake.config.json の commands.${name} に、このプロジェクトで使うコマンドを書いてください`;
        if (name === 'test') error('test のコマンドが設定されていません。要件ごとのテストを確かめられません', fix);
        else warn(`${name} のコマンドが設定されていません`, fix);
        continue;
      }
      const plan = classifyCommand(cmd, win);
      if (plan.kind === 'unsupported') {
        warn(`${name} のコマンドの静的診断は未確認です：${plan.reason}`, `commands.${name} と実際に使う環境を確認してください。doctor はこのコマンドを実行しません`);
        continue;
      }
      const exe = plan.executable;
      if (!findExecutable(root, exe, path)) {
        error(`${name} のコマンド（${cmd}）の ${exe} が見つかりません`, `${exe} を入れるか、loomake.config.json の commands.${name} を直してください`);
        continue;
      }
      ok(`${name} のコマンド（${cmd}）の ${exe} が見つかります`);
      if (plan.kind !== 'script') continue;
      const entries = scripts();
      if (!entries) {
        if (!reportedManifestError) error(manifestError!, 'package.json の形式・容量・読み取り権限を確認してください');
        reportedManifestError = true;
        continue;
      }
      const script = Object.hasOwn(entries, plan.script) ? entries[plan.script] : undefined;
      if (typeof script === 'string' && script.trim()) ok(`${name} の package.json の scripts.${plan.script} を確認しました（存在の確認のみ）`);
      else if (plan.manager === 'yarn') warn(`${name} の Yarn の解決先は未確認です。ルートの scripts.${plan.script} に空でない文字列がありません`, 'package.json と依存のバイナリ・workspaceの設定を確認してください');
      else error(`${name} の package.json の scripts.${plan.script} に空でない文字列がありません`, `package.json の scripts.${plan.script} と commands.${name} を確認してください`);
    }
  }

  const report = (config?.tests.report ?? DEFAULT_TEST_REPORT).replace(/^\.\//, '');
  try {
    const version = git(root, ['--version']);
    if (version.error?.code === 'ENOENT') error('git が見つかりません', 'git を入れてください');
    else {
      if (version.error || version.status !== 0) throw new UsageError('git --version が正常に終了しません');
      const repository = git(root, ['rev-parse', '--is-inside-work-tree']);
      if (repository.error || repository.status !== 0) throw new UsageError('リポジトリの状態を確認できません');
      if (isIgnored(root, report)) ok(`テストのレポート（${report}）は .gitignore で除外されています`);
      else error(`テストのレポート（${report}）が .gitignore で除外されていません。loomake run が始められません`, `.gitignore に ${report} の行を足してください`);
      if (!isIgnored(root, '.loomake/evidence/doctor-check.json')) ok('証拠の記録（.loomake/evidence/）をコミットできます');
      else error('証拠の記録（.loomake/evidence/）が .gitignore で除外されていて、コミットできません', '.gitignore で .loomake/ を除外しているなら、.loomake/* と !.loomake/evidence/ の 2 行に分けてください');
    }
  } catch (cause) {
    if (!(cause instanceof UsageError)) throw cause;
    error(`git の状態を確認できません：${cause.message}`, 'このディレクトリで git status を実行し、設定・権限と停止理由を確認してください');
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
  options.stdout(['loomake doctor', '', ...lines, '', `問題 ${errors} 件、注意 ${warns} 件`, '', '確認範囲：導入パス・実行ファイル・単純なscriptの存在・Gitの除外設定', '未確認：品質コマンドの成功・レポート生成・認証・ネットワーク接続'].join('\n'));
  return errors ? 1 : 0;
}
