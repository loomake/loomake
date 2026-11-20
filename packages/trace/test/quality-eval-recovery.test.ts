import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeFailure, UsageError, sha256Hex } from '@loomake/kit';
import { EVAL_LOCK, QUALITY_FILES } from '../src/quality-files.js';
import { requestEventProblem } from '../src/quality-ledger.js';
import { fixture, git } from './quality-eval-fixtures.js';
import { accepted, at, event, evaluation, failed, started, uuid, lines } from './quality-test-fixtures.js';

vi.setConfig({ testTimeout: 15_000 });
const eventsOf = (f: ReturnType<typeof fixture>, n: number) => f.storage().ledgers.requests.filter((r) => r.requestId === uuid(n)).map((r) => r.event);
const attemptsOf = (f: ReturnType<typeof fixture>, n: number) => f.storage().ledgers.attempts.filter((r) => r.requestId === uuid(n));
function seed(f: ReturnType<typeof fixture>, kind: 'started' | 'attempt' | 'history' | 'accepted' = 'started', otherTarget = false) {
  const target = { commit: otherTarget ? 'a'.repeat(40) : git(f.root, 'rev-parse', 'HEAD') };
  const basis = { qualitySha256: sha256Hex(f.read('quality.yaml')) };
  const accepted = { version: 1, event: 'accepted', requestId: uuid(1), at, pid: 42, source: 'manual-cli', target, basis };
  const started = { version: 1, event: 'started', requestId: uuid(1), at, runId: uuid(101), attempt: 1 };
  mkdirSync(join(f.root, 'reports/quality'), { recursive: true });
  writeFileSync(join(f.root, QUALITY_FILES.requests), lines(kind === 'accepted' ? [accepted] : [accepted, started]));
  if (kind === 'attempt') {
    const row = { version: 1, runId: uuid(101), attempt: 1, requestId: uuid(1), target, basis, startedAt: at, endedAt: at,
      detectedAt: at, result: 'failed', failure: 'timeout', summary: `reports/quality/requests.jsonl#${uuid(1)}`, future: { keep: ['all', 'bytes'] } };
    writeFileSync(join(f.root, QUALITY_FILES.attempts), ` ${JSON.stringify(row)} \n`);
  }
  if (kind === 'history') {
    const row = evaluation(); row.target.commit = target.commit; row.basis.qualitySha256 = basis.qualitySha256;
    writeFileSync(join(f.root, QUALITY_FILES.history), lines([row]));
  }
}

describe('単一実行者の要求回収と原本保持', () => {
  it('[REQ-440][REQ-441] 強制停止のstartedはcrashed/abandonedを経て後成功の参照で解消する', async () => {
    const f = fixture(); seed(f);
    // Leftover lock is never automatically removed; manual removal precedes recovery.
    mkdirSync(join(f.root, '.loomake/quality'), { recursive: true }); writeFileSync(join(f.root, EVAL_LOCK), 'stopped owner');
    const before = f.read(QUALITY_FILES.requests); expect(await f.evaluate()).toBe(3); expect(f.read(QUALITY_FILES.requests)).toBe(before);
    rmSync(join(f.root, EVAL_LOCK)); expect(await f.evaluate()).toBe(0);
    const data = f.storage(); expect(data.ledgers.attempts[0]).toMatchObject({ runId: uuid(101), attempt: 1, failure: 'crashed', endedAt: null, startedAt: at });
    expect(data.ledgers.history).toHaveLength(1); expect(data.index?.attempt).toBe(2);
    expect(data.ledgers.requests.filter((r) => r.requestId === uuid(1)).map((r) => r.event)).toEqual(['accepted', 'started', 'abandoned', 'reevaluated']);
    expect(data.ledgers.states.get(uuid(1))?.accepted.at).toBe(at); expect(data.index?.request.id).not.toBe(uuid(1)); expect(data.index?.request.requestedAt).not.toBe(at);
  });
  it('[REQ-441] attempt確定後failed前の停止はQ27どおり既存分類・時刻・bytesを完全保持する', async () => {
    const f = fixture(); seed(f, 'attempt'); const before = readFileSync(join(f.root, QUALITY_FILES.attempts));
    expect(await f.evaluate()).toBe(0); expect(readFileSync(join(f.root, QUALITY_FILES.attempts))).toEqual(before);
    expect(f.storage().ledgers.attempts).toHaveLength(1); expect(f.storage().ledgers.attempts[0].failure).toBe('timeout');
    expect(f.storage().ledgers.requests.filter((r) => r.requestId === uuid(1)).map((r) => r.event)).toEqual(['accepted', 'started', 'abandoned', 'reevaluated']);
    expect(f.storage().index?.attempt).toBe(2);
  });
  it('[REQ-441][REQ-433] history後の停止ではevaluatedだけ補い重複取り込みせず索引も復旧する', async () => {
    const f = fixture(); seed(f, 'history'); const before = f.read(QUALITY_FILES.history);
    expect(await f.evaluate()).toBe(0); expect(f.read(QUALITY_FILES.history).startsWith(before)).toBe(true);
    expect(f.storage().ledgers.history.map((r) => r.attempt)).toEqual([1, 2]); expect(f.storage().ledgers.attempts).toEqual([]);
    expect(f.storage().ledgers.requests.filter((r) => r.requestId === uuid(1)).map((r) => r.event)).toEqual(['accepted', 'started', 'evaluated']);
  });
  it('[REQ-440] 受付だけの残存と別対象のstartedを放棄し現在と異なる条件は回収不能へ残す', async () => {
    for (const kind of ['accepted', 'started'] as const) {
      const f = fixture(); seed(f, kind, true); expect(await f.evaluate()).toBe(0);
      const old = f.storage().ledgers.states.get(uuid(1)); expect(old?.state).toBe('unrecoverable'); expect(old?.last).toMatchObject({ event: 'unrecoverable', reason: 'head-changed' });
      expect(f.storage().ledgers.attempts).toHaveLength(kind === 'started' ? 1 : 0);
    }
  });
  it('[REQ-440] 後成功の履歴追記後に停止しHEADが変わっても、再評価待ちは同条件の後成功を参照して解消する', async () => {
    const f = fixture(); const commit = git(f.root, 'rev-parse', 'HEAD'), qualitySha256 = sha256Hex(f.read('quality.yaml'));
    const cond = { target: { commit }, basis: { qualitySha256 } };
    const requests = [{ ...accepted(1), ...cond }, started(1), event('failed', 1), { ...accepted(2), ...cond }, started(2)];
    const failure = { ...failed(1), ...cond }, later = evaluation(2);
    later.target.commit = commit; later.basis.qualitySha256 = qualitySha256;
    mkdirSync(join(f.root, 'reports/quality'), { recursive: true });
    writeFileSync(join(f.root, QUALITY_FILES.requests), lines(requests)); writeFileSync(join(f.root, QUALITY_FILES.attempts), lines([failure]));
    writeFileSync(join(f.root, QUALITY_FILES.history), lines([later]));
    git(f.root, 'commit', '-q', '--allow-empty', '-m', 'move head');
    expect(await f.evaluate()).toBe(0);
    const states = f.storage().ledgers.states;
    expect(states.get(uuid(1))?.last).toMatchObject({ event: 'reevaluated', runId: uuid(102), attempt: 2 });
    expect(states.get(uuid(2))?.last).toMatchObject({ event: 'evaluated', runId: uuid(102), attempt: 2 });
  });
  it('[REQ-440][REQ-442] 汚れた評価では再評価待ちを回収不能に確定せず、きれいな後の評価で再評価する', async () => {
    const f = fixture(); const commit = git(f.root, 'rev-parse', 'HEAD'), qualitySha256 = sha256Hex(f.read('quality.yaml'));
    const cond = { target: { commit }, basis: { qualitySha256 } };
    mkdirSync(join(f.root, 'reports/quality'), { recursive: true });
    writeFileSync(join(f.root, QUALITY_FILES.requests), lines([{ ...accepted(1), ...cond }, started(1), event('failed', 1), { ...accepted(2), ...cond }, started(2, 2)]));
    writeFileSync(join(f.root, QUALITY_FILES.attempts), lines([{ ...failed(1), ...cond }]));
    writeFileSync(join(f.root, 'quality.yaml'), `${f.read('quality.yaml')}# edit\n`);
    expect(await f.evaluate()).toBe(1);
    expect(f.storage().ledgers.states.get(uuid(1))?.state).toBe('reevaluation-pending');
    expect(f.storage().ledgers.requests.filter((r) => r.requestId === uuid(2)).map((r) => r.event)).toEqual(['accepted', 'started', 'abandoned']);
    expect(f.storage().ledgers.attempts.find((r) => r.requestId === uuid(2))?.failure).toBe('crashed');
    git(f.root, 'checkout', '--', 'quality.yaml'); expect(await f.evaluate()).toBe(0);
    expect(f.storage().ledgers.states.get(uuid(1))?.last.event).toBe('reevaluated'); expect(f.storage().ledgers.states.get(uuid(2))?.last.event).toBe('reevaluated');
  });
  it('[REQ-440][REQ-442] 履歴があってevaluatedのない要求は汚れた評価で決めず、きれいな評価でevaluatedだけを補う', async () => {
    const f = fixture(); seed(f, 'history'); writeFileSync(join(f.root, 'untracked.txt'), 'dirty');
    expect(await f.evaluate()).toBe(1); expect(eventsOf(f, 1)).toEqual(['accepted', 'started']); expect(attemptsOf(f, 1)).toEqual([]);
    rmSync(join(f.root, 'untracked.txt')); expect(await f.evaluate()).toBe(0);
    expect(eventsOf(f, 1)).toEqual(['accepted', 'started', 'evaluated']); expect(attemptsOf(f, 1)).toEqual([]);
  });
  it('[REQ-440][REQ-442] 汚れた評価を繰り返してもcrashedと放棄を重ねて書かない', async () => {
    const f = fixture(); seed(f); writeFileSync(join(f.root, 'untracked.txt'), 'dirty');
    for (let i = 0; i < 3; i++) expect(await f.evaluate()).toBe(1);
    expect(eventsOf(f, 1)).toEqual(['accepted', 'started', 'abandoned']);
    expect(attemptsOf(f, 1).map((r) => r.failure)).toEqual(['crashed']);
  });
  it('[REQ-440][REQ-442] 受付だけの要求は汚れた評価で放棄までに止める', async () => {
    const f = fixture(); seed(f, 'accepted'); writeFileSync(join(f.root, 'untracked.txt'), 'dirty');
    expect(await f.evaluate()).toBe(1); expect(eventsOf(f, 1)).toEqual(['accepted', 'abandoned']);
    expect(attemptsOf(f, 1)).toEqual([]);
  });
  it('[REQ-440] 壊れた台帳・矛盾する既存attemptは受付前に2相当で原本保持', async () => {
    const f = fixture(); seed(f, 'attempt'); const attempts = f.read(QUALITY_FILES.attempts).replace(uuid(1), uuid(9));
    writeFileSync(join(f.root, QUALITY_FILES.attempts), attempts); const before = f.read(QUALITY_FILES.requests);
    await expect(f.evaluate()).rejects.toBeInstanceOf(UsageError); expect(f.read(QUALITY_FILES.requests)).toBe(before); expect(f.read(QUALITY_FILES.attempts)).toBe(attempts);
    expect(existsSync(join(f.root, EVAL_LOCK))).toBe(false);
    for (const bad of [before.trimEnd(), '{bad}\n', before + before]) {
      writeFileSync(join(f.root, QUALITY_FILES.requests), bad);
      await expect(f.evaluate()).rejects.toBeInstanceOf(UsageError); expect(f.read(QUALITY_FILES.requests)).toBe(bad);
    }
  });
  it('[REQ-434][REQ-441] 実コマンドに自tokenが置き換えられたら全結果へ書かず他tokenを残す', async () => {
    const foreign = '{"foreign":"owner"}';
    const f = fixture(`require('node:fs').writeFileSync('${EVAL_LOCK}',${JSON.stringify(foreign)});`);
    await expect(f.evaluate()).rejects.toBeInstanceOf(RuntimeFailure);
    expect(f.read(EVAL_LOCK)).toBe(foreign); expect(f.storage().ledgers.history).toEqual([]); expect(f.storage().ledgers.attempts).toEqual([]);
    expect(f.storage().ledgers.requests.map((r) => r.event)).toEqual(['accepted', 'started']);
  });
  it('[REQ-440][REQ-441] 最初の中断はrunning取消/3で終端を保ち、次回成功でも再評価しない', async () => {
    const f = fixture(), controller = new AbortController(); controller.abort(); expect(await f.evaluate({ signal: controller.signal })).toBe(3);
    const first = f.storage(); const id = first.ledgers.requests[0].requestId;
    expect(first.ledgers.attempts[0].failure).toBe('interrupted'); expect(first.ledgers.requests.at(-1)).toMatchObject({ event: 'cancelled', phase: 'running' });
    expect(await f.evaluate()).toBe(0); expect(f.storage().ledgers.states.get(id)?.state).toBe('cancelled'); expect(f.storage().index?.attempt).toBe(2);
  });
  it('[REQ-432][REQ-433][REQ-441] 同日2回と翌日1回で3試行・2UTC期間を保持し観測時刻を時計引数から取る', async () => {
    const f = fixture();
    for (const date of ['2026-11-05T23:59:58.000Z', '2026-11-05T23:59:59.000Z', '2026-11-06T00:00:01.000Z']) {
      expect(await f.evaluate({ now: () => new Date(date) })).toBe(0);
    }
    const rows = f.storage().ledgers.history; expect(rows.map((r) => r.attempt)).toEqual([1, 2, 3]);
    expect(new Set(rows.map((r) => r.runId)).size).toBe(3); expect(new Set(rows.map((r) => r.period.start)).size).toBe(2);
    expect(rows.map((r) => r.evaluatedAt)).toEqual(['2026-11-05T23:59:58.000Z', '2026-11-05T23:59:59.000Z', '2026-11-06T00:00:01.000Z']);
    expect(f.storage().index).toEqual(rows[2]);
  });
  it('[REQ-440] enumを文字列へ変換せず配列・toString不正をUsage診断として拒否する', () => {
    for (const phase of [['running'], { toString: null }]) expect(requestEventProblem({ version: 1, event: 'cancelled', requestId: uuid(1), at, phase, signal: 'SIGINT' })).toBeTypeOf('string');
    expect(requestEventProblem({ version: 1, event: 'unrecoverable', requestId: uuid(1), at, reason: ['head-changed'] })).toBeTypeOf('string');
  });
});
