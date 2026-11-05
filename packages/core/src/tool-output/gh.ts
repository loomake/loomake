import type { ParseResult } from '../parse.js';
import { readJson } from './json.js';
import type { GhCheck, GhCheckBucket, ToolObservation } from './types.js';

const BUCKETS: readonly GhCheckBucket[] = ['pass', 'fail', 'pending', 'skipping', 'cancel'];

export function parseGhChecks(file: string, text: string): ParseResult<ToolObservation | null> {
  const { reader: r, value } = readJson(file, text);
  const checks: GhCheck[] = [];
  for (const [i, input] of r.array(value, 'checks').entries()) {
    const path = `checks[${i}]`;
    const check = r.object(input, path);
    const name = r.string(check.name, `${path}.name`);
    const bucket = r.string(check.bucket, `${path}.bucket`);
    const workflow = r.optionalString(check.workflow, `${path}.workflow`);
    const link = r.optionalString(check.link, `${path}.link`);
    checks.push({ name, bucket: BUCKETS.find((item) => item === bucket) ?? 'other', workflow, link });
    if (r.errors.length) break;
  }
  return r.finish({ tool: 'gh', kind: 'checks', checks });
}
