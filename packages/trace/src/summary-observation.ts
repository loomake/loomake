import { join } from 'node:path';
import { parseTestReport, type SummaryArtifact, type SummaryGap, type VerifyResult } from '@loomake/core';
import { InputReadFailure, readInputBytes } from '@loomake/kit';
import { gap, rawHash } from './summary-record.js';

type Observation = { artifacts: SummaryArtifact[]; gaps: SummaryGap[]; mismatch: boolean };
/** 本体の安全性は共有readerへ委ね、OS不読と入力拒否を混同しない。 */
export function summaryObservation(root: string, path: string, result: VerifyResult, started: number, finished: number): Observation {
  let bytes: Buffer;
  try { bytes = readInputBytes(join(root, path)); }
  catch (error) {
    if (!(error instanceof InputReadFailure)) throw error;
    const missing = (error.cause as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
    return { artifacts: [], gaps: [gap('artifacts', missing ? '本体がありません' : '本体を読み取れません')], mismatch: false };
  }
  const sha256 = rawHash(bytes);
  const checks = result.checks ?? [];
  const hashes = [...new Set(checks.flatMap((c) => c.evidence).filter((s) => /^report:sha256:[a-f0-9]{64}$/.test(s)).map((s) => s.slice('report:sha256:'.length)))];
  let text: string | undefined;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { /* 置換decodeされた旧checkハッシュとは表現が違う。 */ }
  if (hashes.some((hash) => (text !== undefined || hash === rawHash(new Uint8Array()) && bytes.length > 0) && hash !== sha256)) {
    return { artifacts: [], gaps: [], mismatch: true };
  }
  let reason = '同じ実行の本体として照合できません';
  let counts: SummaryArtifact['counts'] = null;
  if (text === undefined) reason = '本体はstrict UTF-8として不正です';
  else {
    const parsed = parseTestReport(path, text);
    const commands = checks.filter((c) => c.id.startsWith('command: '));
    if (result.run.status !== 'completed' || result.scope !== 'ci' || hashes.length !== 1 || commands.length === 0 || commands.some((c) => c.result !== 'PASS')) reason = '同じCI実行と品質コマンドの完了を確認できません';
    else if (parsed.errors.length) reason = '本体をテストレポートとして解釈できません';
    else if (parsed.value.startTime === null || parsed.value.startTime < started || parsed.value.startTime > finished) reason = '本体の開始時刻が検証の期間内ではありません';
    else {
      const raw = JSON.parse(text) as Record<string, unknown>;
      const partial = raw.success === false || parsed.value.files.some((f) => f.status === 'failed' && f.tests === 0)
        || (raw.numTotalTests !== undefined && raw.numTotalTests !== parsed.value.tests.length)
        || (typeof raw.numFailedTestSuites === 'number' && raw.numFailedTestSuites > 0);
      if (partial) reason = '既知の部分出力または空の失敗ファイルがあります';
      else {
        counts = { passed: 0, failed: 0, skipped: 0, todo: 0, pending: 0, other: 0 };
        for (const test of parsed.value.tests) counts[test.status]++;
      }
    }
  }
  const artifact: SummaryArtifact = { kind: 'test-report', path, sha256, bytes: bytes.length,
    sameRun: counts === null ? { status: 'unverified', reason } : { status: 'verified' }, counts,
    location: null, availability: 'not-uploaded', expiresAt: null, retrieval: null };
  const gaps = ['location', 'expiresAt', 'retrieval'].map((field) => gap(`artifacts[0].${field}`, '本体は共有保存先への配置・取得を確認していません'));
  if (counts === null) gaps.push(gap('artifacts[0].counts', reason));
  return { artifacts: [artifact], gaps, mismatch: false };
}
