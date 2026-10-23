import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const base = mkdtempSync(join(tmpdir(), 'loomake artifacts '));
const target = join(base, 'prepared');
const run = (mode: string) => spawnSync(process.execPath, ['scripts/package-smoke.mjs', mode, target], { cwd: root, encoding: 'utf8' });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('実際に配るパッケージ', () => {
  it('[REQ-143][REQ-146] packした5パッケージだけで主要コマンドと公開APIを使える', () => {
    const prepared = run('prepare');
    expect(prepared.status, prepared.stdout + prepared.stderr).toBe(0);
    const checked = run('check');
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(checked.stdout).toContain('配布物の検証に合格');
    for (const name of ['core', 'kit', 'trace', 'runner']) {
      const manifest = JSON.parse(readFileSync(join(target, 'consumer/node_modules/@loomake', name, 'package.json'), 'utf8'));
      expect(JSON.stringify(manifest.exports)).not.toContain('@loomake/source');
    }
    // テンプレートが欠けた配布物を成功扱いにしないことも確認する。
    rmSync(join(target, 'consumer/node_modules/@loomake/kit/templates/AGENTS.md'));
    const broken = run('check');
    expect(broken.status).not.toBe(0);
    expect(broken.stderr).toContain('AGENTS.md');
  }, 60_000);
});
