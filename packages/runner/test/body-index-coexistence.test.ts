import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { appendBodyReceipt, buildReport, evidenceProblem, readDocuments } from '@loomake/trace';
import { reusableEvidence } from '../src/reuse.js';
import { CHANGE, makeRepo } from './helpers.js';
import { summaryFixture } from '../../trace/test/summary-fixture.js';
import { receiptFixture } from '../../../tests/fixtures/body-index/fixture.js';

describe('本体索引と従来の閲覧・再利用の共存', () => {
  it('[REQ-470][REQ-471] 索引の追加でEvidence1/2とdocuments省略のreportを変えない', () => {
    const repo = makeRepo();
    try {
      for (const version of [1, 2]) {
        const base = summaryFixture();
        const record = { schemaVersion: version, change: CHANGE, sha: base.sha, recordedAt: base.recordedAt, committedAt: base.committedAt,
          verify: version === 1 ? { schemaVersion: '1.0.0', change: CHANGE, mode: 'done', ok: true, results: [] } : { ...base.verify, change: CHANGE } };
        expect(evidenceProblem(record, CHANGE)).toBeUndefined();
        const file = `.loomake/evidence/${CHANGE}/20261106T000000Z-aaaaaaaaaaaa.json`;
        repo.write(file, JSON.stringify(record) + '\n'); const bytes = readFileSync(join(repo.root, file));
        const report = buildReport(repo.root, CHANGE);
        expect(appendBodyReceipt(repo.root, { ...receiptFixture().receipt, locator: { ...receiptFixture().receipt.locator, artifactId: String(version) } })).toBe(true);
        expect(buildReport(repo.root, CHANGE)).toEqual(report); expect(readFileSync(join(repo.root, file))).toEqual(bytes);
      }
    } finally { repo.cleanup(); }
  });
  it('[REQ-470][REQ-471] 通常のsummary1件commitは再利用し索引だけのcommitは通常再検証へ進む', () => {
    const repo = makeRepo();
    try {
      const sha = repo.git('rev-parse', 'HEAD'), changeDir = join(repo.root, 'openspec/changes', CHANGE);
      const summary = summaryFixture(); summary.change = CHANGE; summary.sha = sha; summary.verify.change = CHANGE;
      summary.documents = readDocuments(changeDir);
      const file = `.loomake/evidence/${CHANGE}/20261106T000000Z-${sha.slice(0, 12)}.json`;
      repo.write(file, JSON.stringify(summary)); repo.git('add', '-A'); repo.git('commit', '-q', '-m', 'evidence');
      expect(reusableEvidence(repo.root, repo.env, CHANGE, changeDir)).toBe(file);
      const before = readFileSync(join(repo.root, file)); appendBodyReceipt(repo.root, receiptFixture().receipt);
      repo.git('add', '-A'); repo.git('commit', '-q', '-m', 'body receipt');
      expect(reusableEvidence(repo.root, repo.env, CHANGE, changeDir)).toBeUndefined();
      expect(readFileSync(join(repo.root, file))).toEqual(before);
    } finally { repo.cleanup(); }
  });
});
