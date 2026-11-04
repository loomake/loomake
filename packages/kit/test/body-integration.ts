import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { BodyEvidence } from '@loomake/core';
import { withProject } from './project.js';

export type IntegrationCase = { fullName: string; status: string; meta: { loomakeBody?: BodyEvidence }; failureMessages: string[] };
export type IntegrationEvent = {
  label: string; invocation: number; kind: string; phase: number; pid: number; threadId: number; activeTokenOpen: boolean | null; originalOpen?: boolean; originalRetry?: number; caseName?: string; file: string; task: string;
  retry: number; repeat: number; state: string; fnCalls?: number; evidence: BodyEvidence | null;
  token: { id: string; task: string; retry: number; repeat: number; open: boolean } | null;
};
type Report = { testResults: { assertionResults: IntegrationCase[] }[] };
const repository = join(import.meta.dirname, '../../..');
const vitestBin = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
function fixture(name: string): string {
  return readFileSync(join(repository, 'tests/fixtures', `vitest-body-${name}.mjs.txt`), 'utf8');
}
const customBase = `
import { event, sleep } from './observe.mjs';
class Custom extends TestRunner {
  constructor(...args) { super(...args); if (own) { this.runTask = task => this.execute(task); this.extendTaskContext = ctx => this.extend(ctx); } }
  extend(ctx) { event('Base', 0, 'context', ctx); return ctx; }
  extendTaskContext(ctx) { return this.extend(ctx); }
  runTask(task) { return this.execute(task); }
  async execute(task) {
    const ctx = task.context;
    const token = ctx[Symbol.for('loomake.body.attempt.v1')]?.();
    const invocation = task.result.retryCount;
    const captured = () => ({ caseName: task.name, ...(token ? { originalOpen: token.open, originalRetry: token.retry } : {}) });
    event('Base', invocation, 'delegate-start', ctx, captured());
    try { return await TestRunner.getTestFn(task)(); }
    finally {
      event('Base', invocation, 'wrapper-settled', ctx, captured());
      if (task.name.includes('[K01]') && invocation === 0) await sleep(140);
      event('Base', invocation, 'delegate-ending', ctx, captured());
      setTimeout(() => event('Base', invocation, 'delegate-settled', ctx, captured()), 0);
    }
  }
}
`;
export function runBodyIntegration(options: {
  mode: 'identity' | 'product'; fixture: 'late-cases' | 'auto-cases' | 'cleanup-cases' | 'files-cases';
  isolate?: boolean; aroundEach?: boolean; custom?: 'prototype' | 'own'; rerun?: boolean;
}) {
  const api = pathToFileURL(join(import.meta.dirname, '../src/index.ts')).href;
  const files: Record<string, string> = {
    'first.test.mjs': fixture(options.fixture),
    'observe.mjs': fixture('observe'),
    'body.mjs': `import { chai } from 'vitest';import { createBodyRecorder } from ${JSON.stringify(api)};
const factory = ${JSON.stringify(options.mode)} === 'identity' ? () => (_ctx, fn) => fn() : createBodyRecorder;
export const body = factory(chai);export const secondBody = factory(chai);`,
    'mode.mjs': `export const hookEnabled = ${!!options.aroundEach};`,
    'phase.json': '0',
    'trace.jsonl': '',
    'runner.mjs': `import { TestRunner } from 'vitest';import { createBodyRunner } from ${JSON.stringify(api)};
const own = ${options.custom === 'own'};
${options.custom ? customBase : ''}
const Base = ${options.custom ? 'Custom' : 'TestRunner'};
export default ${options.mode === 'product' ? 'createBodyRunner(Base)' : 'Base'};`,
    'vitest.config.mjs': `export default { test: { runner: './runner.mjs', include: ['*.test.mjs'],
${options.isolate === undefined ? '' : `isolate: ${options.isolate},`}
fileParallelism: false, maxWorkers: 1, hookTimeout: 1000, reporters: ['json'], outputFile: 'report.json' } };`,
  };
  if (options.rerun) files['second.test.mjs'] = files['first.test.mjs'];
  return withProject({ quality: true, files }, root => {
    if (options.rerun) writeFileSync(join(root, 'driver.mjs'), `
import { createVitest } from 'vitest/node';import { readFileSync, writeFileSync } from 'node:fs';
const ctx = await createVitest('test', { root: ${JSON.stringify(root)}, config: ${JSON.stringify(join(root, 'vitest.config.mjs'))}, watch: true });
try {
  await ctx.start();writeFileSync('report-0.json', readFileSync('report.json'));
  writeFileSync('phase.json', '1');
  await ctx.rerunTestSpecifications(await ctx.getRelevantTestSpecifications());
  writeFileSync('report-1.json', readFileSync('report.json'));
} finally { await ctx.close(); }
`);
    const args = options.rerun ? [join(root, 'driver.mjs')] : [vitestBin, 'run', '--config', 'vitest.config.mjs'];
    const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 45_000 });
    const read = (name: string) => existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : '';
    const reports = options.rerun ? [read('report-0.json'), read('report-1.json')] : [read('report.json')];
    const rawRoot = join(repository, '.loomake/collector-376-integration');
    mkdirSync(rawRoot, { recursive: true });
    const raw = mkdtempSync(join(rawRoot, `${options.fixture}-${options.mode}-`));
    const outcome = { options, command: [process.execPath, ...args], status: run.status, signal: run.signal,
      error: run.error ? { message: run.error.message } : null, node: process.version,
      vitest: JSON.parse(readFileSync(createRequire(import.meta.url).resolve('vitest/package.json'), 'utf8')) as { version: string } };
    writeFileSync(join(raw, 'outcome.json'), JSON.stringify(outcome, null, 2));
    writeFileSync(join(raw, 'sources.json'), JSON.stringify(files, null, 2));
    writeFileSync(join(raw, 'stdout.txt'), run.stdout); writeFileSync(join(raw, 'stderr.txt'), run.stderr);
    for (const name of ['trace.jsonl', 'events.jsonl', 'report.json', 'report-0.json', 'report-1.json', 'driver.mjs']) writeFileSync(join(raw, name), read(name));
    return { ...outcome, raw, stdout: run.stdout, stderr: run.stderr,
      cases: reports.map(report => report ? (JSON.parse(report) as Report).testResults.flatMap(file => file.assertionResults) : []),
      events: read('trace.jsonl').split('\n').filter(Boolean).map(line => JSON.parse(line) as IntegrationEvent),
      autoEvents: read('events.jsonl').split('\n').filter(Boolean).map(line => (JSON.parse(line) as { kind: string }).kind),
    };
  });
}
