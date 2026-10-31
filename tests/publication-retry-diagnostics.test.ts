import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runExternal, withProcessBudget } from '../packages/kit/src/runtime/process.js';
import { attachProcessDiagnostics, createCaseDiagnostics } from '../packages/runner/test/process-diagnostics.js';

const bases: string[] = [];
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'loomake-run-'));
  bases.push(base);
  const directory = join(base, 'diagnostics');
  vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', directory);
  return { base, directory };
}
const rows = (file: string): Record<string, unknown>[] => readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
afterEach(() => { vi.unstubAllEnvs(); for (const base of bases.splice(0)) rmSync(base, { recursive: true, force: true }); });

describe('publication retryの任意診断', () => {
  it('[REQ-345] 指定がなければphaseとpreloadのファイルを作らず環境も変えない', () => {
    const { base } = fixture();
    vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', '');
    const env = { NODE_OPTIONS: '--no-warnings' };
    const phase = createCaseDiagnostics();
    phase.bind(base); phase.event('case-start'); phase.event('run-end', { n: 1, code: 0 });
    attachProcessDiagnostics(base, env);
    expect(readdirSync(base)).toEqual([]);
    expect(env).toEqual({ NODE_OPTIONS: '--no-warnings' });
  });

  it('[REQ-345] 相対診断dirはworkerのcwdで解決し、子のcwdへ記録を混ぜない', () => {
    const { base } = fixture();
    const directory = join(process.cwd(), '.loomake', 'relative-' + basename(base));
    bases.push(directory);
    vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', relative(process.cwd(), directory));
    const phase = createCaseDiagnostics('sha');
    phase.bind(base); phase.event('case-start'); phase.event('case-end', { completed: true });
    const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, 'gh');
    writeFileSync(script, "process.stdout.write('unchanged'); process.exitCode = 7;");
    const result = spawnSync(process.execPath, [script, 'pr', 'list'], { cwd: base, env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(7);
    expect(result.stdout).toBe('unchanged');
    const files = readdirSync(directory);
    expect(files.filter((file) => file.endsWith('.phases.jsonl'))).toHaveLength(1);
    expect(files.filter((file) => file.endsWith('.processes.jsonl'))).toHaveLength(1);
    expect(rows(join(directory, files.find((file) => file.endsWith('.processes.jsonl'))!)).map((row) => row.event)).toEqual(['fake-cli-entry', 'fake-cli-exit']);
    expect(readdirSync(base).sort()).toEqual(['gh', 'process-diagnostics.cjs']);
  });

  it('[REQ-345] case-start前のIDで交錯するcallbackを分け、固定欄だけを残す', () => {
    const { base, directory } = fixture();
    const first = createCaseDiagnostics('sha'); const second = createCaseDiagnostics('unrecorded-label');
    first.event('case-start'); second.event('case-start');
    first.bind(base); second.bind(base + '-next');
    second.event('repo-ready'); first.event('repo-ready');
    first.event('run-end', Object.assign({ n: 1, code: 1, expectedReason: true }, { stdout: 'unrecorded-output', env: 'unrecorded-environment' }));
    second.event('case-end', { completed: false }); first.event('case-end', { completed: true });
    const groups = readdirSync(directory).map((name) => rows(join(directory, name)));
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group[0].label))).toEqual(new Set(['sha', 'publication-retry']));
    expect(new Set(groups.map((group) => group[0].id)).size).toBe(2);
    for (const group of groups) {
      expect(new Set(group.map((row) => row.id)).size).toBe(1);
      expect(group[0].event).toBe('case-start');
      expect(group[0].repo).toBeUndefined();
      expect(group.at(-1)?.event).toBe('case-end');
      expect(new Set(group.slice(1).map((row) => row.repo)).size).toBe(1);
      for (const row of group) {
        expect(Number.isFinite(row.at)).toBe(true);
        expect(Object.keys(row).every((key) => ['event', 'at', 'pid', 'id', 'label', 'repo', 'n', 'code', 'expectedReason', 'completed'].includes(key))).toBe(true);
      }
      expect(JSON.stringify(group)).not.toMatch(/unrecorded/);
    }
  });

  it('[REQ-345] phase記録は64KiB内の完全JSONLと上限の印で止まる', () => {
    const { directory } = fixture(); const phase = createCaseDiagnostics();
    for (let n = 0; n < 2000; n++) phase.event('run-start', { n });
    const file = join(directory, readdirSync(directory)[0]);
    expect(Buffer.byteLength(readFileSync(file))).toBeLessThanOrEqual(65536);
    expect(rows(file).at(-1)?.event).toBe('truncated');
    expect(rows(file).filter((row) => row.event === 'run-start').length).toBeGreaterThan(0);
  });

  it('[REQ-345] 保存先の準備失敗は元の処理へ例外を返さずpreloadを注入しない', () => {
    const { base, directory } = fixture(); writeFileSync(directory, 'not a directory');
    const phase = createCaseDiagnostics(); const env = { NODE_OPTIONS: '--no-warnings' };
    expect(() => phase.event('case-start')).not.toThrow();
    expect(() => attachProcessDiagnostics(base, env)).not.toThrow();
    expect(env.NODE_OPTIONS).toBe('--no-warnings');
    expect(readdirSync(base)).toEqual(['diagnostics']);
  });

  it.each(['claude', 'gh', 'supervisor.cjs'])('[REQ-345] preloadは%sのentry/exitを分類し生の入力と出力を記録しない', (name) => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, name); writeFileSync(script, "process.stdout.write('intended-output'); process.exitCode = 7;");
    const args = name === 'supervisor.cjs' ? [JSON.stringify(['git', ['status', 'unrecorded-argument'], false, 1])] : ['pr', 'list', 'unrecorded-argument'];
    const result = spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(7);
    expect(result.stdout).toBe('intended-output');
    const events = rows(join(directory, readdirSync(directory)[0]));
    expect(events.map((row) => row.event)).toEqual(name === 'supervisor.cjs' ? ['supervisor-entry', 'supervisor-exit'] : ['fake-cli-entry', 'fake-cli-exit']);
    expect(events[1].code).toBe(7);
    expect(events[0].operation).toBe(name === 'supervisor.cjs' ? 'git-status' : name === 'gh' ? 'gh-pr-list' : 'claude');
    expect(JSON.stringify(events)).not.toMatch(/unrecorded-argument|intended-output|argv|stdout|stderr|NODE_OPTIONS/);
  });


  it.each(['list', 'create'])('[REQ-345] Windows引用符付きgh pr %sも固定分類へ直し、生の引数を残さない', (operation) => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, 'supervisor.cjs'); writeFileSync(script, 'process.exitCode = 0;');
    const result = spawnSync(process.execPath, [script, JSON.stringify(['gh', ['"pr"', '"' + operation + '"', '"unrecorded-argument"'], true, 1])], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const events = rows(join(directory, readdirSync(directory)[0]));
    expect(events.map((row) => row.operation)).toEqual(['gh-pr-' + operation, 'gh-pr-' + operation]);
    expect(JSON.stringify(events)).not.toContain('unrecorded-argument');
  });

  it('[REQ-345] 長い行が入らなかった後の短いphaseも保存せずtruncatedを終端にする', () => {
    const { directory } = fixture(); const phase = createCaseDiagnostics(); phase.event('case-start');
    const file = join(directory, readdirSync(directory)[0]); const first = rows(file)[0];
    const shortBytes = Buffer.byteLength(JSON.stringify({ ...first, event: 'case-end' }) + '\n');
    const markerBytes = Buffer.byteLength(JSON.stringify({ event: 'truncated', at: Date.now(), pid: process.pid }) + '\n');
    const desired = 65536 - 160 - shortBytes - markerBytes - 2;
    const paddingBytes = Buffer.byteLength(JSON.stringify({ padding: '' }) + '\n');
    writeFileSync(file, JSON.stringify({ padding: 'x'.repeat(desired - paddingBytes) }) + '\n');
    phase.event('run-end', { n: Number.MAX_SAFE_INTEGER, code: Number.MAX_SAFE_INTEGER, expectedReason: true, completed: true });
    for (let n = 0; n < 5; n++) phase.event('case-end');
    expect(rows(file).at(-1)?.event).toBe('truncated');
    expect(rows(file).filter((row) => row.event === 'truncated')).toHaveLength(1);
    expect(rows(file).some((row) => row.event === 'case-end')).toBe(false);
    expect(Buffer.byteLength(readFileSync(file))).toBeLessThanOrEqual(65536);
  });

  it('[REQ-345] 同一PIDでpreloadを読み直しても別sessionファイルへentry/exitを対応させる', () => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const preload = join(base, 'process-diagnostics.cjs');
    const script = join(base, 'gh');
    writeFileSync(script, `delete require.cache[require.resolve(${JSON.stringify(preload)})]; require(${JSON.stringify(preload)}); process.exitCode = 3;`);
    const result = spawnSync(process.execPath, [script, 'pr', 'list'], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(3);
    const groups = readdirSync(directory).map((file) => rows(join(directory, file)));
    expect(groups).toHaveLength(2);
    expect(new Set(groups.flat().map((row) => row.pid)).size).toBe(1);
    expect(new Set(groups.map((group) => group[0].session)).size).toBe(2);
    for (const group of groups) {
      expect(group.map((row) => row.event)).toEqual(['fake-cli-entry', 'fake-cli-exit']);
      expect(group[0].session).toBe(group[1].session);
      expect(group[1].code).toBe(3);
    }
  });

  it.each([
    ['zero', '0', true], ['negative', '-1', true], ['string', '"invalid-deadline"', false],
    ['null', 'null', false], ['overflow', '1e309', false],
  ] as const)('[REQ-345] 監視役の%s deadlineは有限数値だけremainingMsへ残す', (_, deadline, present) => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, 'supervisor.cjs'); writeFileSync(script, 'process.exitCode = 0;');
    const payload = '["git",["status","unrecorded-argument"],false,' + deadline + ',1024,null]';
    const result = spawnSync(process.execPath, [script, payload], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const events = rows(join(directory, readdirSync(directory)[0]));
    for (const event of events) {
      expect('remainingMs' in event).toBe(present);
      if (present) expect(Number.isFinite(event.remainingMs)).toBe(true);
    }
    if (present) expect(Number(events[1].remainingMs)).toBeLessThanOrEqual(Number(events[0].remainingMs));
    expect(JSON.stringify(events)).not.toMatch(/unrecorded-argument|invalid-deadline|argv|stdout|stderr/);
  });

  it('[REQ-345] 実runExternalと監視役を通して有限な残予算と子CLIの記録を確認する', () => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, 'gh'); writeFileSync(script, "process.stdout.write('expected-output');");
    const result = withProcessBudget({ timeoutMs: 60_000 }, () => runExternal(process.execPath, [script, 'pr', 'list'], { cwd: base, env }));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('expected-output');
    const groups = readdirSync(directory).map((file) => rows(join(directory, file)));
    const supervisor = groups.find((group) => group[0].event === 'supervisor-entry')!;
    const fake = groups.find((group) => group[0].event === 'fake-cli-entry')!;
    expect(supervisor.map((event) => event.operation)).toEqual(['node', 'node']);
    expect(supervisor.map((event) => Number.isFinite(event.remainingMs))).toEqual([true, true]);
    expect(Number(supervisor[0].remainingMs)).toBeGreaterThan(0);
    expect(Number(supervisor[0].remainingMs)).toBeLessThanOrEqual(30_000);
    expect(Number(supervisor[1].remainingMs)).toBeLessThanOrEqual(Number(supervisor[0].remainingMs));
    expect(fake.map((event) => event.operation)).toEqual(['gh-pr-list', 'gh-pr-list']);
    expect(fake.every((event) => !('remainingMs' in event))).toBe(true);
    expect(JSON.stringify(groups)).not.toMatch(/expected-output|argv|stdout|stderr|NODE_OPTIONS/);
  }, 60_000);

  it('[REQ-345] preload実行時の書込失敗も元の終了コードと出力を保つ', () => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    rmSync(directory, { recursive: true }); writeFileSync(directory, 'blocked');
    const script = join(base, 'gh'); writeFileSync(script, "process.stdout.write('unchanged'); process.exitCode = 9;");
    const result = spawnSync(process.execPath, [script, 'pr', 'create'], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(9);
    expect(result.stdout).toBe('unchanged');
  });

  it('[REQ-345] preloadの反復イベントも64KiB内に収め完全な上限印を残す', () => {
    const { base, directory } = fixture(); const env = { ...process.env };
    attachProcessDiagnostics(base, env);
    const script = join(base, 'gh'); writeFileSync(script, 'for (let n=0; n<2000; n++) process.emit("exit", 0);');
    const result = spawnSync(process.execPath, [script, 'pr', 'list'], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const file = join(directory, readdirSync(directory)[0]);
    expect(Buffer.byteLength(readFileSync(file))).toBeLessThanOrEqual(65536);
    expect(rows(file).at(-1)?.event).toBe('truncated');
    expect(rows(file).filter((row) => row.event === 'truncated')).toHaveLength(1);
  });
});
