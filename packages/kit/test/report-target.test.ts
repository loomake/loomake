import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/verify/config.js';

function project(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-report-target-'));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
describe('report target', () => {
  it('[REQ-424][REQ-172] rejects malformed report paths before use', () => {
    for (const report of ['../outside.json', '/absolute.json', 'C:\\report.json', 'a/../r.json', 'reports/', '.', 'a/.', 'a\n.json', '']) {
      project((root) => {
        writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report } }));
        expect(() => loadConfig(root), JSON.stringify(report)).toThrow();
      });
    }
  });
  it('[REQ-424] shares normalized report paths', () => project((root) => {
    writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report: './a\\b//./r.json' } }));
    expect(loadConfig(root).tests.report).toBe('a/b/r.json');
  }));
  it('[REQ-424] checks default report paths with and without config', () => {
    for (const configured of [false, true]) project((root) => {
      mkdirSync(join(root, 'outside'));
      const projectRoot = join(root, 'p'); mkdirSync(projectRoot);
      symlinkSync(join(root, 'outside'), join(projectRoot, '.loomake'), 'dir');
      if (configured) writeFileSync(join(projectRoot, 'loomake.config.json'), '{}');
      expect(() => loadConfig(projectRoot)).toThrow(/tests.report/);
    });
  });
  it('[REQ-424] rejects directories, dangling links and non-directory ancestors', () => {
    for (const kind of ['directory', 'dangling', 'ancestor']) project((root) => {
      if (kind === 'directory') mkdirSync(join(root, 'report'));
      if (kind === 'dangling') symlinkSync(join(root, 'missing'), join(root, 'report'));
      if (kind === 'ancestor') writeFileSync(join(root, 'report'), 'file');
      writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report: kind === 'ancestor' ? 'report/r.json' : 'report' } }));
      expect(() => loadConfig(root)).toThrow(/tests.report/);
    });
  });
  it('[REQ-424] permits a final symlink to an internal regular file', () => project((root) => {
    writeFileSync(join(root, 'target.json'), '{}'); symlinkSync(join(root, 'target.json'), join(root, 'report'));
    writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report: 'report' } }));
    expect(loadConfig(root).tests.report).toBe('report');
  }));
});
