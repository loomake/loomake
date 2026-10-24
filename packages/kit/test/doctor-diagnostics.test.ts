import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { runDoctor } from '../src/doctor/doctor.js';
import * as processes from '../src/process.js';
const windows = process.platform === 'win32';

function fixture(action: (root: string, bin: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-doctor-details ')); const bin = join(root, 'bin');
  try {
    mkdirSync(bin); mkdirSync(join(root, 'openspec'));
    writeFileSync(join(root, 'AGENTS.md'), '# Rules');
    writeFileSync(join(root, '.gitignore'), '.loomake/test-report.json\n');
    for (const name of ['pnpm', 'npm', 'yarn', 'claude', 'gh']) { const file = join(bin, windows ? `${name}.cmd` : name); writeFileSync(file, ''); chmodSync(file, 0o755); }
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "throw Error(1)"', lint: 'unused', typecheck: 'unused' } }));
    config(root, 'pnpm test'); spawnSync('git', ['init', '-q'], { cwd: root });
    action(root, bin);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const config = (root: string, command: string) => writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ openspecValidate: false, commands: { test: command, lint: 'pnpm lint', typecheck: 'pnpm typecheck' } }));
const run = (root: string, path: string) => { let text = ''; const code = runDoctor({ root, path, stdout: (value) => { text += value; } }); return { code, text }; };
function snapshot(root: string): Record<string, string> {
  const files = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.name === '.git' ? [] : entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
  return Object.fromEntries(files(root).map((p) => [relative(root, p), readFileSync(p, 'utf8')]));
}

describe('品質コマンドと診断範囲', () => {
  it.each(['npm test', 'npm run test', 'pnpm test', 'pnpm run test'])('[REQ-184] %sのscript欠落を検出する', (command) => fixture((root, bin) => {
    config(root, command); writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'x', typecheck: 'x' } }));
    const result = run(root, bin); expect(result.code).toBe(1); expect(result.text).toContain('scripts.test'); expect(result.text).toContain('空でない文字列');
  }));
  it.each(['null', '[]', '{', '{"scripts":[]}', '{"scripts":{"test":"  "}}', '{"scripts":{"test":12}}'])('[REQ-184] package.jsonの不正な形%sを問題にする', (manifest) => fixture((root, bin) => {
    writeFileSync(join(root, 'package.json'), manifest); const result = run(root, bin);
    expect(result.code).toBe(1); expect(result.text).toContain('package.json');
  }));
  it('[REQ-184] package.jsonの上限を超える内容を問題にする', () => fixture((root, bin) => {
    writeFileSync(join(root, 'package.json'), ' '.repeat(1024 * 1024 + 1)); const result = run(root, bin);
    expect(result.code).toBe(1); expect(result.text).toContain('上限');
  }));
  it('[REQ-184][REQ-185] 実行せず変更せず、存在と未確認の範囲を分ける', () => fixture((root, bin) => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: `node -e "require('node:fs').writeFileSync('executed','x')"`, lint: 'unused', typecheck: 'unused' } }));
    const before = snapshot(root); const result = run(root, bin);
    expect(result.code).toBe(0); expect(result.text).toContain('scripts.test を確認');
    expect(result.text).toContain('未確認：品質コマンドの成功・レポート生成・認証・ネットワーク接続');
    expect(snapshot(root)).toEqual(before); expect(existsSync(join(root, 'executed'))).toBe(false);
  }));
  it.each(['CI=1 pnpm test', 'pnpm test && echo ok', 'pnpm --filter app test', 'yarn test', 'yarn run test'])('[REQ-185] %sは未確認の注意とし、不存在と断定しない', (command) => fixture((root, bin) => {
    config(root, command); writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'x', typecheck: 'x' } }));
    const result = run(root, bin); expect(result.code).toBe(0); expect(result.text).toContain('⚠'); expect(result.text).toContain('未確認'); expect(result.text).not.toContain('✖ test');
  }));
  it('[REQ-186] 引用付きの実行ファイルを見つける', () => fixture((root, bin) => {
    const file = join(bin, windows ? 'custom tool.cmd' : 'custom tool'); writeFileSync(file, ''); chmodSync(file, 0o755); config(root, `"${file}" test`);
    expect(run(root, bin).code).toBe(0);
  }));
  it('[REQ-186] 実行できないファイルを合格にしない', () => fixture((root, bin) => {
    // Windowsはディレクトリ、POSIXは実行権限のない通常ファイルを候補にする。
    const file = join(bin, windows ? 'notexec.cmd' : 'notexec'); if (windows) mkdirSync(file); else { writeFileSync(file, ''); chmodSync(file, 0o644); }
    config(root, 'notexec'); const result = run(root, bin); expect(result.code).toBe(1); expect(result.text).toContain('notexec が見つかりません');
  }));
  it('[REQ-186] AGENTS.mdとopenspecの種類を確認する', () => fixture((root, bin) => {
    rmSync(join(root, 'AGENTS.md')); mkdirSync(join(root, 'AGENTS.md')); rmSync(join(root, 'openspec'), { recursive: true }); writeFileSync(join(root, 'openspec'), 'file');
    const result = run(root, bin); expect(result.code).toBe(1); expect(result.text).toContain('AGENTS.md を通常のファイル'); expect(result.text).toContain('openspec/ をディレクトリ');
  }));
});

describe('Gitの診断の境界', () => {
  it('[REQ-187] 共有期限の終了をGit不存在と混同しない', () => fixture((root, bin) => {
    const result = processes.withProcessBudget({ timeoutMs: 1 }, () => { const start = Date.now(); while (Date.now() - start < 5) { /* 先に期限を使い切る。 */ } return run(root, bin); });
    expect(result.code).toBe(1); expect(result.text).toContain('実行時間の上限'); expect(result.text).not.toContain('git が見つかりません'); expect(result.text).not.toContain('レポート（.loomake/test-report.json）が .gitignore で除外されていません');
  }));
  it('[REQ-187] 実際にGit設定が壊れた場合は除外状態を断定しない', () => fixture((root, bin) => {
    writeFileSync(join(root, '.git/config'), '[broken\n');
    const result = run(root, bin);
    expect(result.code).toBe(1);
    expect(result.text).toContain('git の状態を確認できません');
    expect(result.text).not.toContain('git が見つかりません');
    expect(result.text).not.toContain('除外されていません');
    expect(result.text).toContain('git status');
  }));
  it('[REQ-187] check-ignoreの異常終了を未除外と解釈しない', () => fixture((root, bin) => {
    const original = processes.runExternal;
    const spy = vi.spyOn(processes, 'runExternal').mockImplementation((command, args, options) => args[0] === 'check-ignore' ? original(process.execPath, ['-e', 'process.exit(128)'], options) : original(command, args, options));
    try {
      const result = run(root, bin); expect(result.code).toBe(1); expect(result.text).toContain('git の状態を確認できません'); expect(result.text).not.toContain('除外されていません');
    } finally { spy.mockRestore(); }
  }));
});
