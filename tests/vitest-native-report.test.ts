import { it, expect } from 'vitest';
import { parseTestReport, extractTestRequirements } from '../packages/core/src/index.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { withProject } from '../packages/kit/test/project.js';
const vitestBin = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
it('[REQ-015][REQ-319] native Vitestの52境界を既存JSONパーサで読む', { timeout: 60_000 }, () => withProject({ quality: true, files: {
  'native.test.mjs': readFileSync(new URL('./fixtures/vitest-body-cases.mjs.txt', import.meta.url), 'utf8'),
  'body.mjs': 'export const createBodyRecorder=()=> (_ctx,fn)=>fn();export const body=createBodyRecorder();',
} }, root => {
  const run = spawnSync(process.execPath, [vitestBin, 'run', 'native.test.mjs', '--reporter=json', '--outputFile=.loomake/native.json'], { cwd: root, encoding: 'utf8', timeout: 45_000 });
  const text = readFileSync(join(root, '.loomake/native.json'), 'utf8');
  const document = JSON.parse(text) as { testResults: { name: string; assertionResults: { fullName: string; status: string; meta?: unknown }[] }[] };
  const parsed = parseTestReport('native.json', text);
  expect(run.error).toBeUndefined();
  expect(run.signal).toBeNull();
  expect(run.status, run.stdout + run.stderr).toBe(1);
  expect(parsed.errors).toEqual([]);
  expect(parsed.value.tests).toHaveLength(52);
  expect(parsed.value.tests.reduce<Record<string, number>>((counts, test) => { counts[test.status] = (counts[test.status] ?? 0) + 1; return counts; }, {})).toEqual({ passed: 44, failed: 6, skipped: 1, todo: 1 });
  expect(parsed.value.tests.map(test => [test.fullName, test.status])).toEqual(document.testResults.flatMap(file => file.assertionResults.map(test => [test.fullName, test.status])));
  expect(extractTestRequirements('native.json', text)).toEqual({ value: { [document.testResults[0].name]: ['REQ-393'] }, errors: [] });
  document.testResults[0].assertionResults[0].meta = { future: { attempts: [{ state: 'pass', calls: { toBe: 1 } }] } };
  expect(parseTestReport('native.json', JSON.stringify(document))).toEqual(parsed);
}));
