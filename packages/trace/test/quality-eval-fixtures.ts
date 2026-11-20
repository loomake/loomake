import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { runEval } from '../src/eval.js';
import { readQualityStorage } from '../src/quality-files.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
export const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export function fixture(script = '', commands?: Record<string, string | null>) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-quality-eval-')); roots.push(root);
  mkdirSync(join(root, '.loomake'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.loomake/\nnode_modules/\n');
  writeFileSync(join(root, 'quality.yaml'), 'version: 2\nmodel: iso-iec-25010-2011\nproduct:\n  PQ-001:\n    characteristic: functional_suitability\n    blocking: true\n    evidence:\n      - source: ci.test_report\n        metric: tests_failed\n        target: "== 0"\n');
  writeFileSync(join(root, 'quality-command.cjs'), script || `const fs=require('node:fs');const now=Date.now();fs.writeFileSync('.loomake/test-report.json',JSON.stringify({startTime:now,success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:'test.js',status:'passed',assertionResults:[{fullName:'fixture',status:'passed'}]}]}));`);
  const command = `"${process.execPath}" quality-command.cjs`;
  writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ openspecValidate: false, commands: commands ?? { test: command } }));
  for (const args of [['init', '-q'], ['config', 'user.name', 'Loomake fixture'], ['config', 'user.email', 'fixture@example.invalid'], ['config', 'commit.gpgsign', 'false'], ['add', '.'], ['commit', '-q', '-m', 'fixture']]) git(root, ...args);
  // Explicit local runner metadata fixture; no global or ancestor discovery.
  mkdirSync(join(root, 'node_modules/vitest'), { recursive: true });
  writeFileSync(join(root, 'node_modules/vitest/package.json'), JSON.stringify({ name: 'vitest', version: '5.0.5' }));
  const output: string[] = [], progress: string[] = [];
  return { root, output, progress, evaluate: (extra: Partial<Parameters<typeof runEval>[0]> = {}) => runEval({ root, stdout: (s) => output.push(s), progress: (s) => progress.push(s), ...extra }),
    storage: () => readQualityStorage(root), read: (path: string) => readFileSync(join(root, path), 'utf8') };
}
