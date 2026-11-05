import type { ParseResult } from '../parse.js';
import { requirementIds, type TestCaseStatus } from '../test-report.js';
import { childPath, readJson, type OutputPath, type OutputReader } from './json.js';
import type { PlaywrightTestCase, ToolObservation } from './types.js';

const OUTCOMES: readonly PlaywrightTestCase['outcome'][] = ['expected', 'unexpected', 'flaky', 'skipped'];
type Titles = { title: string; parent: Titles | null };
type SuiteFrame = { input: unknown; path: OutputPath; titles: Titles | null; root: boolean };

function fullName(titles: Titles | null, title: string): string {
  const names = [title];
  while (titles) { names.push(titles.title); titles = titles.parent; }
  return names.reverse().join(' > ');
}

function statusOf(outcome: PlaywrightTestCase['outcome'], expected: string): TestCaseStatus {
  if (outcome === 'unexpected') return 'failed';
  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'flaky') return 'other';
  return expected === 'passed' ? 'passed' : expected === 'skipped' ? 'skipped' : 'other';
}

function readSpec(r: OutputReader, input: unknown, path: OutputPath, titles: Titles | null, tests: PlaywrightTestCase[]): void {
  const spec = r.object(input, path);
  const title = r.string(spec.title, childPath(path, '.title'));
  const file = r.string(spec.file, childPath(path, '.file'));
  for (const [i, item] of r.array(spec.tests, childPath(path, '.tests')).entries()) {
    const testPath = childPath(path, `.tests[${i}]`);
    const test = r.object(item, testPath);
    const outcome = r.enumValue(test.status, OUTCOMES, childPath(testPath, '.status'));
    const expected = r.string(test.expectedStatus, childPath(testPath, '.expectedStatus'));
    const project = r.string(test.projectName, childPath(testPath, '.projectName'));
    let retries = 0;
    for (const [j, item] of r.array(test.results, childPath(testPath, '.results')).entries()) {
      const resultPath = childPath(testPath, `.results[${j}]`);
      const result = r.object(item, resultPath);
      retries = Math.max(retries, r.integer(result.retry, childPath(resultPath, '.retry')));
      if (r.errors.length) return;
    }
    if (r.errors.length) return;
    const name = fullName(titles, title);
    tests.push({ file, fullName: name, requirements: requirementIds(name), status: statusOf(outcome, expected), project, outcome, retries });
  }
}

export function parsePlaywrightReport(file: string, text: string): ParseResult<ToolObservation | null> {
  const { reader: r, value } = readJson(file, text);
  const report = r.object(value, 'report');
  const roots = r.array(report.suites, 'suites');
  const tests: PlaywrightTestCase[] = [];
  const stack: SuiteFrame[] = [];
  for (let i = roots.length - 1; i >= 0; i--) stack.push({ input: roots[i], path: `suites[${i}]`, titles: null, root: true });
  while (stack.length && !r.errors.length) {
    const frame = stack.pop();
    if (!frame) break;
    const suite = r.object(frame.input, frame.path);
    const title = r.string(suite.title, childPath(frame.path, '.title'));
    r.string(suite.file, childPath(frame.path, '.file'));
    const titles = frame.root ? null : { title, parent: frame.titles };
    for (const [i, input] of r.array(suite.specs, childPath(frame.path, '.specs')).entries()) {
      readSpec(r, input, childPath(frame.path, `.specs[${i}]`), titles, tests);
      if (r.errors.length) break;
    }
    const suites = r.array(suite.suites, childPath(frame.path, '.suites'), true);
    for (let i = suites.length - 1; i >= 0; i--) {
      stack.push({ input: suites[i], path: childPath(frame.path, `.suites[${i}]`), titles, root: false });
    }
  }
  const errors = r.array(report.errors, 'errors').map((input, i) => {
    const path = `errors[${i}]`;
    const error = r.object(input, path);
    return { message: r.optionalString(error.message, `${path}.message`) };
  });
  const inputStats = r.object(report.stats, 'stats');
  const stats = {
    expected: r.integer(inputStats.expected, 'stats.expected'), unexpected: r.integer(inputStats.unexpected, 'stats.unexpected'),
    flaky: r.integer(inputStats.flaky, 'stats.flaky'), skipped: r.integer(inputStats.skipped, 'stats.skipped'),
  };
  return r.finish({ tool: 'playwright', kind: 'tests', tests, stats, errors });
}
