import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeOrder, checkSelection, collectOrder, parseContext, projectSummary, renderSummary, TARGET, validateSummary, verifyPublicFiles } from '../scripts/s4-push-order.mjs';

const directories: string[] = [];
const fixture = () => { const path = mkdtempSync(join(tmpdir(), 'loomake-s4-order-')); directories.push(path); return path; };
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
type Event = { event: string; at: number; pid: number; command: string; args: string[]; status?: number | null; signal?: string | null; error?: string; code?: number };
const content = ['diff', '--cached', '-U0', '--', 'impl.txt'];
const event = (name: string, at: number, pid = 10, args = content, details = {}): Event => ({ event: name, at, pid, command: 'git', args, ...details });
function call(pid: number, at: number, args = content): Event[] {
  return [event('shim-start', at, pid, args), event('forward-start', at + 1, pid, args), event('forward-end', at + 2, pid, args, { status: 0, signal: null }), event('shim-end', at + 3, pid, args, { code: 0 })];
}
const stalled = (at = 10) => [event('shim-start', at, 20, ['push', 'origin', 'topic']), event('stall-start', at + 1, 20, ['push', 'origin', 'topic'])];
const valid = () => [...call(10, 1), ...stalled()];
const report = (status = 'passed', fullName = TARGET, file = '/workspace/packages/runner/test/external-budget-deadline.test.ts') => JSON.stringify({ testResults: [{ name: file, assertionResults: [{ status, fullName }] }] });
const context = (fake = valid(), extra = {}) => Buffer.from(JSON.stringify({ stage: 'push', code: 1, stalled: true, fake, ...extra }));
const metadata = { runId: '123', runAttempt: '1', checkoutSha: 'a'.repeat(40), os: 'Windows', node: 'v24.8.0', testStep: 'success' };
function summary() { return projectSummary({ selection: checkSelection(report()), context: parseContext(context()), metadata }); }

describe('S4 push の試験選択', () => {
  it('元の describe と push 展開名を固定し、実行済み1件だけを受け入れる', () => {
    const source = readFileSync(join(import.meta.dirname, '../packages/runner/test/external-budget-deadline.test.ts'), 'utf8');
    expect(source).toContain("describe('runから外部操作までの期限'");
    expect(source).toContain('%sの期限後に先へ進まず、再実行で重複させない');
    expect(checkSelection(report())).toEqual({ state: 'exact', executed: 1, targetStatus: 'passed' });
    expect(checkSelection(report('failed'))).toEqual({ state: 'exact', executed: 1, targetStatus: 'failed' });
  });
  it.each(['pending', 'skipped', 'todo', 'disabled'])('未実行 %s を成功件数に入れない', (status) => {
    expect(checkSelection(report(status))).toEqual({ state: 'none', executed: 0, targetStatus: null });
  });
  it('2件・別名・別ファイル・欠損・不正レポートを区別する', () => {
    const two = JSON.parse(report()); two.testResults[0].assertionResults.push({ status: 'passed', fullName: 'other' });
    expect(checkSelection(JSON.stringify(two))).toMatchObject({ state: 'multiple', executed: 2 });
    expect(checkSelection(report('passed', 'other'))).toMatchObject({ state: 'mismatch' });
    expect(checkSelection(report('passed', TARGET, '/wrong.test.ts'))).toMatchObject({ state: 'mismatch' });
    expect(checkSelection(undefined)).toMatchObject({ state: 'report-missing' });
    expect(checkSelection('{')).toMatchObject({ state: 'report-invalid' });
  });
});

describe('S4 content diff と push stall の操作順序', () => {
  it('非空の全群を対応付け、異なるPID・閉じたPID再利用・同じmsを許す', () => {
    for (const fake of [valid(), [...call(10, 1), ...call(11, 5), ...stalled(10)], [...call(10, 1), ...call(10, 5), ...stalled(10)], valid().map((row) => ({ ...row, at: 1 }))]) {
      const result = analyzeOrder(fake);
      expect(result.state).toBe('confirmed');
      expect(result.reasons).toEqual([]);
      expect(result.contentDiffCalls).toBe(fake.length === 6 ? 1 : 2);
      expect(result.contentDiffSucceeded).toBe(result.contentDiffCalls);
      expect(result.lastContentDiffEndIndex).toBeLessThan(result.pushStallIndex!);
    }
  });
  it('差分の有無を終了コード1で知らせる別操作は、正常なcontent diffと区別する', () => {
    const probe = call(30, 1, ['diff', '--quiet']); probe[2].status = 1; probe[3].code = 1;
    expect(analyzeOrder([...probe, ...call(10, 5), ...stalled(10)])).toMatchObject({ state: 'confirmed', contentDiffCalls: 1, contentDiffSucceeded: 1 });
  });
  const cases: [string, (rows: Event[]) => Event[], string][] = [
    ['PID不一致', (r) => { r[2].pid = 99; return r; }, 'pid-unpaired-end'],
    ['start欠損', (r) => r.filter((_, i) => i !== 1), 'pid-unpaired-end'],
    ['end欠損', (r) => r.filter((_, i) => i !== 2), 'pid-unpaired-start'],
    ['重複start', (r) => [r[0], r[1], r[1], ...r.slice(2)], 'pid-ambiguous'],
    ['argv不一致', (r) => { r[2].args = ['diff', '--cached', '-U0', 'other']; return r; }, 'pid-unpaired-end'],
    ['command不一致', (r) => { r[2].command = 'gh'; return r; }, 'pid-unpaired-end'],
    ['非zero', (r) => { r[2].status = 1; return r; }, 'forward-failed'],
    ['signal', (r) => { r[2].signal = 'SIGTERM'; return r; }, 'forward-signal'],
    ['error', (r) => { r[2].error = ''; return r; }, 'forward-error'],
    ['clock逆行', (r) => { r[2].at = 0; return r; }, 'clock-regression'],
    ['不正時刻', (r) => { r[2].at = Number.NaN; return r; }, 'event-shape'],
    ['空群', () => stalled(), 'no-content-diff'],
    ['stall欠損', () => call(10, 1), 'no-push-stall'],
    ['stall重複', (r) => [...r, event('stall-start', 12, 20, ['push', 'origin', 'topic'])], 'multiple-push-stall'],
    ['先行stall', (r) => [event('stall-start', 0, 50, ['fetch']), ...r], 'earlier-stall'],
    ['閉じないshim', (r) => r.filter((_, i) => i !== 3), 'pid-unpaired-start'],
    ['不明event', (r) => { r[2].event = 'unknown'; return r; }, 'event-shape'],
  ];
  it.each(cases)('%s は不足として固定理由を残す', (_, change, reason) => {
    const result = analyzeOrder(change(valid()));
    expect(result.state).toBe('insufficient');
    expect(result.reasons).toContain(reason);
  });
  it('stallの後に終わった群と、2群のうち片方の失敗を受け入れない', () => {
    const later = [...stalled(1), ...call(10, 5)];
    expect(analyzeOrder(later)).toMatchObject({ state: 'insufficient', reasons: expect.arrayContaining(['after-stall']) });
    const two = [...call(10, 1), ...call(11, 5), ...stalled(10)]; two[6].status = 2;
    expect(analyzeOrder(two)).toMatchObject({ state: 'insufficient', contentDiffCalls: 2, contentDiffSucceeded: 1 });
  });
});

describe('S4 の一時contextと公開要約', () => {
  it('欠損・不正JSON・形不正・切断・UTF8破損・上限超を成功にしない', () => {
    const cases: [Buffer | undefined, string][] = [[undefined, 'missing'], [Buffer.from('{'), 'invalid-json'], [Buffer.from('{}'), 'invalid-shape'], [Buffer.alloc(65_533, 32), 'truncated'], [Buffer.alloc(65_537, 32), 'oversize'], [Buffer.from([0xff]), 'invalid-json']];
    for (const [bytes, state] of cases) expect(parseContext(bytes).state).toBe(state);
    expect(parseContext(context()).state).toBe('valid');
  });
  it('順序が揃っても元test失敗・選択不足・不正停止contextを成功と呼ばない', () => {
    const good = parseContext(context());
    expect(projectSummary({ selection: checkSelection(report('failed')), context: good, metadata: { ...metadata, testStep: 'failure' } }).result).toBe('test-failed');
    expect(projectSummary({ selection: checkSelection(report('pending')), context: good, metadata }).result).toBe('insufficient');
    for (const extra of [{ code: 0 }, { stalled: false }]) expect(projectSummary({ selection: checkSelection(report()), context: parseContext(context(valid(), extra)), metadata }).result).toBe('insufficient');
  });
  it('rawの自由文字列・未知key・PIDをjson/mdへ漏らさない', () => {
    const sentinel = 'PRIVATE_SENTINEL_DO_NOT_PUBLISH';
    const fake = valid().map((r) => ({ ...r, args: [...r.args, sentinel], unknown: sentinel }));
    const output = projectSummary({ selection: checkSelection(report()), context: parseContext(context(fake, { stdout: sentinel, events: sentinel, unknown: sentinel })), metadata: { ...metadata, unknown: sentinel } });
    expect(validateSummary(output)).toBe(true);
    expect(output.result).toBe('confirmed');
    for (const text of [JSON.stringify(output), renderSummary(output)]) {
      expect(text).not.toContain(sentinel); expect(text).not.toMatch(/"(?:args|stdout|events|pid|path|unknown)"/);
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(4096);
    }
  });
  it.each([
    ['top追加key', (v: Record<string, unknown>) => { v.stdout = 'private'; }],
    ['nested追加key', (v: Record<string, unknown>) => { (v.order as Record<string, unknown>).pid = 123; }],
    ['NaN', (v: Record<string, unknown>) => { (v.context as Record<string, unknown>).bytes = Number.NaN; }],
    ['Infinity', (v: Record<string, unknown>) => { (v.order as Record<string, unknown>).endToStallMs = Infinity; }],
    ['数値文字列', (v: Record<string, unknown>) => { (v.order as Record<string, unknown>).eventCount = '6'; }],
    ['未知enum', (v: Record<string, unknown>) => { (v.order as Record<string, unknown>).state = 'secret'; }],
    ['偽confirmed', (v: Record<string, unknown>) => { (v.selection as Record<string, unknown>).state = 'none'; }],
    ['未知reason', (v: Record<string, unknown>) => { (v.order as Record<string, unknown>).reasons = ['private']; }],
    ['rawmetadata', (v: Record<string, unknown>) => { v.node = 'C:/Users/private'; }],
  ])('%s は公開schemaの検証を通らない', (_, change) => {
    const value = structuredClone(summary()); change(value);
    expect(validateSummary(value)).toBe(false);
    expect(() => renderSummary(value)).toThrow();
  });
  it('2ファイルだけを再読込照合し、markerを出す前にrawを消す', () => {
    const raw = fixture(), output = fixture(), cwd = fixture();
    writeFileSync(join(raw, 'context.json'), context()); writeFileSync(join(raw, 'test-output.log'), 'private');
    const reportPath = join(cwd, 'report.json'); writeFileSync(reportPath, report());
    const result = collectOrder({ cwd, rawDir: raw, outputDir: output, reportPath, metadata });
    expect(result.exitCode).toBe(0); expect(result.verified).toBe(true);
    expect(readdirSync(output).sort()).toEqual(['summary.json', 'summary.md']);
    expect(readdirSync(raw)).toEqual([]); expect(existsSync(reportPath)).toBe(false);
    expect(verifyPublicFiles(output)).toBe(true);
    writeFileSync(join(output, 'summary.md'), 'private'); expect(verifyPublicFiles(output)).toBe(false);
  });
  it('書込み/再検証失敗や余分な出力はverifiedにせずrawを削除する', () => {
    const raw = fixture(), output = fixture(), cwd = fixture();
    writeFileSync(join(raw, 'context.json'), context()); writeFileSync(join(output, 'extra'), 'private');
    const reportPath = join(cwd, 'report.json'); writeFileSync(reportPath, report());
    expect(collectOrder({ cwd, rawDir: raw, outputDir: output, reportPath, metadata })).toEqual({ verified: false, exitCode: 2 });
    expect(readdirSync(raw)).toEqual([]); expect(existsSync(reportPath)).toBe(false);
  });
  it('rawと公開先の重なりを拒否し、生データの混在を公開しない', () => {
    for (const nested of [false, true]) {
      const raw = fixture(), cwd = fixture(), reportPath = join(cwd, 'report.json');
      writeFileSync(join(raw, 'context.json'), context()); writeFileSync(reportPath, report());
      expect(collectOrder({ cwd, rawDir: raw, outputDir: nested ? join(raw, 'export') : raw, reportPath, metadata })).toEqual({ verified: false, exitCode: 2 });
      expect(readdirSync(raw)).toEqual([]); expect(existsSync(reportPath)).toBe(false);
    }
  });
  it('CLIの公開検証失敗はexit2でmarkerを出さず、自由なエラーを表示しない', () => {
    const raw = fixture(), output = fixture(), cwd = fixture();
    writeFileSync(join(raw, 'context.json'), context()); writeFileSync(join(raw, 'test-output.log'), 'PRIVATE_CAPTURE');
    writeFileSync(join(output, 'extra'), 'PRIVATE_CAPTURE');
    const githubOutput = join(cwd, 'github-output');
    const child = spawnSync(process.execPath, [join(import.meta.dirname, '../scripts/s4-push-order.mjs')], { cwd, encoding: 'utf8', env: { ...process.env, S4_ORDER_RAW_DIR: raw, S4_ORDER_OUT_DIR: output, S4_TEST_OUTCOME: 'success', GITHUB_OUTPUT: githubOutput, GITHUB_STEP_SUMMARY: '' } });
    expect(child.status).toBe(2); expect(existsSync(githubOutput)).toBe(false);
    expect(child.stdout + child.stderr).toBe('S4 の公開要約を検証できませんでした。\n');
    expect(readdirSync(raw)).toEqual([]);
  });
  it('CLIは元test失敗をexit1として残し、公開可能な不足要約だけmarkerで許可する', () => {
    const raw = fixture(), output = fixture(), cwd = fixture();
    writeFileSync(join(raw, 'context.json'), context()); writeFileSync(join(raw, 'test-output.log'), 'PRIVATE_CAPTURE');
    const reportPath = join(cwd, '.loomake'); mkdirSync(reportPath); writeFileSync(join(reportPath, 'test-report.json'), report('failed'));
    const githubOutput = join(cwd, 'github-output');
    const child = spawnSync(process.execPath, [join(import.meta.dirname, '../scripts/s4-push-order.mjs')], { cwd, encoding: 'utf8', env: { ...process.env, S4_ORDER_RAW_DIR: raw, S4_ORDER_OUT_DIR: output, S4_TEST_OUTCOME: 'failure', GITHUB_OUTPUT: githubOutput, GITHUB_STEP_SUMMARY: '' } });
    expect(child.status, child.stderr).toBe(1);
    expect(readFileSync(githubOutput, 'utf8')).toBe('verified=true\n');
    expect(JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8')).result).toBe('test-failed');
    expect(child.stdout + child.stderr).not.toContain('PRIVATE_CAPTURE'); expect(readdirSync(raw)).toEqual([]);
  });
});

