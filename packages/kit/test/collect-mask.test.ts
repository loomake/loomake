import { describe, expect, it, vi } from 'vitest';
import { collectToolOutput, ProcessLimitError, RuntimeFailure, UsageError, type CollectRequest } from '../src/index.js';
import * as runtime from '../src/runtime/process.js';

const secret = 'sk-' + 'a'.repeat(30);
const pemBody = 'synthetic_private_body';
const pem = ['-----BEGIN PRIVATE KEY-----', pemBody, '-----END PRIVATE KEY-----'].join('\n');
const tokens = [
  secret, ...['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'].map(prefix => prefix + 'a'.repeat(25)),
  'github_pat_' + 'a'.repeat(25), 'AKIA' + 'A'.repeat(16), 'npm_' + 'a'.repeat(36), 'xoxb-' + 'a'.repeat(20),
  'glpat-' + 'a'.repeat(25), 'AIza' + 'a'.repeat(35), 'eyJ' + 'a'.repeat(20) + '.' + 'b'.repeat(20) + '.' + 'c'.repeat(20),
  'Bearer ' + 'a'.repeat(30), pem,
];
const known = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bnpm_[A-Za-z0-9]{36}\b|\bxox[abposr]-[A-Za-z0-9-]{10,}|\bglpat-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{35}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._~+/-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY/;
const request = (overrides: Partial<CollectRequest> = {}): CollectRequest => ({
  tool: 'claude', command: process.execPath, args: ['-e', '', '--', secret], timeoutMs: 1000, ...overrides,
});
function noSecrets(value: unknown) {
  const text = JSON.stringify(value);
  expect(text).not.toMatch(known); expect(text).not.toContain(pemBody); expect(text).not.toContain(secret);
}
const result = (stdout = '[]', stderr = '') => ({ status: 0, signal: null, stdout, stderr });

describe('収集の保存前の置換', () => {
  it('[REQ-450] Unicode escape・改行・任意配列を decode してから既知の全パターンを置換する', () => {
    const payload = { type: 'result', subtype: 'success', is_error: false, result: tokens.join('\n'), session_id: secret, errors: tokens };
    const raw = JSON.stringify(payload).replaceAll('sk-', '\\u0073\\u006b-');
    const original = structuredClone(payload);
    const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue(result(raw));
    try {
      const collected = collectToolOutput(request());
      expect(collected.outcome).toBe('parsed'); noSecrets(collected);
      expect(payload).toEqual(original);
      expect(raw).toContain('\\u0073\\u006b-'); expect(raw).toContain('\\n');
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] すべての observation の文字列を固定の key ごとに置換する', () => {
    const stats = { expected: 1, unexpected: 0, flaky: 0, skipped: 0 };
    const cases: [CollectRequest['tool'], unknown][] = [
      ['gh', [{ name: secret, bucket: 'pass', workflow: secret, link: pem }]],
      ['biome', { summary: { errors: 1, warnings: 0, infos: 0, diagnosticsNotPrinted: 0 }, diagnostics: [{
        severity: 'error', message: secret, category: secret, location: { path: secret, start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      }] }],
      ['playwright', { suites: [{ title: 'file', file: 'x', specs: [{ title: secret, file: secret, tests: [{
        status: 'expected', expectedStatus: 'passed', projectName: secret, results: [],
      }] }] }], errors: [{ message: pem }], stats }],
    ];
    const spy = vi.spyOn(runtime, 'runExternal');
    try {
      for (const [tool, payload] of cases) {
        spy.mockReturnValue(result(JSON.stringify(payload)));
        const collected = collectToolOutput(request({ tool }));
        expect(collected.outcome).toBe('parsed'); noSecrets(collected);
      }
      const events = [{ type: 'thread.started', thread_id: secret }, { type: 'turn.started' },
        { type: 'item.completed', item: { id: '1', type: 'agent_message', text: secret } }, { type: 'error', message: pem }];
      spy.mockReturnValue(result(events.map(e => JSON.stringify(e)).join('\n')));
      const collected = collectToolOutput(request({ tool: 'codex' }));
      expect(collected.outcome).toBe('parsed'); noSecrets(collected);
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] stderr 全文を置換してから末尾を切り、BEGIN と token を失った断片を返さない', () => {
    const stderr = 'prefix '.repeat(900) + '-----BEGIN PRIVATE KEY-----\n' + (pemBody + '\n').repeat(400)
      + '-----END PRIVATE KEY-----\n' + secret + '\n' + 'tail '.repeat(900);
    const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue(result('[]', stderr));
    try {
      const collected = collectToolOutput(request({ tool: 'gh' })); noSecrets(collected);
      expect(collected.diagnostics).toBe(('tail '.repeat(900)).slice(-4096));
      spy.mockReturnValue(result('[]', 'prefix '.repeat(900) + 'sk-' + 'a'.repeat(6000)));
      const token = collectToolOutput(request({ tool: 'gh' })); noSecrets(token);
      expect(token.diagnostics.endsWith('***')).toBe(true);
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] diagnostics の境界でサロゲートペアを分断しない', () => {
    const stderr = 'prefix '.repeat(900) + '😀' + 'x '.repeat(2047) + 'x';
    const spy = vi.spyOn(runtime, 'runExternal').mockReturnValue(result('[]', stderr));
    try {
      const collected = collectToolOutput(request({ tool: 'gh' }));
      expect(collected.diagnostics).toBe('x '.repeat(2047) + 'x');
      expect(collected.diagnostics.length).toBe(4095);
      expect(collected.diagnostics).not.toMatch(/^[\uDC00-\uDFFF]/);
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] timeout と output の limited では stdout を保存も返却もしない', () => {
    const spy = vi.spyOn(runtime, 'runExternal');
    try {
      for (const kind of ['timeout', 'output', 'interrupted'] as const) {
        spy.mockImplementation(() => { throw new ProcessLimitError(kind, secret, pem + secret, secret, secret); });
        const collected = collectToolOutput(request());
        expect(collected).toMatchObject({ outcome: 'limited', kind }); noSecrets(collected);
        expect(collected).not.toHaveProperty('stdout'); expect(collected).not.toHaveProperty('observation'); expect(collected).not.toHaveProperty('exit');
      }
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] 生出力と args を各分類の reason、例外の message と cause に含めない', () => {
    const spy = vi.spyOn(runtime, 'runExternal');
    try {
      const cases = [
        result(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: secret })),
        result('{"' + secret + '":'),
        { ...result(secret, secret), error: Object.assign(new Error(secret), { code: 'ENOENT' }) },
        { ...result(secret, secret), error: Object.assign(new Error(secret), { code: secret }) },
        { ...result(secret, secret), error: Object.assign(new Error(secret), { code: 'AKIA' + 'A'.repeat(16) }) },
      ];
      const outcomes = [];
      for (const external of cases) { spy.mockReturnValue(external); const collected = collectToolOutput(request()); noSecrets(collected); outcomes.push(collected.outcome); }
      expect(outcomes).toEqual(['parsed', 'unreadable', 'not_found', 'spawn_error', 'spawn_error']);
      spy.mockImplementation(() => { throw Object.assign(new Error(secret), { cause: new Error(pem) }); });
      expect(() => collectToolOutput(request())).toThrow(RuntimeFailure);
      try { collectToolOutput(request()); expect.fail('例外になる'); }
      catch (error) { expect(error).toBeInstanceOf(RuntimeFailure); noSecrets({ message: (error as Error).message, cause: (error as Error).cause }); }
      try { collectToolOutput(request({ args: [secret + '\0'] })); expect.fail('例外になる'); }
      catch (error) { expect(error).toBeInstanceOf(UsageError); noSecrets({ message: (error as Error).message, cause: (error as Error).cause }); }
      const fixed = new UsageError('外部操作の予算は正の有限数にしてください');
      spy.mockImplementation(() => { throw fixed; });
      expect(() => collectToolOutput(request())).toThrow(fixed);
    } finally { spy.mockRestore(); }
  });
  it('[REQ-450] 実際の子の Unicode escape 出力も保存前に置換する', () => {
    const payload = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: secret, errors: [pem] }).replaceAll('sk-', '\\u0073\\u006b-');
    const collected = collectToolOutput(request({ timeoutMs: 10_000, args: ['-e', `process.stdout.write(${JSON.stringify(payload)});process.stderr.write(${JSON.stringify(pem)})`, '--', secret] }));
    expect(collected.outcome).toBe('parsed'); noSecrets(collected);
  });
});
