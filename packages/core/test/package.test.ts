import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const pkgDir = join(import.meta.dirname, '..');

describe('@loomake/core のパッケージ', () => {
  it('[REQ-046] dependencies を持たない', () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });
});

describe('OpenSpec 書式との互換', () => {
  it('[REQ-052][REQ-058] Source 行と trace.md を含む change が openspec validate --strict を通る', () => {
    const cwd = join(pkgDir, 'test', 'fixtures', 'openspec-project');
    const r = spawnSync('pnpm', ['exec', 'openspec', 'validate', 'add-x', '--strict'], {
      cwd,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});
