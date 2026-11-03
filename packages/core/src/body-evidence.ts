export const BODY_EVIDENCE_KEY = 'loomakeBody';
export type BodyAttempt = { repeat: number; retry: number; expectedFailure: boolean | null; state: string | null; calls: Record<string, number> };
export type BodyEvidence = { format: 1; attempts: BodyAttempt[] };
