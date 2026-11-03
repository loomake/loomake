import type { ParseResult } from './parse.js';
import { errorLine } from './test-report.js';

const STRING_KEYS = ['runUrl', 'runId', 'runAttempt', 'checkoutSha', 'os', 'node', 'shard'] as const;
const COUNT_KEYS = ['passed', 'failed', 'pending', 'skipped', 'todo', 'disabled'] as const;
export type CiTestMetadataV1 = Record<(typeof STRING_KEYS)[number], string> & {
  schemaVersion: 1;
  testOutcome: 'success' | 'failure' | 'not_run';
  reportState: 'valid' | 'empty' | 'missing' | 'invalid';
  counts: Record<(typeof COUNT_KEYS)[number], number>;
};
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// Converts self-reported metadata only; does not authenticate, fetch, or judge it.
export function parseCiTestMetadata(file: string, text: string): ParseResult<CiTestMetadataV1 | null> {
  const invalid = (message: string, line = 1): ParseResult<null> => ({ value: null, errors: [{ file, line, message }] });
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return invalid(`JSON として読めません（${message}）`, errorLine(text, message));
  }
  if (!isObject(raw) || raw.schemaVersion !== 1) return invalid('metadata の schemaVersion は数値の 1 が必要です');
  if (STRING_KEYS.some((key) => typeof raw[key] !== 'string')) return invalid('metadata の必須文字列がないか、文字列ではありません');
  if (raw.testOutcome !== 'success' && raw.testOutcome !== 'failure' && raw.testOutcome !== 'not_run') {
    return invalid('metadata の testOutcome は success・failure・not_run のいずれかが必要です');
  }
  if (raw.reportState !== 'valid' && raw.reportState !== 'empty' && raw.reportState !== 'missing' && raw.reportState !== 'invalid') {
    return invalid('metadata の reportState は valid・empty・missing・invalid のいずれかが必要です');
  }
  const counts = raw.counts;
  if (!isObject(counts) || COUNT_KEYS.some((key) => !Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0)) {
    return invalid('metadata の counts は全6項目に0以上の安全整数が必要です');
  }
  const metadata = raw as CiTestMetadataV1;
  return { value: {
    schemaVersion: 1, runUrl: metadata.runUrl, runId: metadata.runId, runAttempt: metadata.runAttempt, checkoutSha: metadata.checkoutSha,
    os: metadata.os, node: metadata.node, shard: metadata.shard, testOutcome: metadata.testOutcome, reportState: metadata.reportState,
    counts: { passed: counts.passed as number, failed: counts.failed as number, pending: counts.pending as number,
      skipped: counts.skipped as number, todo: counts.todo as number, disabled: counts.disabled as number },
  }, errors: [] };
}
