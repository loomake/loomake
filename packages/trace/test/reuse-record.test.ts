import { expect, it } from 'vitest';
import { reuseRecordProblem, serializeReuseRecord, type ReuseRecord } from '../src/reuse-record.js';
import { summaryProblem } from '../src/summary.js';
import { summaryFixture } from './summary-fixture.js';
export function reuseFixture(change = 'sample'): ReuseRecord {
    const source = 'a'.repeat(40);
    const target = 'b'.repeat(40);
    const path = `.loomake/evidence/${change}/20261106T000000Z-${source.slice(0, 12)}.json`;
    return { reuseVersion: 1, change, verification: 'integrity-only', qualityCommands: 'not-run',
        source: { sha: source, summary: { path, oid: 'c'.repeat(40), sha256: 'd'.repeat(64), runId: '007', runAttempt: '1' } },
        target: { sha: target }, range: { commits: [target], entries: [{ commit: target, path, oid: 'c'.repeat(40) }] },
        anchor: { source: 'caller-file', authenticity: 'unverified' }, evaluator: { name: '@loomake/trace', version: '0.0.0' },
        environment: { node: process.version, platform: process.platform, arch: process.arch }, checkedAt: '2026-11-06T00:00:00Z' };
}
it('[REQ-475] 記録の相互整合・必須欄・未知欄を入力変更なしで検証する', () => {
    const valid = reuseFixture();
    const before = JSON.stringify(valid);
    expect(reuseRecordProblem(valid, 'sample')).toBeUndefined();
    expect(serializeReuseRecord(valid)).toBe(JSON.stringify(valid, null, 2) + '\n');
    expect(JSON.stringify(valid)).toBe(before);
    const future = { ...valid, unknown: { token: 'sk-' + 'a'.repeat(20) } };
    Object.defineProperty(future, '__proto__', { value: 'future', enumerable: true });
    expect(reuseRecordProblem(future, 'sample')).toBeUndefined();
    expect(JSON.parse(serializeReuseRecord(future))).toEqual(valid);
    expect(Object.hasOwn(future, '__proto__')).toBe(true);
    for (const key of Object.keys(valid)) {
        const copy = { ...valid };
        Reflect.deleteProperty(copy, key);
        expect(reuseRecordProblem(copy, 'sample')).toBeTypeOf('string');
    }
    for (const mutate of [(r: ReuseRecord) => r.range.commits.push(r.target.sha), (r: ReuseRecord) => r.source.sha = r.target.sha,
        (r: ReuseRecord) => r.range.entries[0].oid = 'f'.repeat(40), (r: ReuseRecord) => r.range.entries[0].path = '../bad', (r: ReuseRecord) => r.range.commits = []]) {
        const copy = reuseFixture();
        mutate(copy);
        expect(reuseRecordProblem(copy, 'sample')).toBeTypeOf('string');
    }
});
it('[REQ-475] 既知の欄の型の境界を保ちgetterを実行しない', () => {
    const paths = [['change'], ['reuseVersion'], ['source'], ['source', 'sha'], ['source', 'summary'], ['source', 'summary', 'runId'], ['source', 'summary', 'runAttempt'], ['target'], ['range'], ['range', 'commits'], ['range', 'entries'], ['evaluator', 'version'], ['environment', 'node'], ['checkedAt']];
    for (const path of paths)
        for (const bad of [[], ['1'], Object('1'), Object(1), 1, '1', null, Object.create({ value: '1' })]) {
            const r = reuseFixture();
            let parent: Record<string, unknown> = r as unknown as Record<string, unknown>;
            for (const key of path.slice(0, -1))
                parent = parent[key] as Record<string, unknown>;
            if (path.length === 1 && path[0] === 'reuseVersion' && bad === 1)
                continue;
            if (path.at(-1) === 'runAttempt' && bad === '1' || path.at(-1) === 'runId' && bad === '1' || path.at(-1) === 'version' && bad === '1' || path.at(-1) === 'node' && bad === '1')
                continue;
            parent[path.at(-1)!] = bad;
            expect(reuseRecordProblem(r, 'sample')).toBeTypeOf('string');
        }
    for (const path of paths) {
        const r = reuseFixture();
        let parent: Record<string, unknown> = r as unknown as Record<string, unknown>;
        for (const key of path.slice(0, -1))
            parent = parent[key] as Record<string, unknown>;
        let calls = 0;
        Object.defineProperty(parent, path.at(-1)!, { get() { calls++; throw new Error('must not execute'); } });
        expect(reuseRecordProblem(r, 'sample')).toBeTypeOf('string');
        expect(calls).toBe(0);
    }
    expect(reuseRecordProblem(Object.create(reuseFixture()), 'sample')).toBeTypeOf('string');
    expect(reuseRecordProblem(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('proxy'); } }), 'sample')).toBe('再利用の記録を読めません');
});
it('[REQ-475] runIdとrunAttemptの受理をsummaryの境界と揃える', () => {
    for (const attempt of ['0', '01', '9007199254740992', ['1'], '1', '9007199254740991'])
        for (const runId of ['007', '1', 'abc', 1]) {
            const record = reuseFixture();
            record.source.summary.runId = runId as string;
            record.source.summary.runAttempt = attempt as string;
            const summary = summaryFixture();
            summary.ci = { runId: runId as string, runAttempt: attempt as string, source: 'environment' };
            summary.gaps = summary.gaps.filter((g) => g.field !== 'ci');
            expect(reuseRecordProblem(record, 'sample') === undefined).toBe(summaryProblem(summary) === undefined);
        }
});
it('[REQ-475] 秘密の形は既知欄で拒否し固定文で保存を止める', () => {
    for (const secret of ['sk-' + 'a'.repeat(20), 'xoxb-' + 'a'.repeat(10), 'glpat-' + 'a'.repeat(20)])
        for (const field of ['change', 'version', 'node']) {
            const record = reuseFixture(field === 'change' ? secret : 'sample');
            if (field === 'version')
                record.evaluator.version = secret;
            if (field === 'node')
                record.environment.node = secret;
            expect(reuseRecordProblem(record, record.change)).toBe('記録する値が秘密情報の形に当たります');
            try {
                serializeReuseRecord(record);
                expect.fail('保存は拒否される');
            }
            catch (error) {
                expect((error as Error).message).not.toContain(secret);
                expect((error as Error).cause).toBeUndefined();
            }
        }
});
it('[REQ-475] 全既知欄と配列要素はown dataを要求し未知のgetterを読まない', () => {
    const paths: string[][] = [];
    const visit = (value: unknown, path: string[]) => {
        if (typeof value !== 'object' || value === null) return;
        for (const key of Object.keys(value)) {
            const next = [...path, key];
            paths.push(next);
            visit((value as Record<string, unknown>)[key], next);
        }
    };
    visit(reuseFixture(), []);
    for (const path of paths) {
        const record = reuseFixture();
        let parent = record as unknown as Record<string, unknown>;
        for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
        let calls = 0;
        Object.defineProperty(parent, path.at(-1)!, { get() { calls++; throw new Error('must not execute'); } });
        expect(reuseRecordProblem(record, 'sample')).toBeTypeOf('string');
        expect(calls).toBe(0);
    }
    const r = reuseFixture();
    let unknown = 0;
    Object.defineProperty(r, 'future', { get() { unknown++; throw new Error('unknown'); } });
    expect(reuseRecordProblem(r, 'sample')).toBeUndefined();
    expect(unknown).toBe(0);
    const hole = reuseFixture();
    delete hole.range.commits[0];
    expect(reuseRecordProblem(hole, 'sample')).toBeTypeOf('string');
    const thrown = Object.defineProperty({}, 'message', { get() { throw new Error('nested'); } });
    expect(reuseRecordProblem(new Proxy({}, { getPrototypeOf() { throw thrown; } }), 'sample')).toBe('再利用の記録を読めません');
});
