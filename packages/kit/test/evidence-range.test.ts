import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readEvidenceRange, createGitEvidenceReader, classifyEvidenceRange } from '../src/verify/trusted/evidence-range.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true }); });
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'loomake-range-'));
    roots.push(root);
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    const write = (path: string, text: string | Buffer) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
    const commit = () => { git('add', '.'); git('commit', '-m', 'fixture'); return git('rev-parse', 'HEAD'); };
    write('base', 'base');
    const source = commit();
    const range = () => readEvidenceRange({ repository: root, source, target: git('rev-parse', 'HEAD'), changeId: 'sample' });
    return { root, git, write, commit, source, range };
}
const path = '.loomake/evidence/sample/20261106T000000Z-aaaaaaaaaaaa.json';
it('[REQ-473] 証跡の追加だけの範囲と空コミットを許可する', () => {
    const f = fixture();
    f.write(path, '{}');
    const sha = f.commit();
    f.git('commit', '--allow-empty', '-m', 'empty');
    expect(f.range()).toEqual({ allowed: true, source: f.source, target: f.git('rev-parse', 'HEAD'), commits: [sha, f.git('rev-parse', 'HEAD')], entries: [{ commit: sha, path, oid: f.git('rev-parse', `${sha}:${path}`), kind: 'evidence' }] });
});
it.each(['packages/a.ts', 'openspec/a.md', 'quality.yaml', 'loomake.config.json', 'pnpm-lock.yaml'])('[REQ-473] コードや仕様の変更が混ざる: %s', (file) => {
    const f = fixture();
    f.write(file, '{}');
    const commit = f.commit();
    expect(f.range()).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'ENTRY_PATH_NOT_ALLOWED', path: file, commit })] });
});
it('[REQ-473] mainへの追従と祖先でないsourceを拒否する', () => {
    const f = fixture();
    f.git('checkout', '-b', 'side');
    f.write(path, '{}');
    f.commit();
    f.git('checkout', '-');
    f.write('other', 'x');
    f.commit();
    f.git('merge', '--no-ff', 'side', '-m', 'merge');
    expect(f.range()).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'MERGE_IN_RANGE' })] });
    f.git('checkout', '--orphan', 'orphan');
    f.git('rm', '-rf', '.');
    f.write('new', 'x');
    const other = f.commit();
    expect(readEvidenceRange({ repository: f.root, source: f.source, target: other, changeId: 'sample' })).toMatchObject({ allowed: false, reasons: [{ code: 'SOURCE_NOT_ANCESTOR', message: expect.any(String) }] });
});
it('[REQ-473] 証跡の変更・削除・改名・mode・別change・effortを拒否する', () => {
    const raw = (status: string, mode: string, file: string) => `:100644 ${mode} ${'a'.repeat(40)} ${'b'.repeat(40)} ${status}\0${file}\0`;
    for (const status of ['M', 'D', 'T'])
        expect(classifyEvidenceRange('a'.repeat(40), raw(status, '100644', path), 'sample').reasons.map((r) => r.code)).toContain('ENTRY_NOT_ADDED');
    for (const mode of ['100755', '120000', '160000'])
        expect(classifyEvidenceRange('a'.repeat(40), raw('A', mode, path), 'sample').reasons.map((r) => r.code)).toContain('ENTRY_MODE');
    for (const file of [path.replace('sample', 'other'), path.replace('sample/', 'sample/effort/'), 'bad\npath'])
        expect(classifyEvidenceRange('a'.repeat(40), raw('A', '100644', file), 'sample').reasons.map((r) => r.code)).toContain('ENTRY_PATH_NOT_ALLOWED');
    const f = fixture();
    f.write(path, '{}');
    f.commit();
    f.git('mv', path, path.replace('000000', '000001'));
    f.commit();
    expect(f.range()).toMatchObject({ allowed: false });
});
it('[REQ-473] 読めない範囲・shallow・entry上限を理由付きで返す', () => {
    const f = fixture();
    f.write(path, '{}');
    f.commit();
    expect(readEvidenceRange({ repository: f.root, source: 'f'.repeat(40), target: f.git('rev-parse', 'HEAD'), changeId: 'sample' })).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'SOURCE_UNAVAILABLE' })] });
    writeFileSync(join(f.root, '.git/shallow'), f.source + '\n');
    expect(f.range()).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'SHALLOW_REPOSITORY' })] });
    rmSync(join(f.root, '.git/shallow'));
    for (let i = 0; i < 4097; i++)
        f.write(`too-many/${i}`, 'x');
    f.commit();
    expect(f.range()).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'RANGE_TOO_LARGE' })] });
});
it('[REQ-473] 打ち消し合うコミットと置換参照でも原本を判定する', () => {
    const f = fixture();
    f.write('base', 'changed');
    const bad = f.commit();
    f.write('base', 'base');
    f.commit();
    expect(f.range()).toMatchObject({ allowed: false });
    f.git('checkout', '-b', 'replacement', f.source);
    f.write(path, '{}');
    const good = f.commit();
    f.git('replace', bad, good);
    expect(readEvidenceRange({ repository: f.root, source: f.source, target: bad, changeId: 'sample' })).toMatchObject({ allowed: false, reasons: ['ENTRY_NOT_ADDED', 'ENTRY_MODE', 'ENTRY_PATH_NOT_ALLOWED'].map((code) => expect.objectContaining({ code, path: 'base', commit: bad })) });
});
it('[REQ-473] 共有予算と厳密なdecode、通常treeだけの照会', () => {
    const f = fixture();
    f.write('one', '1234');
    f.write('two', '5678');
    f.write('invalid', Buffer.from([0x80]));
    const sha = f.commit();
    const reader = createGitEvidenceReader(f.root, { maxFileBytes: 4, maxTotalBytes: 7, maxEntries: 4096, maxDepth: 5 });
    expect(reader.treeEntry(sha, 'one')).toMatchObject({ kind: 'found', mode: '100644', type: 'blob' });
    expect(reader.treeEntry(sha, 'missing')).toEqual({ kind: 'absent' });
    expect(reader.readText(f.git('rev-parse', `${sha}:one`))).toEqual({ ok: true, text: '1234', bytes: 4 });
    expect(reader.readText(f.git('rev-parse', `${sha}:two`))).toEqual({ ok: false, code: 'BLOB_TOO_LARGE' });
    expect(reader.readText(f.git('rev-parse', `${sha}:invalid`))).toEqual({ ok: false, code: 'BLOB_NOT_UTF8' });
});
it('[REQ-473] 型の不正と起動不能をUsageError、期限・中断を型のまま返す', async () => {
    const { vi } = await import('vitest');
    const runtime = await import('../src/runtime/process.js');
    const { UsageError } = await import('../src/runtime/errors.js');
    const f = fixture();
    f.write(path, '{}');
    const target = f.commit();
    const options = { repository: f.root, source: f.source, target, changeId: 'sample' };
    expect(() => readEvidenceRange({ ...options, source: 'UPPER' })).toThrow(UsageError);
    for (const kind of ['timeout', 'interrupted'] as const) {
        const failure = new runtime.ProcessLimitError(kind, 'git');
        const spy = vi.spyOn(runtime, 'runExternalBytes').mockImplementation(() => { throw failure; });
        expect(() => readEvidenceRange(options)).toThrow(failure);
        spy.mockRestore();
    }
    const spy = vi.spyOn(runtime, 'runExternalBytes').mockReturnValue({ status: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.from('private diagnostic'), error: Object.assign(new Error('private diagnostic'), { code: 'ENOENT' }) });
    expect(() => readEvidenceRange(options)).toThrow(UsageError);
    try {
        readEvidenceRange(options);
    }
    catch (error) {
        expect((error as Error).message).not.toContain('private diagnostic');
        expect((error as Error).cause).toBeUndefined();
    }
    spy.mockRestore();
});
it('[REQ-473] メタデータとコミット4097件の上限はRANGE_TOO_LARGEにする', async () => {
    const { vi } = await import('vitest');
    const runtime = await import('../src/runtime/process.js');
    const f = fixture();
    f.write(path, '{}');
    const target = f.commit();
    const options = { repository: f.root, source: f.source, target, changeId: 'sample' };
    const output = vi.spyOn(runtime, 'runExternalBytes').mockImplementation(() => { throw new runtime.ProcessLimitError('output', 'git'); });
    expect(readEvidenceRange(options)).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'RANGE_TOO_LARGE' })] });
    output.mockRestore();
    const original = runtime.runExternalBytes;
    const commits = vi.spyOn(runtime, 'runExternalBytes').mockImplementation((cmd, args, options) => args.includes('rev-list') ? { status: 0, signal: null, stdout: Buffer.from(`${target} ${f.source}\n`.repeat(4097)), stderr: Buffer.alloc(0) } : original(cmd, args, options));
    expect(readEvidenceRange({ repository: f.root, source: f.source, target, changeId: 'sample' })).toMatchObject({ allowed: false, reasons: [expect.objectContaining({ code: 'RANGE_TOO_LARGE' })] });
    commits.mockRestore();
});
