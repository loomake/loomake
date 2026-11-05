import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadVerifyQualitySchema } from '@loomake/kit';
import { runRecord } from '../src/record.js';
import { runReuse, type ReuseOptions } from '../src/reuse.js';
import { placeCiQuality, reportJson, specMd, traceMd } from '../../kit/test/project.js';
export const qualitySchema = await loadVerifyQualitySchema();
export function reuseProject(changeId = 'c1') {
    const outer = mkdtempSync(join(tmpdir(), 'loomake-reuse-'));
    const root = join(outer, 'repo');
    mkdirSync(root);
    const write = (path: string, text: string | Uint8Array) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const commit = () => { git('add', '-A'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
    const report = reportJson(root, { 'tests/x.test.ts': [['[REQ-012] fixture', 'passed']] });
    write('count.mjs', `import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('.loomake',{recursive:true}); appendFileSync('.loomake/count.log',process.argv[2]+'\\n'); if(process.argv[2]==='test')writeFileSync('.loomake/test-report.json',JSON.stringify({...JSON.parse(${JSON.stringify(report)}),startTime:Date.now()}));`);
    write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { lint: 'node count.mjs lint', typecheck: 'node count.mjs typecheck', test: 'node count.mjs test' } }));
    write('.gitignore', '.loomake/test-report.json\n.loomake/count.log\n');
    write(`openspec/changes/${changeId}/proposal.md`, '# fixture\n## Why\nfixture\n');
    write(`openspec/changes/${changeId}/tasks.md`, '- [x] fixture\n');
    write(`openspec/changes/${changeId}/trace.md`, traceMd());
    write(`openspec/changes/${changeId}/specs/x/spec.md`, specMd());
    git('init', '-q');
    placeCiQuality(root);
    writeFileSync(join(root, '.git/info/exclude'), 'node_modules/\n');
    const source = commit();
    const messages: string[] = [];
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '007', GITHUB_RUN_ATTEMPT: '1' };
    const code = runRecord({ root, changeId, qualitySchema, env, stdout: s => messages.push(s), now: () => new Date('2026-11-06T00:00:00Z') });
    if (code !== 0)
        throw new Error('fixture record failed: ' + messages.join('\n'));
    const summaryPath = `.loomake/evidence/${changeId}/${readdirSync(join(root, '.loomake/evidence', changeId))[0]}`;
    let summaryBytes = readFileSync(join(root, summaryPath));
    const anchorPath = join(outer, 'anchor.json');
    const freeze = () => { summaryBytes = readFileSync(join(root, summaryPath)); const s = JSON.parse(summaryBytes.toString()); writeFileSync(anchorPath, JSON.stringify({ summarySha256: createHash('sha256').update(summaryBytes).digest('hex'), runId: s.ci.runId, runAttempt: s.ci.runAttempt, sha: s.sha })); };
    freeze();
    const target = commit();
    const resetCounts = () => writeFileSync(join(root, '.loomake/count.log'), '');
    resetCounts();
    const counts = () => readFileSync(join(root, '.loomake/count.log'), 'utf8').trim().split('\n').filter(Boolean);
    const run = (overrides: Partial<ReuseOptions> = {}) => { const out: string[] = []; const progress: string[] = []; const result = runReuse({ root, changeId, summaryPath, anchorPath, qualitySchema, env, json: true, stdout: s => out.push(s), progress: s => progress.push(s), now: () => new Date('2026-11-06T00:00:01Z'), ...overrides }); return { result, out, progress }; };
    const mutate = (fn: (s: ReturnType<typeof JSON.parse>) => void, trusted = true) => { const s = JSON.parse(readFileSync(join(root, summaryPath), 'utf8')); fn(s); write(summaryPath, JSON.stringify(s, null, 2) + '\n'); if (trusted)
        freeze(); commit(); resetCounts(); };
    return { root, outer, git, write, commit, source, target, summaryPath, anchorPath, env, run, counts, resetCounts, freeze, mutate, summaryBytes, changeId, cleanup: () => rmSync(outer, { recursive: true, force: true }) };
}
