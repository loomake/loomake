import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { chmodSync, copyFileSync, statSync, readdirSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReport, runEffortRecord } from '../src/index.js';
import { readDocuments } from '../src/documents.js';
import { evidenceValue, evidenceV2Value } from '../../core/test/fixtures/trace-contract-values.js';
import { traceMd, specMd } from '../../kit/test/project.js';
import { reusableEvidence } from '../../runner/src/reuse.js';
import { removeWithRetry } from '../../../tests/helpers/partition-fixture.js';
const roots: string[] = [];
let baselineDir: string | undefined;
beforeAll(() => { baselineDir = project().root; roots.splice(0); });
afterAll(() => { if (baselineDir) removeWithRetry(baselineDir); });
function copyFixture(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const destination = join(to, entry.name);
    if (entry.isDirectory()) copyFixture(source, destination);
    else {
      copyFileSync(source, destination);
      chmodSync(destination, statSync(source).mode);
    }
  }
}

afterEach(() => { for (const root of roots.splice(0)) removeWithRetry(root); });
const git = (root: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=loomake-test', '-c', 'user.email=test@example.com', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim();
};
function project() {
  const root = mkdtempSync(join(tmpdir(), 'loomake-effort-compat-')); roots.push(root);
  const write = (path: string, content: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
  if (baselineDir) copyFixture(baselineDir, root);
  else {
    write('loomake.config.json', '{}'); write('openspec/changes/c1/trace.md', traceMd()); write('openspec/changes/c1/specs/x/spec.md', specMd());
    git(root, 'init', '-q'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'initial');
  }
  const changeDir = join(root, 'openspec/changes/c1');
  const effort = () => runEffortRecord({ root, changeId: 'c1', effort: '0m', stdout: () => {}, now: () => new Date('2026-11-06T00:00:00Z') });
  return { root, write, changeDir, effort };
}
it.each([evidenceValue, evidenceV2Value])('[REQ-466][REQ-066][REQ-127][REQ-128] effort混在でも旧Evidence/Reportの出力と原証拠が不変', (makeEvidence) => {
  const p = project(); const value = makeEvidence();
  const file = `.loomake/evidence/c1/20261024T000000Z-${value.sha.slice(0, 12)}.json`;
  p.write(file, JSON.stringify(value)); git(p.root, 'add', '.'); git(p.root, 'commit', '-qm', 'evidence');
  const raw = readFileSync(join(p.root, file), 'utf8'); const before = buildReport(p.root, 'c1');
  expect(p.effort()).toBe(0); expect(buildReport(p.root, 'c1')).toEqual(before);
  expect(readFileSync(join(p.root, file), 'utf8')).toBe(raw);
});
it('[REQ-466] runnerはeffortコミットを再利用せず既存local証拠だけを再利用する', () => {
  const p = project(); expect(p.effort()).toBe(0); git(p.root, 'add', '.'); git(p.root, 'commit', '-qm', 'effort');
  expect(reusableEvidence(p.root, process.env, 'c1', p.changeDir)).toBeUndefined();
  const sha = git(p.root, 'rev-parse', 'HEAD');
  const file = `.loomake/evidence/c1/20261106T000001Z-${sha.slice(0, 12)}.json`;
  p.write(file, JSON.stringify({ schemaVersion: 2, change: 'c1', sha, committedAt: '2026-11-06T00:00:00Z', recordedAt: '2026-11-06T00:00:01Z', documents: readDocuments(p.changeDir), verify: { schemaVersion: '2.0.0', change: 'c1', scope: 'local', run: { status: 'completed', errors: [] }, checks: [{ id: 'command: test', result: 'PASS', reason: '', evidence: [] }], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1, pending: 0 }, decision: { required: false, reasons: [] } } }));
  git(p.root, 'add', '.'); git(p.root, 'commit', '-qm', 'local evidence');
  expect(reusableEvidence(p.root, process.env, 'c1', p.changeDir)).toBe(file);
});
