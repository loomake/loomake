import type { TestCase } from '../test-report.js';

export type ToolName = 'gh' | 'claude' | 'codex' | 'biome' | 'playwright';
export type GhCheckBucket = 'pass' | 'fail' | 'pending' | 'skipping' | 'cancel' | 'other';
export type GhCheck = { name: string; bucket: GhCheckBucket; workflow: string | null; link: string | null };
export type AgentCause = 'reported_error' | 'flagged_error' | 'missing_result' | 'unknown_subtype' | 'stream_error';
export type AgentResult = {
  terminal: 'success' | 'error'; cause: AgentCause | null;
  text: string | null; sessionId: string | null; turns: number | null; errors: string[];
};
export type ToolFinding = {
  severity: 'fatal' | 'error' | 'warning' | 'info' | 'hint'; category: string | null;
  message: string; file: string | null; line: number | null; column: number | null;
};
export type BiomeSummary = { errors: number; warnings: number; infos: number; diagnosticsNotPrinted: number };
export type PlaywrightTestCase = TestCase & {
  project: string; outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped'; retries: number;
};
export type PlaywrightError = { message: string | null };
export type ToolObservation =
  | { tool: 'gh'; kind: 'checks'; checks: GhCheck[] }
  | { tool: 'claude' | 'codex'; kind: 'agent-result'; result: AgentResult }
  | { tool: 'biome'; kind: 'diagnostics'; findings: ToolFinding[]; summary: BiomeSummary }
  | {
    tool: 'playwright'; kind: 'tests'; tests: PlaywrightTestCase[];
    stats: { expected: number; unexpected: number; flaky: number; skipped: number }; errors: PlaywrightError[];
  };
