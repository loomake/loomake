import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditScenarios, blockDigest, inventoryScenarios, sha256 } from '../../../../scripts/scenario-audit.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const reportFile = process.argv[2] ?? '.loomake/test-report.json';
const reportText = read(reportFile);
const input = JSON.parse(reportText);
const executions = input.testResults.flatMap((suite) => {
  const file = relative(root, resolve(root, suite.name)).split('\\').join('/');
  assert.ok(!file.startsWith('../'));
  return suite.assertionResults.map((test) => ({ file, fullName: test.fullName, status: test.status }));
});
const reviewsText = readFileSync(resolve(here, 'reviews.json'), 'utf8');
const reviews = JSON.parse(reviewsText);
const deltaText = read(reviews.deltaPath);
const scenarios = inventoryScenarios(reviews.canonicalPath, deltaText);
const sources = Object.fromEntries([...new Set(reviews.reviews.flatMap((row) => row.tests.map((test) => test.file)))].map((file) => [file, read(file)]));
for (const review of reviews.reviews) {
  for (const selector of review.tests) {
    const tests = executions.filter((test) => test.file === selector.file && test.fullName.includes(selector.contains));
    assert.equal(blockDigest(sources[selector.file], tests), selector.sha256);
  }
}
const result = auditScenarios(scenarios, reviews.reviews, executions, sources);
result.scope = 'Child delta only, evaluated with its future canonical main-spec path; repository pending is unchanged.';
result.repositoryApplied = false;
result.inputs = {
  deltaPath: reviews.deltaPath,
  canonicalPath: reviews.canonicalPath,
  deltaSha256: sha256(deltaText),
  testReportSha256: sha256(reportText),
  reviewSha256: sha256(reviewsText),
  scriptSha256: sha256(read('scripts/scenario-audit.mjs')),
};
const output = resolve(process.argv[3] ?? resolve(here, 'result.json'));
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ scope: 'child delta only', ok: result.ok, counts: result.counts, repositoryApplied: false }));
process.exitCode = result.ok ? 0 : 1;
