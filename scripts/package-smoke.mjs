// prepareは開発用Node、checkは配布物の対応Nodeで実行する。
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { markPhase } from './ci-heartbeat.mjs';
import { isMain } from './lib/is-main.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = ['core', 'kit', 'trace', 'runner', 'cli'];
const win = process.platform === 'win32';
const quote = (value) => win ? `"${value.replace(/"/g, '""')}"` : value;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

function run(command, args, cwd, expected = 0) {
  // PATH から探す固定の名前を引用符で囲むと、pnpm.CMD の %~dp0 がバッチの場所にならない。
  // 空白を含みうる実行パス（.cmd の絶対パス）と引数は囲む
  const bare = command === 'pnpm' || command === 'npm';
  const shell = win && (bare || command.endsWith('.cmd'));
  const started = Date.now();
  const result = spawnSync(shell && !bare ? quote(command) : command, shell ? args.map(quote) : args, { cwd, encoding: 'utf8', shell, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  // LOOMAKE_CI_HEARTBEAT_DIR があるときだけ、コマンドの種類と時間を記録する。引数と出力は記録しない（REQ-345）
  markPhase('package-smoke', 'command', { kind: ['npm', 'pnpm', 'git'].includes(command) ? command : 'other', durationMs: Date.now() - started });
  assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
  return result.stdout;
}

/** 試験用のファイルを読み書きして複製し、コピー先や元の権限の共有を避ける。 */
export function copyFixture(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyFixture(from, to);
    else if (entry.isFile()) writeFileSync(to, readFileSync(from));
    else throw new Error(`試験用データに通常のファイルでない項目があります：${entry.name}`);
  }
}

/** 5 パッケージを pack する。直前に build した CI は、その重複だけを明示指定で省く。 */
export function buildAndPack(destination, { skipBuild = false } = {}) {
  if (!skipBuild) run('pnpm', ['-r', 'build'], root);
  for (const name of packages) run('pnpm', ['pack', '--pack-destination', destination, '--silent'], join(root, 'packages', name));
}

/** パッケージの外部の実行時依存（core の zod など）を、複製先の node_modules から実体を指すリンクで読めるようにする。 */
export function linkRuntimeDependencies(packageDir, target) {
  for (const dep of Object.keys(json(join(packageDir, 'package.json')).dependencies ?? {})) {
    if (dep.startsWith('@loomake/') || dep === 'loomake') continue;
    const link = join(target, 'node_modules', dep);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(realpathSync(join(packageDir, 'node_modules', dep)), link, 'junction');
  }
}

/** ci.test_report の必須 1 項目だけを置く quality.yaml（リポジトリ直下の quality.yaml と同じ形。REQ-319） */
export const QUALITY_YAML = [
  'version: 2',
  'model: iso-iec-25010-2011',
  'product:',
  '  PQ-900:',
  '    characteristic: functional_suitability',
  '    subcharacteristic: functional_correctness',
  '    blocking: true',
  '    applicability: applicable',
  '    evidence:',
  '      - source: ci.test_report',
  '        metric: required_subjects_with_failed_tests',
  '        target: "== 0"',
  '        min_samples: 1',
  '',
].join('\n');

/**
 * ci の完了ゲートに要る quality.yaml と、テストランナーの版を読む node_modules/vitest（リポジトリの Vitest を指すリンク）を置く（REQ-319）。
 * node_modules/ は呼び出し側の .gitignore で除く
 */
export function placeCiQuality(project) {
  writeFileSync(join(project, 'quality.yaml'), QUALITY_YAML);
  const link = join(project, 'node_modules', 'vitest');
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(dirname(createRequire(join(root, 'package.json')).resolve('vitest/package.json')), link, 'junction');
}

/** 既存のディレクトリを上書きせず、配布物と独立した利用先を準備する。 */
export function prepare(target, { skipBuild = false } = {}) {
  mkdirSync(target);
  const tarballs = join(target, 'tarballs');
  const consumer = join(target, 'consumer');
  mkdirSync(tarballs);
  mkdirSync(consumer);
  // 試験では、Vitest の globalSetup（tests/package-build.setup.ts）がワーカーを起こす前に 1 回だけ build と pack をして、
  // その tarball の場所を渡す。試験の中で build を重ねると、tsc が空にした .d.ts をほかの build が読んで落ちる（Issue #34）
  const packed = process.env.LOOMAKE_PACKED_TARBALLS;
  if (packed) for (const file of readdirSync(packed).filter((name) => name.endsWith('.tgz'))) copyFileSync(join(packed, file), join(tarballs, file));
  else buildAndPack(tarballs, { skipBuild });
  const files = readdirSync(tarballs).filter((name) => name.endsWith('.tgz'));
  assert.equal(files.length, 5);
  // 外部の実行時依存（core の zod など）は、ワークスペースに入っている版を npm の cache に入れてから、オフラインで入れる
  const external = new Set();
  for (const name of packages) {
    const dir = join(root, 'packages', name);
    for (const dep of Object.keys(json(join(dir, 'package.json')).dependencies ?? {})) {
      if (!dep.startsWith('@loomake/') && dep !== 'loomake') external.add(`${dep}@${json(join(dir, 'node_modules', dep, 'package.json')).version}`);
    }
  }
  for (const spec of external) run('npm', ['cache', 'add', spec], root);
  writeFileSync(join(consumer, 'package.json'), '{"name":"loomake-smoke-consumer","private":true,"type":"module"}\n');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...files.map((file) => join(tarballs, file))], consumer);
  const fixture = join(root, 'tests/fixtures/verify-project/openspec/changes/sample');
  copyFixture(fixture, join(consumer, 'openspec/changes/sample'));
  writeFileSync(join(consumer, 'AGENTS.md'), '# Package smoke\n');
  writeFileSync(join(consumer, '.gitignore'), 'node_modules/\n.loomake/test-report.json\n');
  writeFileSync(join(consumer, 'loomake.config.json'), JSON.stringify({ openspecValidate: false, commands: { test: 'node test-command.mjs' } }));
  const assertions = Array.from({ length: 25 }, (_, i) => ({ fullName: `[REQ-${String(i + 1).padStart(3, '0')}] smoke`, status: 'passed' }));
  const report = { testResults: [{ name: join(consumer, 'tests/smoke.test.ts'), assertionResults: assertions }] };
  writeFileSync(join(consumer, 'test-command.mjs'), `import { mkdirSync, writeFileSync } from 'node:fs';\nmkdirSync('.loomake', { recursive: true });\nwriteFileSync('.loomake/test-report.json', JSON.stringify({ ...${JSON.stringify(report)}, startTime: Date.now() }));\n`);
  placeCiQuality(consumer);
  run('git', ['init', '-q'], consumer);
  run('git', ['config', 'user.name', 'loomake-smoke'], consumer);
  run('git', ['config', 'user.email', 'smoke@example.invalid'], consumer);
  run('git', ['add', '-A'], consumer);
  run('git', ['commit', '-qm', 'smoke fixture'], consumer);
  console.log(`配布物の準備が完了しました：${target}`);
}

/** Nodeと配布済みの5パッケージだけを使い、主要な利用経路を確認する。 */
export async function check(target) {
  const consumer = join(target, 'consumer');
  const require = createRequire(join(consumer, 'package.json'));
  for (const name of packages) {
    const base = join(consumer, 'node_modules', name === 'cli' ? 'loomake' : `@loomake/${name}`);
    const manifest = json(join(base, 'package.json'));
    assert.deepEqual(manifest.repository, { type: 'git', url: 'git+https://github.com/loomake/loomake.git', directory: `packages/${name}` }, 'repositoryの出典が一致しません');
    assert.equal(manifest.publishConfig?.provenance, true, 'provenanceの設定がありません');
  }
  for (const name of packages.filter((name) => name !== 'cli')) {
    const base = join(consumer, 'node_modules/@loomake', name);
    const manifest = json(join(base, 'package.json'));
    assert.ok(!JSON.stringify(manifest.exports).includes('@loomake/source'), '公開物にソース条件が残っています');
    const visit = (value) => {
      if (typeof value === 'string') assert.ok(existsSync(resolve(base, value)), `exportsの参照先がありません：${value}`);
      else for (const child of Object.values(value)) visit(child);
    };
    visit(manifest.exports);
  }
  const core = await import(pathToFileURL(require.resolve('@loomake/core')).href);
  assert.equal(core.parseTasks('tasks.md', '- [x] done').value[0].checked, true);
  const kit = await import(pathToFileURL(require.resolve('@loomake/kit')).href);
  assert.equal(Object.hasOwn(core, 'evaluateAgreement'), false);
  assert.equal(Object.hasOwn(core, 'evaluateTestCoverage'), false);
  assert.deepEqual(kit.evaluateAgreement(core.createAgreement('trace.md', { ledger: [], questions: [], assumptions: [] }).value), { blockingQuestions: [], pendingRequirements: [], unapprovedAssumptions: [], missingSources: [] });
  assert.deepEqual(kit.evaluateTestCoverage(['REQ-149'], {}), { coverage: { 'REQ-149': [] }, missing: ['REQ-149'] });
  // 版付きでないパスは現行の 2.0.0、1.0.0 は版付きのパスで読む（REQ-318）
  assert.equal(core.VERIFY_RESULT_SCHEMA_VERSION, '2.0.0');
  assert.deepEqual([...new Set(json(require.resolve('@loomake/core/schema/verify-result.schema.json')).anyOf.map((branch) => branch.properties.schemaVersion.const))], [core.VERIFY_RESULT_SCHEMA_VERSION]);
  assert.equal(json(require.resolve('@loomake/core/schema/versions/verify-result-1.0.0.schema.json')).properties.schemaVersion.const, core.LEGACY_VERIFY_RESULT_SCHEMA_VERSION);
  const { qualityReportSchema } = await core.loadQualityReportSchema();
  assert.equal(core.QUALITY_REPORT_SCHEMA_VERSION, 1);
  assert.deepEqual(qualityReportSchema.parse({ version: 1 }), { version: 1 });
  assert.equal(qualityReportSchema.safeParse({}).success, false);
  const qualityReportJson = json(require.resolve('@loomake/core/schema/quality-report.schema.json'));
  assert.deepEqual(qualityReportJson.required, ['version']);
  assert.equal(qualityReportJson.properties.version.const, core.QUALITY_REPORT_SCHEMA_VERSION);
  // Markdown 解析結果の契約は、配布された入口と JSON Schema から使える（REQ-299・REQ-300）。
  const parserSchemas = await core.loadParserSchemas();
  const parserContracts = [
    ['trace', core.TRACE_SCHEMA_VERSION, core.parseTrace('trace.md', core.createTraceTemplate({ changeId: 'empty' })).value, 'object'],
    ['spec', core.SPEC_SCHEMA_VERSION, core.parseSpec('spec.md', '### Requirement: empty').value, 'array'],
    ['tasks', core.TASKS_SCHEMA_VERSION, core.parseTasks('tasks.md', '- [x] done').value, 'array'],
  ];
  for (const [name, version, value, type] of parserContracts) {
    assert.equal(version, '1.0.0');
    assert.deepEqual(parserSchemas[`${name}Schema`].parse(value), value);
    const schema = json(require.resolve(`@loomake/core/schema/${name}.schema.json`));
    assert.equal(schema.type, type);
    assert.equal(Object.hasOwn(schema, 'version'), false);
  }

  // 証拠・リリースレポートの公開契約は core と従来の trace の両方から使える（REQ-303・REQ-304）。
  const traceSchemas = await core.loadTraceSchemas();
  const tracePackage = await import(pathToFileURL(require.resolve('@loomake/trace')).href);
  assert.equal(core.EVIDENCE_SCHEMA_VERSION, 2);
  assert.equal(core.LEGACY_EVIDENCE_SCHEMA_VERSION, 1);
  assert.equal(core.REPORT_SCHEMA_VERSION, 2);
  assert.equal(tracePackage.EVIDENCE_SCHEMA_VERSION, core.EVIDENCE_SCHEMA_VERSION);
  assert.equal(tracePackage.REPORT_SCHEMA_VERSION, core.REPORT_SCHEMA_VERSION);
  const legacyEvidenceContract = { schemaVersion: 1, change: 'sample', sha: '', committedAt: '', recordedAt: '', verify: { schemaVersion: '1.0.0', mode: 'done', change: 'sample', ok: true, results: [] } };
  const evidenceContract = { schemaVersion: 2, change: 'sample', sha: '', committedAt: '', recordedAt: '', verify: { schemaVersion: '2.0.0', change: 'sample', run: { status: 'completed', errors: [] }, scope: 'local', checks: [], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 0, pending: 0 }, decision: { required: false, reasons: [] } } };
  // 履歴の Evidence 1 は、別の名前のスキーマで閲覧できる。現行のスキーマは受け付けない（REQ-318）
  assert.deepEqual(traceSchemas.legacyEvidenceSchema.parse(legacyEvidenceContract), legacyEvidenceContract);
  assert.equal(traceSchemas.evidenceSchema.safeParse(legacyEvidenceContract).success, false);
  const reportContract = { schemaVersion: 2, change: 'sample', evidence: { recordedAt: '', sha: '', committedAt: '', ok: true, documents: false }, attention: { noPassingTests: [], pending: [], changedDocuments: [], failedChecks: [] }, rows: [], questions: [], assumptions: [], warnings: [] };
  for (const [name, value] of [['evidence', evidenceContract], ['report', reportContract]]) {
    assert.deepEqual(traceSchemas[`${name}Schema`].parse(value), value);
    const schema = json(require.resolve(`@loomake/core/schema/${name}.schema.json`));
    assert.equal(schema.properties.schemaVersion.type, 'number');
    assert.equal(Object.hasOwn(schema.properties, 'version'), false);
  }
  assert.equal(Object.hasOwn(traceSchemas.evidenceSchema.parse(evidenceContract), 'documents'), false);
  assert.deepEqual(traceSchemas.evidenceDocumentSchema.parse({ path: '', sha256: '', content: '' }), { path: '', sha256: '', content: '' });
  assert.equal(traceSchemas.reportRowSchema.parse({ id: '', source: '', state: '', summary: '', requirements: [], tests: [], result: null }).result, null);

  // 評価済みの品質結果を core と kit の配布入口から扱う（REQ-305・REQ-306）。
  const { qualityResultSchema } = await core.loadQualityResultSchema();
  for (const result of ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE']) assert.equal(qualityResultSchema.parse(result), result);
  assert.equal(qualityResultSchema.safeParse('unknown').success, false);
  assert.equal(kit.aggregateCiVerdict(['PASS', 'NOT_APPLICABLE']), 'PASS');
  assert.equal(kit.aggregateCiVerdict(['PASS', 'INSUFFICIENT_EVIDENCE']), 'INSUFFICIENT_EVIDENCE');
  assert.equal(kit.aggregateCiVerdict(['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE']), 'FAIL');
  assert.equal(kit.aggregateCiVerdict([]), 'INSUFFICIENT_EVIDENCE');
  assert.equal(kit.aggregateCiVerdict(['NOT_APPLICABLE']), 'INSUFFICIENT_EVIDENCE');

  const cli = join(consumer, 'node_modules/loomake/dist/cli.js');
  const command = (...args) => run(process.execPath, [cli, ...args], consumer);
  const installedBin = join(consumer, 'node_modules/.bin', win ? 'loomake.cmd' : 'loomake');
  assert.ok(existsSync(installedBin), 'CLIのbinがインストールされていません');
  run(installedBin, ['--version'], consumer);
  command('--help');
  assert.equal(command('--version').trim(), json(join(consumer, 'node_modules/loomake/package.json')).version);
  run(process.execPath, [cli], consumer, 2);
  const initRoot = mkdtempSync(join(target, 'init-'));
  run(process.execPath, [cli, 'init', '--codex', '--devcontainer'], initRoot);
  for (const file of ['AGENTS.md', '.agents/skills/req-to-openspec/SKILL.md', '.devcontainer/devcontainer.json']) assert.ok(existsSync(join(initRoot, file)), file);
  const initAgents = readFileSync(join(initRoot, 'AGENTS.md'), 'utf8');
  assert.ok(initAgents.includes('--done --scope local` が exit 0（ローカルの完了）'));
  assert.ok(initAgents.includes('--done --scope ci` が exit 0（判定 PASS・要判断なし）'));
  assert.ok(initAgents.includes('必須チェックが成功している'));
  for (const base of ['.claude', '.agents']) {
    const format = readFileSync(join(initRoot, base, 'skills/req-to-openspec/references/openspec-format.md'), 'utf8');
    const match = /## tasks\.md\s+```markdown\n([\s\S]*?)\n```/.exec(format.replace(/\r\n/g, '\n'));
    assert.ok(match, `${base}: tasks.md の雛形がありません`);
    const lines = match[1].split('\n');
    assert.deepEqual(lines.filter((line) => line.includes('<!-- loomake:gate=done -->')), ['- [ ] 3.1 `npx loomake verify --change <change-id> --done --scope local` を通す <!-- loomake:gate=done -->']);
    assert.deepEqual(lines.filter((line) => /^- \[/.test(line) && line.includes('--scope ci')), []);
    assert.equal(lines.filter((line) => line.trim()).at(-1), '注：3.1 はローカルの完了。最終の合格には、CI で `npx loomake verify --change <change-id> --done --scope ci` が exit 0（判定 PASS・要判断なし）になることと、必須 CI の成功が別に要る。これはタスクにしない');
  }
  command('doctor');
  command('verify', '--change', 'sample', '--spec-only');
  const verified = JSON.parse(command('verify', '--change', 'sample', '--done', '--json'));
  assert.deepEqual([verified.schemaVersion, verified.scope, verified.run.status, verified.decision.required, verified.verdict], ['2.0.0', 'ci', 'completed', false, 'PASS']);
  assert.equal(Object.keys(verified.coverage).length, 25);
  command('trace', 'record', '--change', 'sample');
  const report = JSON.parse(command('trace', 'report', '--change', 'sample', '--format', 'json'));
  assert.equal(report.rows.length, 25);
  assert.ok(report.rows.every((row) => row.result === '合格'));
  console.log(`配布物の検証に合格しました：${process.version} ${process.platform}`);
}

if (isMain(import.meta.url)) {
  const [mode, target, ...options] = process.argv.slice(2);
  try {
    assert.ok(target && ['prepare', 'check'].includes(mode), 'prepareかcheckと、新規の検証先ディレクトリを指定してください');
    assert.ok(options.length === 0 || (mode === 'prepare' && options.length === 1 && options[0] === '--skip-build'), '追加オプションは prepare の検証先の後ろに --skip-build を 1 回だけ指定してください');
    markPhase('package-smoke', `${mode}-start`);
    if (mode === 'prepare') prepare(resolve(target), { skipBuild: options[0] === '--skip-build' });
    else await check(resolve(target));
    markPhase('package-smoke', `${mode}-end`);
  } catch (error) {
    console.error(`配布物の検証に失敗しました：${error.message}`);
    process.exitCode = 1;
  }
}
