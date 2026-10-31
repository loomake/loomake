// 現在のスキーマ検査をコピーし、破壊的な変更と版の変更を実際に与える。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyFixture, linkRuntimeDependencies } from './package-smoke.mjs';
import { classifyMutation, mutateOnce } from './domain-mutations.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = join(root, 'packages/core');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const assertions = (report) => report?.testResults?.flatMap((suite) => suite.assertionResults) ?? [];
const cases = [
  { id: 'baseline', kind: 'unchanged', expected: 'passed' },
  { id: 'remove-root', kind: 'remove', expected: 'rejected' },
  { id: 'rename-root', kind: 'rename', expected: 'rejected' },
  { id: 'remove-item', kind: 'remove-item', expected: 'rejected' },
  { id: 'rename-item', kind: 'rename-item', expected: 'rejected' },
  { id: 'minor-removal', kind: 'remove', version: '2.1.0', expected: 'rejected' },
  { id: 'major-removal', kind: 'remove', version: '3.0.0', expected: 'passed' },
  { id: 'major-rename', kind: 'rename-item', version: '3.0.0', expected: 'passed' },
];
// 版付きのファイル（schema/versions/）への変更。公開した版のファイルは、必須項目の削除・改名と版の変更を拒否する（REQ-276）
const versionCases = [
  { id: 'v2-baseline', kind: 'unchanged', expected: 'passed' },
  { id: 'v2-remove-root', kind: 'remove', expected: 'rejected' },
  { id: 'v2-rename-root', kind: 'rename', expected: 'rejected' },
  { id: 'v2-remove-item', kind: 'remove-item', expected: 'rejected' },
  { id: 'v2-rename-item', kind: 'rename-item', expected: 'rejected' },
  { id: 'v2-version', kind: 'version', expected: 'rejected' },
];
const versionedFile = 'schema/versions/verify-result-2.0.0.schema.json';

// 版付きでない現行のファイル（2.0.0）を変える。必須項目は ci と local の両方の枝から消し、どの枝にも残らないようにする（REQ-053）
function mutateCurrent(schema, kind) {
  for (const branch of schema.anyOf.filter((b) => b.properties.checks?.items)) {
    if (kind === 'remove') { branch.required = branch.required.filter((name) => name !== 'decision'); delete branch.properties.decision; }
    if (kind === 'rename') {
      branch.required = branch.required.map((name) => name === 'scope' ? 'scopeV3' : name);
      branch.properties.scopeV3 = branch.properties.scope; delete branch.properties.scope;
    }
    const item = branch.properties.checks.items;
    if (kind === 'remove-item') { item.required = item.required.filter((name) => name !== 'reason'); delete item.properties.reason; }
    if (kind === 'rename-item') {
      item.required = item.required.map((name) => name === 'id' ? 'checkId' : name);
      item.properties.checkId = item.properties.id; delete item.properties.id;
    }
  }
}

// 2.0.0 の ci の枝（anyOf[0]）と aborted の枝（anyOf[2]）を変える
function mutateVersioned(schema, kind) {
  const [ci, , aborted] = schema.anyOf;
  if (kind === 'remove') { ci.required = ci.required.filter((name) => name !== 'checks'); delete ci.properties.checks; }
  if (kind === 'rename') {
    ci.required = ci.required.map((name) => name === 'scope' ? 'scopeV3' : name);
    ci.properties.scopeV3 = ci.properties.scope; delete ci.properties.scope;
  }
  if (kind === 'remove-item') { const item = ci.properties.checks.items; item.required = item.required.filter((name) => name !== 'reason'); delete item.properties.reason; }
  if (kind === 'rename-item') {
    const item = aborted.properties.run.properties.errors.items;
    item.required = item.required.map((name) => name === 'next' ? 'nextStep' : name);
    item.properties.nextStep = item.properties.next; delete item.properties.next;
  }
  if (kind === 'version') for (const branch of schema.anyOf) branch.properties.schemaVersion.const = '2.1.0';
}

function runTrial(trial, testFile) {
  writeFileSync(join(trial, 'vitest.config.mjs'), `export default { test: { include: [${JSON.stringify(testFile)}], reporters: ["json"], outputFile: { json: "./report.json" } } };\n`);
  const processResult = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', trial, '--config', join(trial, 'vitest.config.mjs')], { cwd: trial, encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  writeFileSync(join(trial, 'stdout.txt'), processResult.stdout ?? ''); writeFileSync(join(trial, 'stderr.txt'), processResult.stderr ?? '');
  let report;
  try { report = JSON.parse(readFileSync(join(trial, 'report.json'), 'utf8')); } catch { /* 読めない結果を成功扱いにしない。 */ }
  return { processResult, report };
}

export function checkSchemaContract(destination) {
  const target = resolve(destination);
  const part = relative(join(root, '.loomake/quality'), target);
  assert.ok(part && part !== '..' && !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(part), '保存先は.loomake/qualityの下にしてください');
  const quality = join(root, '.loomake/quality'); mkdirSync(quality, { recursive: true });
  assert.equal(realpathSync(quality), quality, '検証先の親にシンボリックリンクは使えません');
  const parent = realpathSync(dirname(target)); const parentPart = relative(quality, parent);
  assert.ok(parent === quality || (parentPart && !parentPart.startsWith('..') && !isAbsolute(parentPart)), '検証先が専用ディレクトリの外にあります');
  mkdirSync(target);
  const sources = ['schema/verify-result.schema.json', 'src/verify-result.ts', 'test/schema.test.ts', 'test/fixtures/schema-history/1.0.0.json', 'test/fixtures/schema-history/2.0.0.json', versionedFile, 'test/schema-versions.test.ts', 'test/fixtures/schema-versions/verify-result-2.0.0.json'].map((file) => ({ file: `packages/core/${file}`, sha256: sha256(join(core, file)) }));
  const result = { scope: 'required-property-version-gate', node: process.version, trials: [], versionTrials: [], sources, ok: false };
  let names;
  try {
    for (const entry of cases) {
      const trial = join(target, entry.id); mkdirSync(trial);
      copyFixture(join(core, 'src'), join(trial, 'src'));
      copyFixture(join(core, 'schema'), join(trial, 'schema'));
      copyFixture(join(core, 'test/fixtures/schema-history'), join(trial, 'test/fixtures/schema-history'));
      writeFileSync(join(trial, 'test/schema.test.ts'), readFileSync(join(core, 'test/schema.test.ts')));
      writeFileSync(join(trial, 'package.json'), readFileSync(join(core, 'package.json')));
      // 複製したソースが core の実行時依存（zod）を読めるようにする
      linkRuntimeDependencies(core, trial);
      const schemaPath = join(trial, 'schema/verify-result.schema.json');
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      mutateCurrent(schema, entry.kind);
      if (entry.version) {
        for (const branch of schema.anyOf) branch.properties.schemaVersion.const = entry.version;
        const source = join(trial, 'src/verify-result.ts');
        writeFileSync(source, mutateOnce(readFileSync(source, 'utf8'), "'2.0.0'", `'${entry.version}'`));
      }
      writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
      writeFileSync(join(trial, 'candidate.schema.json'), readFileSync(schemaPath));
      writeFileSync(join(trial, 'vitest.config.mjs'), 'export default { test: { include: ["test/schema.test.ts"], reporters: ["json"], outputFile: { json: "./report.json" } } };\n');
      const processResult = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', trial, '--config', join(trial, 'vitest.config.mjs')], { cwd: trial, encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
      writeFileSync(join(trial, 'stdout.txt'), processResult.stdout ?? ''); writeFileSync(join(trial, 'stderr.txt'), processResult.stderr ?? '');
      let report;
      try { report = JSON.parse(readFileSync(join(trial, 'report.json'), 'utf8')); } catch { /* 読めない結果を成功扱いにしない。 */ }
      if (!names) names = assertions(report).map((test) => test.fullName);
      const verdict = classifyMutation(processResult.error ? null : processResult.status, report, names);
      const status = verdict.status === 'survived' ? 'passed' : verdict.status === 'killed' ? 'rejected' : 'error';
      result.trials.push({ ...entry, status, exitCode: processResult.status, failedTests: verdict.failedTests, schemaSha256: sha256(schemaPath) });
      for (const path of ['src', 'schema', 'test', 'package.json', 'vitest.config.mjs', 'node_modules']) rmSync(join(trial, path), { recursive: true, force: true });
      if (entry.id === 'baseline' && status !== 'passed') break;
    }
    let versionNames;
    for (const entry of versionCases) {
      const trial = join(target, entry.id); mkdirSync(trial);
      copyFixture(join(core, 'schema'), join(trial, 'schema'));
      copyFixture(join(core, 'test/fixtures/schema-history'), join(trial, 'test/fixtures/schema-history'));
      copyFixture(join(core, 'test/fixtures/schema-versions'), join(trial, 'test/fixtures/schema-versions'));
      writeFileSync(join(trial, 'test/schema-versions.test.ts'), readFileSync(join(core, 'test/schema-versions.test.ts')));
      const schemaPath = join(trial, versionedFile);
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      mutateVersioned(schema, entry.kind);
      writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
      writeFileSync(join(trial, 'candidate.schema.json'), readFileSync(schemaPath));
      const { processResult, report } = runTrial(trial, 'test/schema-versions.test.ts');
      if (!versionNames) versionNames = assertions(report).map((test) => test.fullName);
      const verdict = classifyMutation(processResult.error ? null : processResult.status, report, versionNames);
      const status = verdict.status === 'survived' ? 'passed' : verdict.status === 'killed' ? 'rejected' : 'error';
      result.versionTrials.push({ ...entry, status, exitCode: processResult.status, failedTests: verdict.failedTests, schemaSha256: sha256(schemaPath) });
      for (const path of ['schema', 'test', 'vitest.config.mjs']) rmSync(join(trial, path), { recursive: true, force: true });
      if (entry.id === 'v2-baseline' && status !== 'passed') break;
    }
  } finally {
    result.originalsUnchanged = sources.every((source) => sha256(join(root, source.file)) === source.sha256);
    result.ok = result.originalsUnchanged && result.trials.length === cases.length && result.trials.every((trial) => trial.status === trial.expected)
      && result.versionTrials.length === versionCases.length && result.versionTrials.every((trial) => trial.status === trial.expected);
    writeFileSync(join(target, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv[2], '新しい検証先を指定してください');
    const result = checkSchemaContract(process.argv[2]);
    console.log(`スキーマ契約の検証：${result.trials.filter((trial) => trial.status === trial.expected).length}/${cases.length}、版付きのファイル：${result.versionTrials.filter((trial) => trial.status === trial.expected).length}/${versionCases.length}`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(`スキーマ契約の検証に失敗しました：${error.message}`); process.exitCode = 1; }
}
