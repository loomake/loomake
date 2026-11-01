import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Independently measured from these blobs at bb88fe238ab0254e34d25dd8caeb19e8d0155cc4.
// Do not derive the expected hashes from the current schema generator or checkout.
const originalSchemas = [
  ['quality-report', 'ff3abde48b5e4d1ac5b70efd69d98633eac7422755a40b662b547f20d6462c44'],
  ['quality', 'bc650d8da6a4037045b6ddc851b1d12679474ffb708698920574c78c722416a2'],
  ['report', 'ec6af2bf1d26981c0755311de190e7a205e379a78a9e072c4ac26fca881a4b35'],
  ['spec', 'f42717930be8bdef81a320c29257af68ee724e074df726e6d4526a3290bc6d24'],
  ['tasks', 'db371161b4940fdd1871b1e43d3830307680188e6e3ab49061664b988fa5e11a'],
  ['trace', '415f1b539e661bc50179ba777507bb0851dc252929722ea9d570cd9eeda5b9c9'],
] as const;

describe('Original C001 public JSON preservation', () => {
  it.each(originalSchemas)('[REQ-371][REQ-304][REQ-305][REQ-307] preserves the original %s schema bytes', (name, expectedSha256) => {
    const file = resolve(import.meta.dirname, `../packages/core/schema/${name}.schema.json`);
    // Git can check out CRLF on Windows; every other byte remains significant.
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(expectedSha256);
  });
});
