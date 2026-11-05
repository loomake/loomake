import { afterEach, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as kit from '@loomake/kit';
import { buildReport } from '../src/report.js';
import { reusableEvidence } from '../../runner/src/reuse.js';
import { reuseProject } from './reuse-project.js';
vi.setConfig({ testTimeout: 60000 });
const projects: ReturnType<typeof reuseProject>[] = [];
const project = (change?: string) => { const p = reuseProject(change); projects.push(p); return p; };
afterEach(() => { vi.restoreAllMocks(); for (const p of projects.splice(0))
    p.cleanup(); });
it('[REQ-474][REQ-475] 有効な証跡だけを品質コマンド0回で再利用し元と範囲を保存する', () => {
    const p = project();
    const bytes = readFileSync(join(p.root, p.summaryPath));
    const r = p.run();
    expect(r.result).toMatchObject({ outcome: 'reused', exitCode: 0, source: p.source, target: p.target, reasons: [], verifyExitCode: null });
    expect(p.counts()).toEqual([]);
    expect(r.out).toHaveLength(1);
    expect(JSON.parse(r.out[0])).toEqual(r.result);
    const saved = JSON.parse(readFileSync(join(p.root, r.result.record!.path), 'utf8'));
    expect(saved).toMatchObject({ reuseVersion: 1, verification: 'integrity-only', qualityCommands: 'not-run', source: { sha: p.source, summary: { path: p.summaryPath } }, target: { sha: p.target }, range: { commits: [p.target], entries: [{ commit: p.target, path: p.summaryPath }] }, anchor: { source: 'caller-file', authenticity: 'unverified' } });
    expect(readFileSync(join(p.root, p.summaryPath))).toEqual(bytes);
});
it.each([false, true])('[REQ-474] 要約の1文字と自己ハッシュの改変を差し戻し再検証しない: %s', (self) => {
    const p = project();
    p.mutate(s => { s.recordedAt = '2026-11-06T00:00:09Z'; if (self)
        s.selfHash = 'f'.repeat(64); }, false);
    p.write('mixed.ts', 'mixed');
    p.commit();
    const r = p.run();
    expect(r.result).toMatchObject({ outcome: 'returned-to-human', reasons: [{ code: 'SUMMARY_HASH_MISMATCH', message: expect.any(String) }], record: null });
    expect(p.counts()).toEqual([]);
    expect(existsSync(join(p.root, '.loomake/evidence/c1/reuse'))).toBe(false);
});
it('[REQ-474] 信頼値がない・不正・repo内・親リンクからrepo内を拒否する', () => {
    const p = project();
    for (const text of ['{', '{}']) {
        writeFileSync(p.anchorPath, text);
        expect(p.run().result.outcome).toBe('returned-to-human');
    }
    rmSync(p.anchorPath);
    expect(p.run().result.reasons[0].code).toBe('ANCHOR_UNREADABLE');
    p.write('.loomake/anchor.json', '{}');
    p.commit();
    expect(p.run({ anchorPath: '.loomake/anchor.json' }).result.reasons[0].code).toBe('ANCHOR_IN_REPOSITORY');
    const link = join(p.outer, 'linked');
    symlinkSync(p.root, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(p.run({ anchorPath: join(link, '.loomake/anchor.json') }).result.reasons[0].code).toBe('ANCHOR_IN_REPOSITORY');
});
it.each(['node', 'platform', 'arch', 'evaluator', 'commands', 'basis', 'documents'])('[REQ-474] 環境や基準が違うと実際に再検証する: %s', (field) => {
    const p = project();
    p.mutate(s => { if (['node', 'platform', 'arch'].includes(field))
        s.execution.environment[field] = 'different'; if (field === 'evaluator')
        s.execution.evaluator.version = 'different'; if (field === 'commands')
        s.execution.commands.sha256 = 'f'.repeat(64); if (field === 'basis')
        s.execution.basisSha256 = 'f'.repeat(64); if (field === 'documents') {
        s.documents[0].content += 'different';
        s.documents[0].sha256 = createHash('sha256').update(s.documents[0].content).digest('hex');
    } });
    const r = p.run();
    expect(r.result.outcome).toBe('revalidated');
    expect(r.result.reasons.map(x => x.code)).toContain(({ node: 'ENVIRONMENT_MISMATCH', platform: 'ENVIRONMENT_MISMATCH', arch: 'ENVIRONMENT_MISMATCH', evaluator: 'EVALUATOR_MISMATCH', commands: 'COMMANDS_MISMATCH', basis: 'BASIS_MISMATCH', documents: 'DOCUMENTS_MISMATCH' } as const)[field as 'node']);
    expect(p.counts()).toEqual(['lint', 'typecheck', 'test']);
    expect(r.result.record?.path).toMatch(/\.json$/);
});
it.each(['local', 'fail', 'insufficient', 'decision', 'aborted'])('[REQ-474] 合格でない要約は再検証する: %s', (kind) => {
    const p = project();
    p.mutate(s => { const v = s.verify; if (kind === 'local') {
        v.scope = 'local';
        delete v.verdict;
        v.summary.pending = 0;
    } if (kind === 'fail')
        v.verdict = 'FAIL'; if (kind === 'insufficient')
        v.verdict = 'INSUFFICIENT_EVIDENCE'; if (kind === 'decision')
        v.decision = { required: true, reasons: [{ code: 'APPROVAL_REQUIRED', target: 'x', message: 'fixture' }] }; if (kind === 'aborted')
        s.verify = { schemaVersion: '2.0.0', change: 'c1', run: { status: 'aborted', errors: [{ kind: 'runtime', target: 'x', message: 'fixture', next: 'retry' }] } }; });
    const r = p.run();
    expect(r.result.outcome).toBe('revalidated');
    expect(r.result.reasons[0].code).toBe('SUMMARY_NOT_PASSING');
    expect(p.counts()).toEqual(['lint', 'typecheck', 'test']);
});
it.each(['json', 'legacy', 'failed', 'reuse', 'reuse-version', 'reuse-name'])('[REQ-474][REQ-475] 範囲のほかの証跡の不正はpathつきで再検証する: %s', (kind) => {
    const p = project();
    const path = `.loomake/evidence/c1/${kind.startsWith('reuse') ? 'reuse/' : ''}20261106T000002Z-${p.source.slice(0, 12)}.json`;
    let text = '{';
    if (kind === 'legacy') {
        const s = JSON.parse(p.summaryBytes.toString());
        delete s.summaryVersion;
        text = JSON.stringify({ ...s, schemaVersion: 1, verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok: true, results: [] } });
    }
    if (kind === 'failed') {
        const s = JSON.parse(p.summaryBytes.toString());
        s.verify.verdict = 'FAIL';
        text = JSON.stringify(s);
    }
    if (kind === 'reuse-version' || kind === 'reuse-name') {
        const created = p.run().result;
        const record = JSON.parse(readFileSync(join(p.root, created.record!.path), 'utf8'));
        rmSync(join(p.root, created.record!.path));
        if (kind === 'reuse-version') record.reuseVersion = 2;
        text = JSON.stringify(record);
    }
    p.write(path, text);
    p.commit();
    const r = p.run();
    expect(r.result.outcome).toBe('revalidated');
    expect(r.result.reasons).toContainEqual(expect.objectContaining({ path, code: kind === 'legacy' ? 'LEGACY_EVIDENCE_IN_RANGE' : kind === 'failed' ? 'OTHER_EVIDENCE_NOT_PASSING' : 'ENTRY_INVALID' }));
});
it('[REQ-474] 要約がsourceに既にある場合は差し戻す', () => {
    const p = project();
    const original = kit.createGitEvidenceReader;
    vi.spyOn(kit, 'createGitEvidenceReader').mockImplementation((root, limits) => { const reader = original(root, limits); return { ...reader, treeEntry: (commit, path) => reader.treeEntry(commit === p.source ? p.target : commit, path) }; });
    const r = p.run();
    expect(r.result).toMatchObject({ outcome: 'returned-to-human', reasons: [{ code: 'PRIMARY_IN_SOURCE', message: expect.any(String) }], record: null });
    expect(p.counts()).toEqual([]);
});
it('[REQ-475] 既存のreportとrunnerの再利用判定はreuse記録を読まない', () => {
    const p = project();
    writeFileSync(join(p.root, '.git/info/exclude'), 'node_modules/\n.loomake/evidence/c1/reuse/\n');
    const before = buildReport(p.root, 'c1');
    const runner = () => reusableEvidence(p.root, {}, 'c1', join(p.root, 'openspec/changes/c1'));
    expect(runner).toThrow('scope:local');
    p.run();
    expect(buildReport(p.root, 'c1')).toEqual(before);
    expect(runner).toThrow('scope:local');
});
it('[REQ-475] 同名は上書きせず停止しsymlinkの祖先は使い方の誤り', () => {
    const p = project();
    const first = p.run().result;
    const path = join(p.root, first.record!.path);
    const bytes = readFileSync(path);
    p.git('add', '-A');
    p.git('commit', '-qm', 'reuse');
    // 固定日時でtargetに対応する同名を先に置き、ignoreして開始状態を保つ。
    const name = `.loomake/evidence/c1/reuse/20261106T000001Z-${p.git('rev-parse', 'HEAD').slice(0, 12)}.json`;
    p.write(name, 'keep');
    p.git('update-index', '--assume-unchanged', p.summaryPath);
    writeFileSync(join(p.root, '.git/info/exclude'), 'node_modules/\n' + name + '\n');
    expect(p.run().result).toMatchObject({ outcome: 'stopped', reasons: [{ code: 'RECORD_EXISTS', message: expect.any(String) }] });
    expect(readFileSync(join(p.root, name), 'utf8')).toBe('keep');
    expect(readFileSync(path)).toEqual(bytes);
    const q = project();
    const dest = join(q.outer, 'destination');
    mkdirSync(dest);
    symlinkSync(dest, join(q.root, '.loomake/evidence/c1/reuse'), process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(join(q.root, '.git/info/exclude'), 'node_modules/\n.loomake/evidence/c1/reuse\n');
    expect(() => q.run()).toThrow(kit.UsageError);
    expect(readdirSync(dest)).toEqual([]);
});
it('[REQ-475] 秘密の形のchangeは保存前に固定文で拒否し新しいdirectoryを作らない', () => {
    const secret = 'sk-' + 'a'.repeat(20);
    const p = project(secret);
    const stdout: string[] = [];
    const progress: string[] = [];
    expect(() => p.run({ stdout: s => stdout.push(s), progress: s => progress.push(s) })).toThrow(kit.UsageError);
    expect(stdout).toEqual([]);
    expect(progress.join('')).not.toContain(secret);
    expect(existsSync(join(p.root, `.loomake/evidence/${secret}/reuse`))).toBe(false);
    expect(readFileSync(join(p.root, p.summaryPath))).toEqual(p.summaryBytes);
});
it('[REQ-476] 判定中のHEAD・作業ツリー・anchorの変化は再検証も記録もしない', () => {
    for (const what of ['head', 'worktree', 'anchor']) {
        const p = project();
        const original = kit.readEvidenceRange;
        const spy = vi.spyOn(kit, 'readEvidenceRange').mockImplementation(o => { const r = original(o); if (what === 'head')
            p.git('commit', '--allow-empty', '-qm', 'changed'); if (what === 'worktree')
            p.write('new', 'changed'); if (what === 'anchor')
            writeFileSync(p.anchorPath, '{}'); return r; });
        expect(p.run().result).toMatchObject({ outcome: 'stopped', reasons: [{ code: 'STATE_CHANGED', message: expect.any(String) }], record: null });
        expect(p.counts()).toEqual([]);
        spy.mockRestore();
    }
});
it('[REQ-475] 有効な再利用の記録は範囲としてだけ許可し未知欄を判定根拠にしない', () => {
    const p = project();
    const first = p.run().result;
    const saved = JSON.parse(readFileSync(join(p.root, first.record!.path), 'utf8'));
    saved.source.summary.sha256 = 'f'.repeat(64);
    saved.future = { token: 'sk-' + 'a'.repeat(20) };
    p.write(first.record!.path, JSON.stringify(saved));
    p.commit();
    const next = p.run();
    expect(next.result.outcome).toBe('reused');
    expect(p.counts()).toEqual([]);
    expect(readFileSync(join(p.root, p.summaryPath))).toEqual(p.summaryBytes);
});
it('[REQ-474] 要約改変とマージが同時にある場合も差し戻しが優先する', () => {
    const p = project();
    p.git('checkout', '-b', 'side');
    p.write('side.ts', 'side');
    p.commit();
    p.git('checkout', '-');
    p.mutate(s => s.recordedAt = '2026-11-06T00:00:09Z', false);
    p.git('merge', '--no-ff', 'side', '-m', 'mixed merge');
    const r = p.run().result;
    expect(r).toMatchObject({ outcome: 'returned-to-human', record: null, reasons: [{ code: 'SUMMARY_HASH_MISMATCH', message: expect.any(String) }] });
    expect(p.counts()).toEqual([]);
});
it('[REQ-476] 再検証の中止と記録しない場合を結果で区別する', () => {
    const p = project();
    p.write('code.ts', 'mixed');
    p.commit();
    const failure = vi.spyOn(kit, 'runVerify').mockImplementation(() => { throw new kit.RuntimeFailure('fixture failure'); });
    expect(p.run().result).toMatchObject({ outcome: 'revalidated', exitCode: 3, verifyExitCode: 3, record: { path: expect.any(String) } });
    failure.mockRestore();
    const q = project();
    q.write('count.mjs', readFileSync(join(q.root, 'count.mjs'), 'utf8') + "\nwriteFileSync('dirty-during-verify', 'changed');");
    q.commit();
    expect(q.run().result).toMatchObject({ outcome: 'revalidated', exitCode: 1, verifyExitCode: 0, record: null });
    expect(q.counts()).toEqual(['lint', 'typecheck', 'test']);
});
it('[REQ-474] sourceとtargetが同じ場合も先にPRIMARY_IN_SOURCEで差し戻す', () => {
    const p = project();
    const external = kit.runExternal;
    vi.spyOn(kit, 'runExternal').mockImplementation((command, args, options) => {
        const r = external(command, args, options);
        if (command === 'git' && args.includes('rev-parse') && args.includes('HEAD')) return { ...r, stdout: p.source };
        return r;
    });
    const create = kit.createGitEvidenceReader;
    vi.spyOn(kit, 'createGitEvidenceReader').mockImplementation((root, limits) => {
        const reader = create(root, limits);
        return { ...reader, treeEntry: (commit, path) => reader.treeEntry(commit === p.source ? p.target : commit, path) };
    });
    expect(p.run().result).toMatchObject({ outcome: 'returned-to-human', source: p.source, target: p.source, reasons: [{ code: 'PRIMARY_IN_SOURCE', message: expect.any(String) }] });
    expect(p.counts()).toEqual([]);
});
it('[REQ-475] 範囲の記録の既知欄に秘密の形があれば値を変えず再検証する', () => {
    const p = project();
    const created = p.run().result;
    const file = join(p.root, created.record!.path);
    const value = JSON.parse(readFileSync(file, 'utf8'));
    value.evaluator.version = 'sk-' + 'a'.repeat(20);
    const bytes = JSON.stringify(value);
    p.write(created.record!.path, bytes);
    p.commit();
    const r = p.run();
    expect(r.result.outcome).toBe('revalidated');
    expect(r.result.reasons).toContainEqual(expect.objectContaining({ code: 'ENTRY_INVALID', path: created.record!.path }));
    expect(readFileSync(file, 'utf8')).toBe(bytes);
    expect(p.counts()).toEqual(['lint', 'typecheck', 'test']);
});
