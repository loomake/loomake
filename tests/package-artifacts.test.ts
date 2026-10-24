import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const base = mkdtempSync(join(tmpdir(), 'loomake artifacts '));
const target = join(base, 'prepared');
const run = (mode: string) => spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target], { cwd: root, encoding: 'utf8' });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('実際に配るパッケージ', () => {
  it('[REQ-143][REQ-146][REQ-169] packした5パッケージだけで主要コマンドと公開APIを使える', () => {
    const prepared = run('prepare');
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = run('check');
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toContain('配布物の検証に合格');
    for (const name of ['core', 'kit', 'trace', 'runner']) {
      const manifest = JSON.parse(readFileSync(join(target, 'consumer/node_modules/@loomake', name, 'package.json'), 'utf8'));
      expect(JSON.stringify(manifest.exports)).not.toContain('@loomake/source');
    }
    const manifestPath = join(target, 'consumer/node_modules/loomake/package.json');
    const originalManifest = readFileSync(manifestPath, 'utf8');
    const wrongSource = JSON.parse(originalManifest);
    wrongSource.repository.url = 'git+https://github.com/example/other.git';
    writeFileSync(manifestPath, JSON.stringify(wrongSource));
    const wrong = run('check');
    expect(wrong.status).not.toBe(0);
    expect(wrong.stderr).toContain('repository');
    writeFileSync(manifestPath, originalManifest);
    // テンプレートが欠けた配布物を成功扱いにしないことも確認する。
    rmSync(join(target, 'consumer/node_modules/@loomake/kit/templates/AGENTS.md'));
    const broken = run('check');
    expect(broken.status).not.toBe(0);
    expect(broken.stderr).toContain('AGENTS.md');
  }, 60_000);

  it('[REQ-124] POSIXの配布物を実際のSIGINTで中断する。Windowsでは検証対象外を明示する', () => {
    const checked = spawnSync(process.execPath, ['scripts/run-sigint-smoke.mjs', target], { cwd: root, encoding: 'utf8', timeout: 30000 });
    if (process.platform === 'win32') {
      expect(checked.status).toBe(1);
      expect(checked.stderr).toContain('この検証はPOSIXのSIGINTを対象にしています');
    } else {
      expect(checked.status, checked.stdout + checked.stderr).toBe(0);
      const result = JSON.parse(readFileSync(join(target, 'sigint-results/results.json'), 'utf8'));
      expect(result).toMatchObject({ requirement: 'REQ-124', ok: true, platform: process.platform, signal: 'SIGINT', exit: { code: 1, signal: null }, summary: { status: 'interrupted', doneTasks: ['1.1 最初の変更'], remainingTasks: ['1.2 途中の変更', '2.1 品質を確認する'] }, partial: 'unfinished\n' });
    }
  }, 35000);
});
