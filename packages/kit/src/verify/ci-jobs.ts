export type JobUnavailableReason = 'missing' | 'exit' | 'signal' | 'spawn' | 'json';
export type JobFetch = { kind: 'fetched'; job: string; value: unknown } | { kind: 'unavailable'; job: string; reason: JobUnavailableReason };

export function jobDigits(digits: string): string { return digits; }
export function fetchJob(_root: string, digits: string, _limit?: number): { result: JobFetch; bytes: number } {
  return { result: { kind: 'fetched', job: jobDigits(digits), value: undefined }, bytes: 0 };
}
