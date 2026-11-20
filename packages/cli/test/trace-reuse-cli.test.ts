import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as kit from '@loomake/kit';
import { main } from '../src/main.js';
import { reuseProject } from '../../trace/test/reuse-project.js';
vi.setConfig({ testTimeout: 60000 });
const projects: ReturnType<typeof reuseProject>[] = [];
const project = () => { const p = reuseProject(); projects.push(p); return p; };
afterEach(() => { vi.restoreAllMocks(); for (const p of projects.splice(0))
    p.cleanup(); });
async function cli(p: ReturnType<typeof reuseProject>, extra: string[] = []) { const out: string[] = []; const stderr: string[] = []; const code = await main(['trace', 'reuse', '--change', 'c1', '--summary', p.summaryPath, '--anchor', p.anchorPath, ...extra], { cwd: p.root, stdout: s => out.push(s), stderr: s => stderr.push(s) }); return { code, out, stderr }; }
it('[REQ-476] CLIの有効な証跡だけではカウンタ0で再利用し品質合格と区別する', async () => { const p = project(); const r = await cli(p); expect(r.code).toBe(0); expect(p.counts()).toEqual([]); expect(r.out.join('\n')).toContain('品質コマンドは実行していません。品質の合格や CI の最終合格を表しません'); });
it('[REQ-476] 混在のときは実際に品質コマンドを各1回実行して新しいEvidence2を返す', async () => { const p = project(); p.write('code.ts', 'changed'); p.commit(); const r = await cli(p, ['--json']); expect(r.code).toBe(0); expect(p.counts()).toEqual(['lint', 'typecheck', 'test']); expect(r.out).toHaveLength(1); const result = JSON.parse(r.out[0]); expect(result).toMatchObject({ outcome: 'revalidated', exitCode: 0, verifyExitCode: 0 }); expect(JSON.parse(readFileSync(join(p.root, result.record.path), 'utf8'))).toMatchObject({ schemaVersion: 2, verify: { verdict: 'PASS', scope: 'ci' } }); expect(r.stderr.join('\n')).toContain('verify の結果'); });
it('[REQ-476] 品質コマンドの実際の非0を同じ終了コードで返す', async () => { const p = project(); p.write('count.mjs', readFileSync(join(p.root, 'count.mjs'), 'utf8') + '\nprocess.exit(1);'); p.commit(); const r = await cli(p, ['--json', '--scope', 'ci']); expect(r.code).toBe(1); expect(p.counts()).toEqual(['lint', 'typecheck', 'test']); expect(JSON.parse(r.out[0])).toMatchObject({ outcome: 'revalidated', exitCode: 1, verifyExitCode: 1, record: { path: expect.any(String) } }); });
it('[REQ-476] JSONの4つのoutcomeを単独で読めて進捗はstderrへ出る', async () => { for (const outcome of ['reused', 'revalidated', 'returned-to-human', 'stopped']) {
    const p = project();
    if (outcome === 'revalidated') {
        p.write('code', 'mixed');
        p.commit();
    }
    if (outcome === 'returned-to-human')
        p.mutate(s => s.recordedAt = '2026-11-06T00:00:09Z', false);
    if (outcome === 'stopped')
        p.write('dirty', 'x');
    const r = await cli(p, ['--json']);
    expect(r.out).toHaveLength(1);
    expect(JSON.parse(r.out[0])).toMatchObject({ resultVersion: 1, outcome, exitCode: r.code, source: expect.toBeOneOf([p.source, null]), target: expect.any(String), verifyExitCode: outcome === 'revalidated' ? 0 : null });
    if (outcome !== 'revalidated')
        expect(p.counts()).toEqual([]);
} });
it('[REQ-476] 判定中の変更はCLIでも停止し再検証を行わない', async () => { const p = project(); const original = kit.readEvidenceRange; vi.spyOn(kit, 'readEvidenceRange').mockImplementation(o => { const r = original(o); p.write('dirty', 'x'); return r; }); const r = await cli(p, ['--json']); expect(r.code).toBe(1); expect(JSON.parse(r.out[0])).toMatchObject({ outcome: 'stopped', record: null, reasons: [{ code: 'STATE_CHANGED', message: expect.any(String) }] }); expect(p.counts()).toEqual([]); });
it('[REQ-476] 使い方の誤りでは日本語の診断と2を返しJSONを出さない', async () => { const p = project(); for (const args of [[], ['--change', 'c1'], ['--change', 'c1', '--summary', p.summaryPath], ['--change', '../bad', '--summary', p.summaryPath, '--anchor', p.anchorPath], ['--change', 'c1', '--summary', 'bad', '--anchor', p.anchorPath], ['--change', 'c1', '--summary', p.summaryPath, '--anchor', p.anchorPath, '--scope', 'bad']]) {
    const out: string[] = [];
    const stderr: string[] = [];
    expect(await main(['trace', 'reuse', ...args, '--json'], { cwd: p.root, stdout: s => out.push(s), stderr: s => stderr.push(s) })).toBe(2);
    expect(out).toEqual([]);
    expect(stderr.join('\n')).toContain('loomake trace:');
} });
it('[REQ-476][REQ-323] helpは5つのオプションを示しGitと品質コマンドを起動しない', async () => { const spy = vi.spyOn(kit, 'runExternal'); const out: string[] = []; expect(await main(['trace', 'reuse', '--help'], { cwd: '/unavailable', stdout: s => out.push(s), stderr: () => { } })).toBe(0); expect(spy).not.toHaveBeenCalled(); for (const option of ['--change', '--summary', '--anchor', '--scope', '--json'])
    expect(out[0]).toContain(option); expect(out[0]).toContain('真正性は確かめない'); });
it('[REQ-476] 外部操作の期限は実行時の失敗3でJSONと記録を出さない', async () => {
    const p = project();
    vi.spyOn(kit, 'readEvidenceRange').mockImplementation(() => { throw new kit.ProcessLimitError('timeout', 'git'); });
    const r = await cli(p, ['--json']);
    expect(r.code).toBe(3);
    expect(r.out).toEqual([]);
    expect(r.stderr.join('\n')).toContain('実行時間の上限');
    expect(p.counts()).toEqual([]);
});

it.each([false, true])('[REQ-475][REQ-476] 再検証の全表示は秘密の形のpathをマスクする: json=%s', async (json) => {
    const secret = 'sk-' + 'a'.repeat(20);
    const p = reuseProject(secret);
    projects.push(p);
    p.write('mixed.ts', 'mixed');
    p.commit();
    const out: string[] = [];
    const stderr: string[] = [];
    const code = await main(['trace', 'reuse', '--change', secret, '--summary', p.summaryPath, '--anchor', p.anchorPath, ...(json ? ['--json'] : [])], { cwd: p.root, stdout: s => out.push(s), stderr: s => stderr.push(s) });
    expect(code).toBe(0);
    expect(p.counts()).toEqual(['lint', 'typecheck', 'test']);
    expect([...out, ...stderr].join('\n')).not.toContain(secret);
    const display = (json ? stderr : out).join('\n');
    expect(display).toContain('verify の結果');
    expect(display).toContain('git add');
    expect(display).toContain('.loomake/evidence/***/');
    if (json) {
        expect(out).toHaveLength(1);
        expect(JSON.parse(out[0])).toMatchObject({ outcome: 'revalidated', record: { path: expect.stringContaining('***') } });
    }
});
