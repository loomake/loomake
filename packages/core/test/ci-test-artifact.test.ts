import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';

const metadata = readFileSync(new URL('./fixtures/ci-test-metadata-v1.json', import.meta.url), 'utf8');
const original = JSON.parse(metadata);
const report = JSON.stringify({ startTime: 1234, testResults: [{ name: 'case.test.ts', status: 'failed', message: 'original',
  assertionResults: [{ fullName: '[REQ-015][REQ-392] failed', status: 'failed' },
    { fullName: '[REQ-392] skipped', status: 'skipped' }, { fullName: '[REQ-392] unknown', status: 'new-status' }] }] });
const syntax = '{\n bad\n}';
const empty = '{"testResults":[]}';
const badReport = '{"testResults":[{"name":"case.test.ts"}]}';
const parse = (metaText: string, reportText: string | null) => core.parseCiTestArtifact({
  metadata: { file: 'metadata.json', text: metaText }, report: reportText === null ? null : { file: 'report.json', text: reportText },
});

describe('parseCiTestArtifact', () => {
  it.each([report, empty])('[REQ-392] preserves both parsers including a valid empty report %#', (text) => {
    expect(parse(metadata, text)).toStrictEqual({ value: {
      metadata: original, report: core.parseTestReport('report.json', text).value,
    }, errors: [] });
    expect(parse(metadata, text).value.report).not.toBeNull();
  });
  it('[REQ-392] returns null only for an absent report without inventing a report error', () => {
    expect(parse(metadata, null)).toStrictEqual({ value: { metadata: original, report: null }, errors: [] });
  });
  it.each([
    [syntax, report, true, false, [['metadata.json', 2]]],
    ['[]', report, true, false, [['metadata.json', 1]]],
    [JSON.stringify({ ...original, schemaVersion: 2 }), report, true, false, [['metadata.json', 1]]],
    [metadata, syntax, false, true, [['report.json', 2]]],
    [metadata, badReport, false, true, [['report.json', 1]]],
    [metadata, '', false, true, [['report.json', 1]]],
    [syntax, syntax, true, true, [['metadata.json', 2], ['report.json', 2]]],
    ['[]', badReport, true, true, [['metadata.json', 1], ['report.json', 1]]],
    ['[]', null, true, true, [['metadata.json', 1]]],
  ] as const)('[REQ-392] retains the healthy side and every original diagnostic %#', (metaText, reportText, metaBad, reportBad, locations) => {
    const result = parse(metaText, reportText);
    expect(result.value.metadata).toStrictEqual(metaBad ? null : original);
    expect(result.value.report).toStrictEqual(reportBad ? null : core.parseTestReport('report.json', reportText!).value);
    expect(result.errors.map(({ file, line }) => [file, line])).toStrictEqual(locations);
    for (const error of result.errors) {
      expect(Number.isInteger(error.line) && error.line > 0).toBe(true);
      expect(error.message).toMatch(/[ぁ-んァ-ン一-龠]/);
    }
    const metadataErrors = core.parseCiTestMetadata('metadata.json', metaText).errors;
    const reportErrors = reportText === null ? [] : core.parseTestReport('report.json', reportText).errors;
    expect(result.errors).toStrictEqual([...metadataErrors, ...reportErrors]);
  });
  it('[REQ-392] keeps conflicting metadata and body statuses, requirements, and start time separate', () => {
    const claimed = { ...original, testOutcome: 'success', reportState: 'valid',
      counts: { passed: 0, failed: 0, pending: 0, skipped: 0, todo: 0, disabled: 0 } };
    const result = parse(JSON.stringify(claimed), report);
    expect(result.errors).toEqual([]);
    expect(result.value.metadata).toStrictEqual(claimed);
    expect(result.value.report).toStrictEqual(core.parseTestReport('report.json', report).value);
    expect(result.value.report?.startTime).toBe(1234);
    expect(result.value.report?.tests.map(({ status }) => status)).toEqual(['failed', 'skipped', 'other']);
    expect(result.value.report?.tests[0].requirements).toEqual(['REQ-015', 'REQ-392']);
    expect(Object.keys(result.value).sort()).toEqual(['metadata', 'report']);
  });
  it('[REQ-392] leaves frozen inputs, prototype state, and existing parser results unchanged', () => {
    const text = metadata.replace('"counts": {', '"__proto__":{"polluted":true},"extra":1,"counts":{');
    const input = Object.freeze({ metadata: Object.freeze({ file: 'metadata.json', text }),
      report: Object.freeze({ file: 'report.json', text: report }) });
    const before = JSON.stringify(input); const prototypes = Object.getOwnPropertyDescriptors(Object.prototype);
    const expectedReport = core.parseTestReport('report.json', report);
    const expectedRequirements = core.extractTestRequirements('report.json', report);
    const result = core.parseCiTestArtifact(input);
    expect(result).toStrictEqual({ value: { metadata: original, report: expectedReport.value }, errors: [] });
    expect(core.parseCiTestArtifact(input)).toStrictEqual(result);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypes);
    expect(core.parseTestReport('report.json', report)).toStrictEqual(expectedReport);
    expect(core.extractTestRequirements('report.json', report)).toStrictEqual(expectedRequirements);
  });
});
