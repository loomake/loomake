import { expect, it } from 'vitest';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

it('[REQ-146] ワークスペースのsource条件は4ライブラリのsrcを実際に解決する', () => {
  const root = join(import.meta.dirname, '..');
  for (const name of ['core', 'kit', 'trace', 'runner']) {
    const resolved = spawnSync(process.execPath, ['--conditions=@loomake/source', '--input-type=module', '-e', `console.log(import.meta.resolve('@loomake/${name}'))`], { cwd: join(root, 'packages/cli'), encoding: 'utf8', timeout: 5000 });
    expect(resolved.status, resolved.stdout + resolved.stderr).toBe(0);
    expect(realpathSync(fileURLToPath(resolved.stdout.trim()))).toBe(realpathSync(join(root, 'packages', name, 'src/index.ts')));
  }
}, 25000);
