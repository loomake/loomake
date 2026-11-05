import { randomUUID, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EvidenceSummary, SummaryGap, VerifyResult } from '@loomake/core';
import { basisHash, readInputBytes } from '@loomake/kit';

type SummaryExtension = Pick<EvidenceSummary, 'summaryVersion' | 'role' | 'ci' | 'execution' | 'artifacts' | 'request' | 'observation' | 'gaps'>;
const version = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
export const gap = (field: string, reason: string, kind: SummaryGap['kind'] = 'unverified'): SummaryGap => ({ field, kind, reason });
export const rawHash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** 設定本文もコマンド名も複製せず、参照と実際に取得した事実だけを保存する。 */
export function executionSummary(
  root: string, changeDir: string, result: VerifyResult, started: number, finished: number, env: NodeJS.ProcessEnv,
): SummaryExtension {
  const github = env.GITHUB_ACTIONS === 'true';
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  const runId = env.GITHUB_RUN_ID;
  const ci = github && typeof runId === 'string' && /^\d+$/.test(runId) && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? '') && Number.isSafeInteger(attempt)
    ? { runId, runAttempt: attempt, source: 'environment' as const } : null;
  const evidence = (result.checks ?? []).flatMap((check) => check.evidence);
  const producers = [...new Set(evidence.filter((s) => /^producer:(vitest|jest)@.+$/.test(s)))];
  const match = producers.length === 1 ? /^producer:(vitest|jest)@(.+)$/.exec(producers[0]) : null;
  const producer = match ? { name: match[1], version: match[2] } : null;
  const config = join(root, 'loomake.config.json');
  const commands = { source: existsSync(config) ? 'loomake.config.json' as const : 'defaults' as const,
    sha256: existsSync(config) ? rawHash(readInputBytes(config)) : null, nameRefs: null };
  const gaps = [gap('execution.commands.nameRefs', 'コマンドの訪問順を専用に観測していません'),
    gap('request', '評価要求はこの記録では扱いません', 'not_applicable'), gap('observation', '評価の観測期間はこの記録では扱いません', 'not_applicable')];
  if (ci === null) gaps.push(gap('ci', github ? 'CI実行の識別を確認できません' : 'GitHub Actionsの外で実行しています', github ? 'unverified' : 'not_applicable'));
  if (producer === null) gaps.push(gap('execution.producer', '生成器と版を確認できません'));
  if (commands.sha256 === null) gaps.push(gap('execution.commands.sha256', '設定ファイルを省略した既定値です', 'not_applicable'));
  gaps.push(gap('artifacts', '本体の観測を確認できません'));
  return { summaryVersion: 1, role: 'development', ci,
    execution: { id: randomUUID(), origin: github ? 'github-actions' : 'local', evaluator: { name: '@loomake/trace', version },
      basisSha256: basisHash(root, changeDir), environment: { node: process.version, platform: process.platform, arch: process.arch },
      commands, producer, startedAt: new Date(started).toISOString(), finishedAt: new Date(finished).toISOString(), verification: 'executed' },
    artifacts: [], request: null, observation: null, gaps };
}
