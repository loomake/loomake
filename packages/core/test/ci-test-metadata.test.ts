import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCiTestMetadata } from '../src/index.js';
import { errorLine } from '../src/test-report.js';

// Public CI run 41431688151, metadata only; SHA256 4d0188f2b16ae7ca10645bb072bf34303604af23569c93195ba6eba5c89e1213.
const original = readFileSync(new URL('./fixtures/ci-test-metadata-v1.json', import.meta.url), 'utf8');
const fixture = JSON.parse(original);
const strings = ['runUrl', 'runId', 'runAttempt', 'checkoutSha', 'os', 'node', 'shard'];
const counts = ['passed', 'failed', 'pending', 'skipped', 'todo', 'disabled'];
const parse = (value: unknown) => parseCiTestMetadata('metadata.json', JSON.stringify(value));
const rejected = (text: string) => {
  const result = parseCiTestMetadata('metadata.json', text);
  expect(result.value).toBeNull(); expect(result.errors.length).toBeGreaterThan(0);
  for (const error of result.errors) {
    expect(error.file).toBe('metadata.json'); expect(Number.isInteger(error.line) && error.line > 0).toBe(true);
    expect(error.message).toMatch(/[ぁ-んァ-ン一-龠]/);
  }
};

describe('parseCiTestMetadata', () => {
  it('[REQ-391] preserves the real metadata exactly without a verdict or invented fields', () => {
    expect(parseCiTestMetadata('metadata.json', original)).toStrictEqual({ value: fixture, errors: [] });
  });
  it.each(['success', 'failure', 'not_run'])('[REQ-391] accepts %s with empty strings and all report states/count boundaries', (testOutcome) => {
    for (const reportState of ['valid', 'empty', 'missing', 'invalid']) for (const count of [0, Number.MAX_SAFE_INTEGER]) {
      const input = { ...fixture, ...Object.fromEntries(strings.map((key) => [key, ''])), testOutcome, reportState,
        counts: Object.fromEntries(counts.map((key) => [key, count])) };
      expect(parse(input)).toStrictEqual({ value: input, errors: [] });
    }
  });
  it.each([null, [], {}, { ...fixture, schemaVersion: undefined }, { ...fixture, schemaVersion: 2 }, { ...fixture, schemaVersion: '1' }])(
    '[REQ-391] rejects invalid objects/versions %#', (input) => rejected(JSON.stringify(input)),
  );
  it('[REQ-391] reports the JSON diagnostic line and falls back to line one without a location', () => {
    const text = '{\n "schemaVersion": 1,\n bad\n}'; rejected(text);
    expect(parseCiTestMetadata('metadata.json', text).errors[0].line).toBe(3);
    expect(errorLine('a\nb\nc', 'position 4')).toBe(3); expect(errorLine('', 'no location')).toBe(1);
  });
  it.each(strings)('[REQ-391] rejects absent and non-string %s without authenticating string contents', (key) => {
    for (const bad of [undefined, null, 1, false, [], {}]) rejected(JSON.stringify({ ...fixture, [key]: bad }));
    expect(parse({ ...fixture, [key]: 'not authenticated' }).errors).toEqual([]);
  });
  it.each(['testOutcome', 'reportState'])('[REQ-391] rejects absent and unknown %s', (key) => {
    for (const bad of [undefined, null, '', 'other', 1, [], {}]) rejected(JSON.stringify({ ...fixture, [key]: bad }));
  });
  it.each([undefined, null, [], 'counts', 1])('[REQ-391] rejects absent/non-object counts %#', (bad) => {
    rejected(JSON.stringify({ ...fixture, counts: bad }));
  });
  it.each(counts)('[REQ-391] rejects absent/negative/fractional/non-number/infinite/unsafe %s', (key) => {
    for (const bad of [undefined, -1, 0.5, '0', null, true, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
      rejected(JSON.stringify({ ...fixture, counts: { ...fixture.counts, [key]: bad } }));
    }
    rejected(JSON.stringify({ ...fixture, counts: { ...fixture.counts, [key]: 'INFINITY' } }).replace('"INFINITY"', '1e999'));
  });
  it('[REQ-391] projects unknown/prototype keys without changing input or prototypes', () => {
    const text = original.replace('"counts": {', '"__proto__":{"polluted":true},"extra":1,"counts":{"__proto__":{"polluted":true},"extra":2,');
    const before = Object.getOwnPropertyDescriptors(Object.prototype); const result = parseCiTestMetadata('metadata.json', text);
    expect(result).toStrictEqual({ value: fixture, errors: [] }); expect(result.value).not.toBe(fixture);
    expect(result.value?.counts).not.toBe(fixture.counts); expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.value?.counts)).toBe(Object.prototype); expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(before);
    expect(JSON.parse(text)).toHaveProperty('extra', 1); expect(parseCiTestMetadata('metadata.json', text)).toStrictEqual(result);
  });
});
