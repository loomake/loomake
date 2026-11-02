import { sha256Hex } from '../hash.js';
import { checkInitialBaselineStructure } from './baseline.js';
import { checkBaselineRecord } from './baseline-record.js';
import { C001_INITIAL_BASELINE_PIN } from './c001-baseline.js';
import type { GitDocument } from './git-objects.js';
import { verifyOriginalSnapshot } from './original-snapshot.js';

type Document = { file: string; text: string };
type Result = ReturnType<typeof checkInitialBaselineStructure>;
const rejected = (problems: string[]): Result => ({ baseline: null, sha256: null, adoptionsVerified: false, problems });

/** 新入口内の原本照合だけを保証する。Git来歴・低位直呼び・採否主体・新実行は未検証。 */
export function checkAnchoredInitialBaseline(input: unknown, snapshot: readonly GitDocument[], anchor: readonly Document[]): Result {
  const files = snapshot.map(({ file, text, oid, mode }) => ({ file, text, oid, mode }));
  const original = verifyOriginalSnapshot(files, sha256Hex);
  if (!original.documents) return rejected(original.problems);
  return checkInitialBaselineStructure(input, { original: original.documents, anchor, sha256Hex });
}

/** 原本確認成功値だけを使い、C001のPINとhashは入口内部で選ぶ。 */
export function checkAnchoredC001Record(text: string, snapshot: readonly GitDocument[], anchor: readonly Document[]): Result {
  const files = snapshot.map(({ file, text, oid, mode }) => ({ file, text, oid, mode }));
  const original = verifyOriginalSnapshot(files, sha256Hex);
  if (!original.documents) return rejected(original.problems);
  return checkBaselineRecord(text, { original: original.documents, anchor, sha256Hex }, C001_INITIAL_BASELINE_PIN);
}
