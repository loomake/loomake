// リポジトリのルートから実行する。計測用のプロファイルごとにプロセスを分ける。
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = process.cwd();
const profiles = ['small', 'medium', 'boundary', 'file-limit', 'total-limit', 'depth-limit', 'entry-limit', 'json-total-limit', 'prompt-limit'];
const expected = (profile) => profile.endsWith('limit') ? 'rejected' : 'read';
const benchmarkFile = fileURLToPath(import.meta.url);
if (process.argv[2] === '--worker') {
  const profile = process.argv[3];
  const { readDocuments, buildReport } = await import(pathToFileURL(join(root, 'packages/trace/dist/index.js')).href);
  const { UsageError } = await import(pathToFileURL(join(root, 'packages/kit/dist/index.js')).href);
  const dir = mkdtempSync(join(tmpdir(), 'loomake-input-benchmark-'));
  let bytes = 0;
  let operation;
  try {
    if (profile === 'json-total-limit') {
      mkdirSync(join(dir, 'openspec/changes/c1'), { recursive: true });
      writeFileSync(join(dir, 'openspec/changes/c1/trace.md'), '# trace\n');
      writeFileSync(join(dir, 'loomake.config.json'), JSON.stringify({ openspecValidate: false }));
      const evidenceDir = join(dir, '.loomake/evidence/c1'); mkdirSync(evidenceDir, { recursive: true });
      const value = JSON.stringify({ schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), recordedAt: '2026-10-24T00:00:00Z', committedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok: true, results: [], coverage: {} } });
      const block = Buffer.alloc(45 * 1024 * 1024, ' ');
      for (const name of ['a', 'b', 'c']) { const file = join(evidenceDir, `${name}.json`); writeFileSync(file, value); appendFileSync(file, block); bytes += Buffer.byteLength(value) + block.length; }
      operation = () => buildReport(dir, 'c1');
    } else {
      writeFileSync(join(dir, 'trace.md'), '# trace\n'); bytes = 8;
      const specs = join(dir, 'specs'); mkdirSync(specs);
      const count = profile === 'small' || profile === 'medium' ? 64 : profile === 'boundary' ? 16 : profile === 'total-limit' ? 17 : profile === 'entry-limit' ? 4097 : 1;
      for (let index = 0; index < count; index++) {
        const target = profile === 'entry-limit' ? specs : join(specs, `c${index}`);
        if (target !== specs) mkdirSync(target);
        const length = profile === 'small' ? 4096 : profile === 'medium' ? 128 * 1024 : profile === 'file-limit' ? 1024 * 1024 + 1 : profile === 'entry-limit' || profile === 'depth-limit' ? 0 : profile === 'boundary' && index === 15 ? 1024 * 1024 - 8 : 1024 * 1024;
        writeFileSync(join(target, profile === 'entry-limit' ? `${index}.txt` : 'spec.md'), Buffer.alloc(length, ' ')); bytes += length;
      }
      if (profile === 'depth-limit') mkdirSync(join(specs, ...Array.from({ length: 33 }, () => 'd')), { recursive: true });
      if (profile === 'prompt-limit') {
        const { buildPrompt } = await import(pathToFileURL(join(root, 'packages/runner/dist/index.js')).href);
        const failure = { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: false, results: [{ check: 'test', status: 'fail', detail: 'x'.repeat(16 * 1024 * 1024) }] };
        operation = () => buildPrompt(dir, dir, 'task', failure);
      } else operation = () => readDocuments(dir);
    }
    const started = performance.now();
    let status = 'read'; let reason;
    try { operation(); } catch (error) { if (!(error instanceof UsageError)) throw error; status = 'rejected'; reason = error.message.replaceAll(dir, '<fixture>'); }
    console.log(JSON.stringify({ profile, bytes, status, reason, durationMs: Math.round((performance.now() - started) * 100) / 100, peakRssBytes: process.resourceUsage().maxRSS * 1024 }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
} else {
  const target = resolve(process.argv[2] ?? '.loomake/quality/input-benchmark.json');
  const rows = [];
  for (const profile of profiles) {
    const result = spawnSync(process.execPath, [benchmarkFile, '--worker', profile], { cwd: root, encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error(`${profile}: ${result.stderr || result.error?.message}`);
    const row = JSON.parse(result.stdout);
    const budget = { durationMs: profile === 'json-total-limit' ? 3000 : 1000, peakRssBytes: (profile === 'json-total-limit' ? 512 : 256) * 1024 * 1024 };
    rows.push({ ...row, expected: expected(profile), budget, withinBudget: row.durationMs <= budget.durationMs && row.peakRssBytes <= budget.peakRssBytes });
  }
  const sources = ['packages/kit/src/input.ts', 'packages/trace/src/documents.ts', 'packages/trace/src/report.ts', 'packages/runner/src/run.ts'].map((file) => ({ file, sha256: createHash('sha256').update(readFileSync(join(root, file))).digest('hex') }));
  const report = { scope: 'input-reading-on-this-host', node: process.version, platform: process.platform, arch: process.arch, peakIncludesFixtureSetup: true, sources, rows, ok: rows.every((row) => row.status === row.expected && row.withinBudget) };
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ok: report.ok, results: target }));
  if (!report.ok) process.exitCode = 1;
}
