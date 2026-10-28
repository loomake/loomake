import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { aggregateProfile, CASE_IDS, collectProfile, escapeSummaryText, PROFILE_LIMIT, profileEvent, renderSummary } from '../scripts/test-phase-profile.mjs';

const directories: string[] = [];
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'loomake-phases-')); directories.push(dir); return dir; }
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const event = (caseId: string, name: string, at: number, details = {}) => ({ caseId, event: name, at, ...details });
function completeEvents() {
  return CASE_IDS.flatMap((caseId) => {
    if (caseId === 'shared-package-build') return [event(caseId, 'package-build-start', 0), event(caseId, 'package-build-end', 50)];
    const rows = [event(caseId, 'test-start', 0), event(caseId, 'test-outcome', 99, { outcome: 'passed' }), event(caseId, 'test-end', 100), event(caseId, 'cleanup-start', 90), event(caseId, 'cleanup-end', 95)];
    if (caseId.startsWith('deadline-')) rows.push(event(caseId, 'run-start', 10), event(caseId, 'stall-start', 30), event(caseId, 'run-end', 70), event(caseId, 'retry-start', 75), event(caseId, 'retry-end', 85));
    else rows.push(event(caseId, 'prepare-start', 5), event(caseId, 'prepare-end', 25), ...['npm', 'git', 'cli'].map((kind) => event(caseId, 'command-timing', 80, { kind, durationMs: 10 })));
    return rows;
  });
}

describe('テスト区間の記録と集計', () => {
  it('[REQ-292] 無効時はファイルを作らず、許可した項目だけを追記する', () => {
    const dir = fixture();
    profileEvent('journeys-temp', 'test-start', { at: 1 }, {});
    expect(readdirSync(dir)).toEqual([]);
    profileEvent('journeys-temp', 'test-outcome', { at: 2, outcome: 'failed', stdout: 'private', args: ['secret'] }, { LOOMAKE_TEST_PHASE_PROFILE_DIR: dir });
    const rows = readFileSync(join(dir, readdirSync(dir)[0]), 'utf8');
    expect(JSON.parse(rows)).toEqual({ caseId: 'journeys-temp', event: 'test-outcome', at: 2, outcome: 'failed' });
    expect(rows).not.toMatch(/private|secret|stdout|args/);
  });

  it('[REQ-292] 記録のI/O失敗は対象試験へ例外を返さず、集計は不足を示す', () => {
    const dir = fixture(); const file = join(dir, 'file'); writeFileSync(file, 'x');
    expect(() => profileEvent('deadline-push', 'test-start', {}, { LOOMAKE_TEST_PHASE_PROFILE_DIR: file })).not.toThrow();
    const result = collectProfile(join(dir, 'absent'));
    expect(result.complete).toBe(false);
    expect(result.issues).toContain('記録ディレクトリが未計測');
    expect(result.cases.every((row) => row.totalMs === null && row.outcome === 'unknown')).toBe(true);
  });

  it('[REQ-292][REQ-293] 一時的な書き込み失敗を次の記録へ残し、区間が揃っても不足にする', () => {
    const dir = fixture(); const moved = `${dir}-moved`;
    const env = { LOOMAKE_TEST_PHASE_PROFILE_DIR: dir };
    // 1件のコマンド記録中だけ保存先をファイルにして、書き込みを失敗させる。
    renameSync(dir, moved);
    try {
      writeFileSync(dir, '書き込みできない保存先');
      expect(() => profileEvent('journeys-temp', 'command-timing', { kind: 'npm', durationMs: 5 }, env)).not.toThrow();
    } finally {
      rmSync(dir, { force: true });
      renameSync(moved, dir);
    }
    for (const row of completeEvents()) {
      const { caseId, event: name, ...details } = row;
      profileEvent(caseId, name, details, env);
    }
    const result = collectProfile(dir);
    expect(result.cases.every((row) => row.complete)).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.issues).toContain('記録の書き込みに失敗');
    expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toContain('記録の書き込みに失敗');
  });

  it('[REQ-292][REQ-293] 子プロセス最後の記録失敗も終了時に保存して完備と扱わない', () => {
    const dir = fixture();
    const env = { ...process.env, LOOMAKE_TEST_PHASE_PROFILE_DIR: dir };
    for (const row of completeEvents()) {
      const { caseId, event: name, ...details } = row;
      profileEvent(caseId, name, details, env);
    }
    const moduleUrl = pathToFileURL(join(import.meta.dirname, '../scripts/test-phase-profile.mjs')).href;
    const source = `import {profileEvent} from ${JSON.stringify(moduleUrl)};
      import {renameSync,writeFileSync,rmSync} from 'node:fs';
      const dir=process.env.LOOMAKE_TEST_PHASE_PROFILE_DIR;
      renameSync(dir,dir+'-moved');
      try {
        writeFileSync(dir,'unavailable');
        profileEvent('journeys-temp','command-timing',{kind:'npm',durationMs:5});
      } finally {
        rmSync(dir,{force:true}); renameSync(dir+'-moved',dir);
      }
      // これ以降profileEventを呼ばずに終了する。
      process.exitCode=1;`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { env, encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(1);
    const result = collectProfile(dir);
    expect(result.cases.every((row) => row.complete)).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.issues).toContain('記録の書き込みに失敗');
  });

  it('[REQ-292][REQ-293] 1プロセス1MiBで止め、上限到達を集計で識別する', () => {
    const dir = fixture(); const env = { LOOMAKE_TEST_PHASE_PROFILE_DIR: dir };
    profileEvent('deadline-push', 'test-start', { at: 1 }, env);
    const file = join(dir, readdirSync(dir)[0]);
    // 既存ファイルの残量を小さくして、上限付近の追記を再現する。
    writeFileSync(file, ' '.repeat(PROFILE_LIMIT - 60));
    profileEvent('deadline-push', 'test-end', { at: 2 }, env);
    profileEvent('deadline-push', 'test-end', { at: 3 }, env);
    expect(statSync(file).size).toBeLessThanOrEqual(PROFILE_LIMIT);
    expect(readFileSync(file, 'utf8')).toContain('limit-reached');
    const profile = collectProfile(dir);
    expect(profile.complete).toBe(false);
    expect(profile.issues).toContain('記録が上限に到達');
  });

  it('[REQ-293] 停止前と停止待ちを分け、共有準備を各ケースへ加算しない', () => {
    const profile = aggregateProfile(completeEvents());
    expect(profile.complete).toBe(true);
    const deadline = profile.cases.find((row) => row.caseId === 'deadline-push')!;
    expect(deadline.phases).toEqual([
      { name: 'prepare', durationMs: 10 }, { name: 'before-stall', durationMs: 20 },
      { name: 'stall-and-stop', durationMs: 40 }, { name: 'retry', durationMs: 10 },
      { name: 'cleanup', durationMs: 5 }, { name: 'other', durationMs: 15 },
    ]);
    for (const row of profile.cases) expect(row.phases.reduce((sum, part) => sum + (part.durationMs ?? 0), 0)).toBe(row.totalMs);
    expect(profile.cases.find((row) => row.caseId === 'journeys-temp')!.phases).toContainEqual({ name: 'other', durationMs: 45 });
    expect(profile.cases.find((row) => row.caseId === 'shared-package-build')!.totalMs).toBe(50);
  });

  it('[REQ-292][REQ-293] 失敗前に得られた区間を残し、欠損をゼロ埋めしない', () => {
    const rows = [event('deadline-push', 'test-start', 0), event('deadline-push', 'run-start', 10), event('deadline-push', 'test-outcome', 20, { outcome: 'failed' })];
    const row = aggregateProfile(rows).cases.find((item) => item.caseId === 'deadline-push')!;
    expect(row.outcome).toBe('failed'); expect(row.complete).toBe(false); expect(row.totalMs).toBeNull();
    expect(row.phases).toContainEqual({ name: 'prepare', durationMs: 10 });
    expect(row.phases).toContainEqual({ name: 'other', durationMs: null });
    expect(row.missing.join(' ')).toMatch(/stall-start.*未計測/);
  });

  it('[REQ-293] 逆転・重複・区間超過・不正イベントを完備と扱わない', () => {
    const variants = [
      completeEvents().map((row) => row.caseId === 'deadline-push' && row.event === 'stall-start' ? { ...row, at: 9 } : row),
      completeEvents().map((row) => row.caseId === 'deadline-push' && row.event === 'retry-start' ? { ...row, at: 60 } : row),
      completeEvents().map((row) => row.caseId === 'journeys-temp' && row.event === 'command-timing' ? { ...row, durationMs: 500 } : row),
      [...completeEvents(), event('deadline-push', 'run-start', 10)],
      [...completeEvents(), event('deadline-push', 'run-start', Number.NaN)],
    ];
    for (const rows of variants) expect(aggregateProfile(rows).complete).toBe(false);
  });

  it('[REQ-292][REQ-293] 不正JSONLと過大ファイルを報告し、JSONと要約を保存する', () => {
    const dir = fixture(); writeFileSync(join(dir, 'bad.jsonl'), '{\n');
    writeFileSync(join(dir, 'large.jsonl'), 'x'.repeat(PROFILE_LIMIT + 1));
    const result = collectProfile(dir, { GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', LOOMAKE_TEST_PHASE_SAMPLE: '3', RUNNER_OS: 'Windows', TEST_PHASE_OUTCOME: 'failure' });
    expect(result.issues).toEqual(expect.arrayContaining(['不正なJSONL', '記録ファイルが上限を超過']));
    expect(result.context).toMatchObject({ runId: '123', runAttempt: '2', sample: '3', os: 'Windows', testOutcome: 'failure' });
    expect(result.context.checkoutSha).toMatch(/^[a-f0-9]{40}$/);
    expect(JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'))).toEqual(result);
    expect(readFileSync(join(dir, 'summary.md'), 'utf8')).toContain('未計測');
  });

  it('[REQ-293] 表示をエスケープし32KiB以内に保つ', () => {
    expect(escapeSummaryText('<script>\n|[x]')).not.toMatch(/[<>|[\]\n]/);
    const profile = aggregateProfile(completeEvents(), { sample: '<script>\n' + '測'.repeat(100000) }, ['<b>|bad']);
    const summary = renderSummary(profile);
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(32 * 1024);
    expect(summary).not.toContain('<script>'); expect(summary).not.toContain('<b>');
    expect(summary).toContain('停止前の処理'); expect(summary).toContain('共有build・pack');
  });
});
