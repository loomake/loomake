import { JSON_LIMITS, UsageError } from '@loomake/kit';
import { evidenceProblem } from './evidence.js';
import type { EvidenceV2 } from '@loomake/core';
import type { Evidence } from './record.js';

/** 保存前に形式と、末尾改行を含む整形JSONのバイト数を検証する。 */
export function serializeEvidence(evidence: Evidence | EvidenceV2, maxBytes = JSON_LIMITS.maxFileBytes): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new UsageError('証拠のサイズ上限は正の安全な整数にしてください');
  const problem = evidenceProblem(evidence, evidence.change);
  if (problem) throw new UsageError(`生成した証拠の形式が不正です：${problem}`);
  let json: string;
  try {
    const value = JSON.stringify(evidence, null, 2);
    if (typeof value !== 'string') throw new Error('JSON文字列がありません');
    json = value + '\n';
  }
  catch (error) { throw new UsageError('証拠をJSONに変換できません。検証結果と文書の内容を確認してください。', { cause: error }); }
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > maxBytes) throw new UsageError(`生成する証拠の上限は${maxBytes}バイトです（${bytes}バイト）。検証結果と文書の内容を確認してください。記録していません。`);
  const serializedProblem = evidenceProblem(JSON.parse(json), evidence.change);
  if (serializedProblem) throw new UsageError(`JSONへ変換した証拠の形式が不正です：${serializedProblem}`);
  return json;
}
