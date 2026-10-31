import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as kit from '@loomake/kit';
import { runRun, type RunOptions, type RunSummary } from '@loomake/runner';
import { readDocuments } from '@loomake/trace';
import type { VerifyCheckV2, VerifyDecision, VerifyResult, VerifyResultV2 } from '@loomake/core';
import { main } from '../../cli/src/main.js';
import { decideAfterGate, type GateObservation } from '../src/run/decision-policy.js';
import { gateObservation } from '../src/run/phases.js';
import { specGateOutcome } from '../src/run/prepare.js';
import { reusableEvidence } from '../src/reuse.js';
import { prBody } from '../src/pr.js';
import { CHANGE, makeRepo, noChange, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });

// verify 2.0.0 の結果を手で作る（書き出しはまだ 1.0.0。読む側だけを確かめる）
const pass: VerifyCheckV2 = { id: 'command: test', result: 'PASS', reason: '', evidence: [] };
const failed: VerifyCheckV2 = { id: 'command: lint', result: 'FAIL', reason: 'lint の出力', evidence: [] };
const decision: VerifyDecision = { required: true, reasons: [{ code: 'APPROVAL_REQUIRED', target: 'A-01', message: '仮定の承認が必要です' }] };
const noDecision: VerifyDecision = { required: false, reasons: [] };
const count = (checks: VerifyCheckV2[], result: string) => checks.filter((c) => c.result === result).length;
const summary = (checks: VerifyCheckV2[]) => ({ fail: count(checks, 'FAIL'), insufficient: count(checks, 'INSUFFICIENT_EVIDENCE'), not_applicable: count(checks, 'NOT_APPLICABLE'), evaluated: checks.length });
const local = (checks = [pass], d = noDecision): VerifyResultV2 => ({
  schemaVersion: '2.0.0', change: CHANGE, run: { status: 'completed', errors: [] }, scope: 'local', checks, summary: { ...summary(checks), pending: count(checks, 'INSUFFICIENT_EVIDENCE') }, decision: d,
});
const ci = (checks = [pass]): VerifyResultV2 => ({
  schemaVersion: '2.0.0', change: CHANGE, run: { status: 'completed', errors: [] }, scope: 'ci', checks, summary: summary(checks), decision: noDecision,
  verdict: checks.some((c) => c.result === 'FAIL') ? 'FAIL' : 'PASS',
});
const aborted = (kind: 'usage' | 'config' | 'runtime', message = '起動できません'): VerifyResultV2 => ({
  schemaVersion: '2.0.0', change: CHANGE, run: { status: 'aborted', errors: [{ kind, target: CHANGE, message, next: '確かめる' }] },
});
// runVerify の型は書き出しの 1.0.0。2.0.0 を返すモックのために型をそろえる
const asWritten = (result: VerifyResultV2) => result as unknown as VerifyResult;

async function run(repo: Repo, opts: Partial<RunOptions> = {}) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (t) => out.push(t), env: repo.env, fileExists: () => false, ...opts });
  return { code, stdout: out.join('\n') };
}
const runDir = (repo: Repo) => {
  const root = join(repo.root, '.loomake/runs');
  return join(root, readdirSync(root).filter((d) => d !== '.gitignore')[0]);
};
const base: GateObservation = { stateChanged: false, ok: false, timedOut: false, fixes: 0, maxFixes: 2 };

describe('完了ゲートの純粋判断', () => {
  it('[REQ-205] 状態の変更を最初に、次に aborted と要判断で止まり、修正回数が残っていても直しに進まない。ローカル完了は回数・期限より優先する', () => {
    expect(decideAfterGate({ ...base, stateChanged: true, aborted: 'runtime：x', ok: true })).toMatchObject({ kind: 'stop', reason: expect.stringContaining('HEADかブランチが変わりました') });
    expect(decideAfterGate({ ...base, aborted: 'config：設定が不正です' })).toEqual({ kind: 'stop', reason: expect.stringContaining('実行エラーで中止されました（config：設定が不正です）') });
    expect(decideAfterGate({ ...base, decisionReasons: ['仮定の承認が必要です'] })).toEqual({ kind: 'stop', reason: expect.stringContaining('人の判断が必要です（仮定の承認が必要です）') });
    expect(decideAfterGate({ ...base, aborted: 'x', interrupted: true }).kind).toBe('stop');
    expect(decideAfterGate({ ...base, ok: true, timedOut: true, fixes: 5, maxFixes: 2 })).toEqual({ kind: 'passed' });
    expect(decideAfterGate({ ...base, decisionReasons: [] })).toEqual({ kind: 'repair' });
  });

  it('[REQ-205] 2.0.0 では scope:local の完了だけを完了とし、ci の PASS・FAIL・要判断・aborted を完了にしない。1.0.0 は ok をそのまま使う', () => {
    expect(gateObservation(local())).toMatchObject({ ok: true, decisionReasons: [] });
    expect(gateObservation(ci()).ok).toBe(false);
    expect(gateObservation(local([pass, failed])).ok).toBe(false);
    expect(gateObservation(local([pass], decision))).toMatchObject({ ok: false, decisionReasons: ['仮定の承認が必要です（APPROVAL_REQUIRED・A-01）'] });
    expect(gateObservation(aborted('runtime'))).toMatchObject({ ok: false, aborted: 'runtime：起動できません' });
    const legacy: VerifyResult = { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [{ check: 'command: test', status: 'fail', detail: kit.TIMED_OUT }] };
    expect(gateObservation(legacy)).toEqual({ ok: true, interrupted: false, timedOut: true });
  });
});

describe('run の完了ゲートと仕様ゲートで 2.0.0 を読む', () => {
  // 完了ゲートの最初の検査だけを 2.0.0 にする。証拠の記録はいまの書き出し（1.0.0）で行う
  function mockFirstDone(result: VerifyResultV2) {
    const real = kit.runVerify;
    let first = true;
    return vi.spyOn(kit, 'runVerify').mockImplementation((o) => {
      if (o.gate === 'done' && first) { first = false; return asWritten(result); }
      return real(o);
    });
  }

  it('[REQ-205] 2.0.0 の local の完了なら、直しを呼ばずに Draft PR へ進む', async () => {
    const repo = makeRepo();
    const spy = mockFirstDone(local());
    try {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const r = await run(repo);
      expect(r.code, r.stdout).toBe(0);
      expect(repo.calls()).toHaveLength(2);
      expect(repo.prs()).toHaveLength(1);
    } finally { spy.mockRestore(); repo.cleanup(); }
  });

  it('[REQ-205] 要判断と FAIL が同時にあれば、FAIL の内容と理由を保存し、直しのエンジンを呼ばずに止まる。RunSummary の外形は変えない', async () => {
    const repo = makeRepo();
    const spy = mockFirstDone(local([pass, failed], decision));
    try {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(repo.calls()).toHaveLength(2);
      const dir = runDir(repo);
      const saved = JSON.parse(readFileSync(join(dir, readdirSync(dir).find((f) => /-verify\.json$/.test(f))!), 'utf8'));
      expect(saved.checks).toContainEqual(failed);
      expect(saved.decision).toEqual(decision);
      const s: RunSummary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
      expect(Object.keys(s).sort()).toEqual(['change', 'doneTasks', 'lastVerify', 'reason', 'remainingTasks', 'status']);
      expect(s).toMatchObject({ status: 'stopped', lastVerify: { ok: false, mode: 'done' } });
      expect(s.reason).toContain('人の判断が必要です');
      expect(repo.prs()).toHaveLength(0);
    } finally { spy.mockRestore(); repo.cleanup(); }
  });

  it('[REQ-205] 完了ゲートが aborted なら、修正回数が残っていてもエンジンを呼ばずに理由を記録して止まる', async () => {
    const repo = makeRepo();
    const spy = mockFirstDone(aborted('runtime', '品質コマンドを起動できません'));
    try {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      expect((await run(repo)).code).toBe(1);
      expect(repo.calls()).toHaveLength(2);
      const s: RunSummary = JSON.parse(readFileSync(join(runDir(repo), 'summary.json'), 'utf8'));
      expect(s.reason).toContain('実行エラーで中止されました（runtime：品質コマンドを起動できません）');
      expect(s.lastVerify).toEqual({ ok: false, mode: 'done' });
    } finally { spy.mockRestore(); repo.cleanup(); }
  });

  it('[REQ-093] 仕様ゲートの結果は、1.0.0 は ok で、2.0.0 は不合格 1・usage と config の aborted 2・ほかの aborted 3 で決める', () => {
    expect(specGateOutcome({ schemaVersion: '1.0.0', mode: 'spec-only', change: CHANGE, ok: false, results: [] })).toEqual({ code: 1, aborted: false });
    expect(specGateOutcome(local([failed]))).toEqual({ code: 1, aborted: false });
    expect(specGateOutcome(local())).toEqual({ code: 0, aborted: false });
    expect([aborted('usage'), aborted('config'), aborted('runtime')].map(specGateOutcome)).toEqual([{ code: 2, aborted: true }, { code: 2, aborted: true }, { code: 3, aborted: true }]);
  });

  it.each([
    ['usage', 2, () => new kit.UsageError('使い方が違います'), aborted('usage')],
    ['config', 2, () => new kit.UsageError('loomake.config.json の commands は…'), aborted('config')],
    ['runtime', 3, () => new kit.RuntimeFailure('読めません'), aborted('runtime')],
  ] as const)('[REQ-093] 仕様ゲートが %s の実行エラーなら、ブランチを作らずエンジンを呼ばずに終了コード %s', async (_kind, code, error, result) => {
    for (const mode of ['throw', 'result'] as const) {
      const repo = makeRepo();
      const real = kit.runVerify;
      const spy = vi.spyOn(kit, 'runVerify').mockImplementation((o) => {
        if (o.gate !== 'spec-only') return real(o);
        if (mode === 'throw') throw error();
        return asWritten(result);
      });
      const saved = { ...process.env };
      Object.assign(process.env, repo.env);
      try {
        const out: string[] = [];
        const err: string[] = [];
        const exit = await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
        expect(exit, `${mode} ${out.join('\n')}${err.join('\n')}`).toBe(code);
        expect(repo.git('branch', '--list', 'loomake/c1')).toBe('');
        expect(repo.calls()).toEqual([]);
        if (mode === 'result') expect(out.join('\n')).toContain('仕様ゲートが実行エラーで中止された');
      } finally {
        for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
        Object.assign(process.env, saved);
        spy.mockRestore();
        repo.cleanup();
      }
    }
  });
});

describe('証拠の再利用と PR 本文で Evidence 2 を読む', () => {
  function withCandidate(evidence: (sha: string, documents: unknown) => object, fn: (repo: Repo, file: string) => void) {
    const repo = makeRepo();
    try {
      repo.write('impl.txt', '実装\n'); repo.git('add', '-A'); repo.git('commit', '-q', '-m', 'impl');
      const sha = repo.git('rev-parse', 'HEAD');
      const file = `.loomake/evidence/${CHANGE}/20261023T000000Z-${sha.slice(0, 12)}.json`;
      repo.write(file, JSON.stringify(evidence(sha, readDocuments(join(repo.root, 'openspec/changes', CHANGE)))));
      repo.git('add', '-A'); repo.git('commit', '-q', '-m', 'evidence');
      fn(repo, file);
    } finally { repo.cleanup(); }
  }
  const common = (sha: string, documents: unknown) => ({ change: CHANGE, sha, committedAt: '2026-10-23T00:00:00Z', recordedAt: '2026-10-23T00:00:00Z', documents });
  const changeDir = (repo: Repo) => join(repo.root, 'openspec/changes', CHANGE);

  it('Evidence 2 の local の完了は再利用し、PR 本文に最終 CI の合格と書かない', () => {
    withCandidate((sha, documents) => ({ ...common(sha, documents), schemaVersion: 2, verify: { ...local(), coverage: { 'REQ-012': ['tests/a.test.ts'] } } }), (repo, file) => {
      expect(reusableEvidence(repo.root, repo.env, CHANGE, changeDir(repo))).toBe(file);
      const body = prBody(repo.root, changeDir(repo), file);
      expect(body).toContain('ローカルの項目はすべて完了（CI の最終合格は未確認）');
      expect(body).toContain('- ✔ command: test');
      expect(body).toContain('| REQ-012 | tests/a.test.ts |');
    });
  });

  it('Evidence 2 の ci の PASS・要判断・FAIL・aborted は、ローカルの完了ではないので再利用せずに止まる', () => {
    for (const verify of [ci(), local([pass], decision), local([pass, failed]), aborted('runtime')]) {
      withCandidate((sha, documents) => ({ ...common(sha, documents), schemaVersion: 2, verify }), (repo) => {
        expect(() => reusableEvidence(repo.root, repo.env, CHANGE, changeDir(repo))).toThrow('ローカルの項目がすべて完了した証拠');
      });
    }
  });
});

describe('2.0.0 の結果の文', () => {
  it('local の完了は最終合格と呼ばず、aborted は実行エラーと次の操作を示す。1.0.0 の文は変えない', () => {
    expect(kit.formatVerifyResult(local()).split('\n').at(-1)).toBe('ローカルの項目はすべて完了（CI の最終合格ではありません）');
    expect(kit.formatVerifyResult(ci()).split('\n').at(-1)).toBe('合格');
    expect(kit.formatVerifyResult(local([pass, failed]))).toContain('✖ command: lint\n    lint の出力');
    expect(kit.formatVerifyResult(local([pass], decision))).toContain('人の判断が必要です：仮定の承認が必要です');
    expect(kit.formatVerifyResult(aborted('config', '設定が不正です'))).toContain('中止しました（実行エラー。終了コード 2）');
    const legacy: VerifyResult = { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [{ check: 'x', status: 'pass', detail: '' }] };
    expect(kit.formatVerifyResult(legacy)).toBe('Loomake verify  mode=done  change=c1\n\n✔ x\n\n合格');
  });
});


describe('仕様ゲートの例外とブランチ', () => {
  it('[REQ-093] 既存の change のブランチへ切り替えたあと、仕様ゲートが例外で止まったら、元のブランチへ戻して終了コード 2 を返す', async () => {
    const repo = makeRepo();
    const real = kit.runVerify;
    const spy = vi.spyOn(kit, 'runVerify').mockImplementation((o) => {
      if (o.gate === 'spec-only') throw new kit.UsageError('使い方が違います');
      return real(o);
    });
    const saved = { ...process.env };
    Object.assign(process.env, repo.env);
    try {
      const start = repo.git('rev-parse', '--abbrev-ref', 'HEAD');
      repo.git('branch', 'loomake/c1');
      const exit = await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: () => {}, stderr: () => {} });
      expect(exit).toBe(2);
      expect(repo.git('rev-parse', '--abbrev-ref', 'HEAD')).toBe(start);
      expect(start).not.toBe('loomake/c1');
      expect(repo.calls()).toEqual([]);
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
      spy.mockRestore();
      repo.cleanup();
    }
  });
});

describe('2.0.0 の local の未完了の文', () => {
  it('scope:local・completed で pending があれば、fail が 0 でも完了と表示しない', () => {
    const pendingLocal = { ...local(), summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1, pending: 2 } } as VerifyResultV2;
    const last = kit.formatVerifyResult(pendingLocal).split('\n').at(-1);
    expect(last).toBe('未完了（2 件）');
    expect(last).not.toContain('完了（CI');
  });
});
