import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describeQualitySchema, renderQualityReference } from '../scripts/quality-reference.mjs';
import { runQualityReference } from '../scripts/generate-quality-reference.mjs';
import { loadQualitySchema } from '../packages/core/src/index.js';

const root = join(import.meta.dirname, '..');
const schema = JSON.parse(readFileSync(join(root, 'packages/core/schema/quality.schema.json'), 'utf8'));

const fixture = {
  type: 'object', required: ['version'], additionalProperties: {},
  properties: {
    version: { type: 'integer', const: 2 },
    policy: { type: 'object', default: {}, properties: { days: { type: 'integer', default: 90, minimum: 1 } } },
    entries: {
      type: 'object', propertyNames: { type: 'string', pattern: '^X-[0-9]+$' }, additionalProperties: {
        oneOf: [
          { type: 'object', required: ['mode'], properties: { mode: { type: 'string', const: 'used' }, notes: { type: 'array', default: [], items: { type: 'string', minLength: 1 } } } },
          { type: 'object', required: ['mode', 'reason'], properties: { mode: { type: 'string', const: 'unused' }, reason: { type: 'string', minLength: 1 } } },
        ],
      },
    },
  },
};

describe('quality.yamlの生成リファレンス', () => {
  it('[REQ-320] record・配列・親子のdefaultと分岐ごとの必須を失わない', () => {
    const rows = describeQualitySchema(fixture);
    const byPath = (path: string) => rows.filter((row) => row.path === path);
    expect(byPath('policy')[0]).toMatchObject({ presence: '省略可', default: '{}' });
    expect(byPath('policy.days')[0]).toMatchObject({ default: '90', constraints: 'minimum: 1' });
    expect(byPath('entries')[0].constraints).toContain('キー: type: string, pattern: "^X-[0-9]+$"');
    expect(byPath('entries.<id>.notes')[0]).toMatchObject({ presence: '省略可', default: '[]' });
    expect(byPath('entries.<id>.notes[]')[0]).toMatchObject({ type: 'string', presence: '配列要素', constraints: 'minLength: 1' });
    expect(byPath('entries.<id>.reason')[0]).toMatchObject({ branch: '分岐2: mode = "unused"', presence: '必須' });
    expect(byPath('version')[0]).toMatchObject({ type: 'integer', presence: '必須', constraints: 'const: 2' });
  });

  it('[REQ-320] 実スキーマのNAだけで理由・確認者を必須にし、全グループと制約を出す', () => {
    const rows = describeQualitySchema(schema);
    for (const group of ['objectives', 'product']) {
      for (const field of ['reason', 'confirmed_by']) {
        const matched = rows.filter((row) => row.path === `${group}.<id>.${field}`);
        expect(matched).toHaveLength(2);
        expect(matched.find((row) => row.branch.includes('"applicable"'))?.presence).toBe('省略可');
        expect(matched.find((row) => row.branch.includes('"not_applicable"'))?.presence).toBe('必須');
      }
      expect(rows.find((row) => row.path === `${group}.<id>.characteristic` && row.branch.includes('"applicable"'))?.presence).toBe('必須');
      expect(rows.find((row) => row.path === `${group}.<id>.applicability` && row.branch.includes('"applicable"'))?.branch).toContain('applicabilityを省略');
    }
    const constraints = (path: string) => rows.find((row) => row.path === path)?.constraints;
    expect(constraints('objectives')).toContain('^UQ-[0-9]{3,}$');
    expect(constraints('product')).toContain('^PQ-[0-9]{3,}$');
    expect(constraints('defaults.window')).toContain('^[1-9][0-9]*[dwy]$');
    expect(constraints('product.<id>.evidence[].target')).toContain('(<=|>=|==|<|>)');
    expect(constraints('automation.max_diff_lines')).toContain('minimum: 0');
    expect(constraints('defaults.min_samples')).toContain('exclusiveMinimum: 0');
    expect(constraints('report.status')).toBe('enum: "weekly", "daily"');
    expect(constraints('evidence.access')).toBe('enum: "project-members", "owner"');
  });

  it('[REQ-320] 入力default注記と親省略後の補完値を既存スキーマと照合する', async () => {
    const { qualitySchema } = await loadQualitySchema();
    const parsed = qualitySchema.parse({ version: 2, model: 'model' });
    const rows = describeQualitySchema(schema);
    expect(rows.find((row) => row.path === 'evidence')?.default).toBe('{}');
    expect(rows.find((row) => row.path === 'defaults.window')?.default).toBe('注記なし');
    expect(parsed).not.toHaveProperty('defaults');
    expect(parsed.objectives).toEqual({});
    expect(parsed.product).toEqual({});
    expect(parsed.evidence).toEqual({ artifact_retention: '90d', long_term_store: 'github-release', long_term_retention: '5y', access: 'project-members', delete_policy: 'owner-approval' });
    for (const [key, value] of Object.entries(parsed.evidence)) {
      expect(rows.find((row) => row.path === `evidence.${key}`)?.default).toBe(JSON.stringify(value));
    }
    const objective = qualitySchema.parse({ version: 2, model: 'model', objectives: { 'UQ-001': { characteristic: 'quality' } } }).objectives['UQ-001'];
    expect(objective.evidence).toEqual([]);
    expect(objective.indicators).toEqual([]);
    expect(rows.find((row) => row.path === 'objectives.<id>.evidence')?.default).toBe('[]');
    const page = renderQualityReference(schema);
    expect(page).toContain('親を省略すると、子の');
    expect(page).toContain('説明未記載');
  });

  it('[REQ-320][REQ-322] スキーマにない意味を追加せず特殊文字を表の文字として表示する', () => {
    const source = { type: 'string', description: '<script>|`code`\n[link](javascript:run)&', enum: ['a|b', '<img src=x>', '`quoted`'] };
    const before = JSON.stringify(source);
    const page = renderQualityReference({ type: 'object', properties: { 'key|name': source } });
    expect(page).toContain('&#60;script&#62;&#124;&#96;code&#96;&#92;n&#91;link&#93;&#40;javascript&#58;run&#41;&#38;');
    expect(page).toContain('key&#124;name');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('<img src=x>');
    expect(page).not.toContain('[link](javascript:run)');
    expect(JSON.stringify(source)).toBe(before);
    const actual = describeQualitySchema(schema).filter((row) => /\.(metric|source)$/.test(row.path));
    expect(actual.length).toBeGreaterThan(0);
    for (const row of actual) expect(row.constraints).toBe('minLength: 1');
  });

  it('[REQ-320] 未対応の構造を黙って省かない', () => {
    expect(() => renderQualityReference({ allOf: [{ type: 'string' }] })).toThrow('未対応のスキーマ項目');
    expect(() => renderQualityReference({ type: 'array', items: false })).toThrow('未対応のスキーマ構造');
    expect(() => renderQualityReference({ type: 'object', propertyNames: { oneOf: [{ type: 'string' }] } })).toThrow('未対応のキー制約');
    expect(() => renderQualityReference({ type: 'object', properties: { nested: { $ref: '#/$defs/x' } } })).toThrow('$ref');
  });
});


const workspaces: string[] = [];
afterEach(() => { for (const directory of workspaces.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function referenceWorkspace() {
  const directory = mkdtempSync(join(tmpdir(), 'loomake-quality-reference-'));
  workspaces.push(directory);
  const schemaPath = join(directory, 'quality.schema.json');
  const outputPath = join(directory, 'quality.md');
  writeFileSync(schemaPath, JSON.stringify(fixture));
  const messages: string[] = [];
  const options = { schemaPath, outputPath, stdout: (text: string) => messages.push(text), stderr: (text: string) => messages.push(text) };
  return { directory, options, messages };
}

describe('qualityリファレンスの生成/check', () => {
  it('[REQ-321][REQ-322] 生成は対象だけを書き、繰り返して同一内容になる', () => {
    const { directory, options } = referenceWorkspace();
    const other = join(directory, 'other.md');
    writeFileSync(other, '既存の文書');
    const originalSchema = readFileSync(options.schemaPath, 'utf8');
    expect(runQualityReference(options)).toBe(0);
    const first = readFileSync(options.outputPath, 'utf8');
    expect(first).toBe(renderQualityReference(fixture));
    expect(first.endsWith('\n')).toBe(true);
    expect(first.endsWith('\n\n')).toBe(false);
    expect(runQualityReference(options)).toBe(0);
    expect(readFileSync(options.outputPath, 'utf8')).toBe(first);
    expect(readFileSync(other, 'utf8')).toBe('既存の文書');
    expect(readFileSync(options.schemaPath, 'utf8')).toBe(originalSchema);
    const reordered = { ...fixture, properties: Object.fromEntries(Object.entries(fixture.properties).reverse()) };
    expect(renderQualityReference(reordered)).toBe(first);
  });

  it('[REQ-321] checkは一致とCRLFだけを許容し、内容や空白の改変を直さない', () => {
    const { options, messages } = referenceWorkspace();
    expect(runQualityReference(options)).toBe(0);
    const original = readFileSync(options.outputPath, 'utf8');
    const check = { ...options, check: true };
    expect(runQualityReference(check)).toBe(0);
    const crlf = original.replace(/\n/g, '\r\n');
    writeFileSync(options.outputPath, crlf);
    expect(runQualityReference(check)).toBe(0);
    expect(readFileSync(options.outputPath, 'utf8')).toBe(crlf);
    for (const modified of [original.replace('90', '91'), original.replace('unused', 'unreviewed'), original + ' ']) {
      writeFileSync(options.outputPath, modified);
      expect(runQualityReference(check)).toBe(1);
      expect(readFileSync(options.outputPath, 'utf8')).toBe(modified);
      expect(messages.at(-1)).toContain(options.outputPath);
      expect(messages.at(-1)).toContain('node scripts/generate-quality-reference.mjs');
    }
  });

  it('[REQ-321] 欠落・不正JSON・未対応構造・読取失敗でもcheckは書き込まない', () => {
    const { options, messages } = referenceWorkspace();
    const check = { ...options, check: true };
    expect(runQualityReference(check)).toBe(1);
    expect(existsSync(options.outputPath)).toBe(false);
    expect(messages.at(-1)).toContain(options.outputPath);
    expect(messages.at(-1)).toContain('再生成');
    writeFileSync(options.outputPath, '残す文書');
    for (const raw of ['invalid json', JSON.stringify({ allOf: [] })]) {
      writeFileSync(options.schemaPath, raw);
      expect(runQualityReference(check)).toBe(1);
      expect(readFileSync(options.outputPath, 'utf8')).toBe('残す文書');
    }
    rmSync(options.schemaPath);
    expect(runQualityReference(check)).toBe(1);
    expect(readFileSync(options.outputPath, 'utf8')).toBe('残す文書');
    mkdirSync(options.schemaPath);
    expect(runQualityReference(check)).toBe(1);
    expect(readFileSync(options.outputPath, 'utf8')).toBe('残す文書');
  });

  it('[REQ-321] スキーマ変更後に保存済みページが古いとcheckが失敗する', () => {
    const { options } = referenceWorkspace();
    expect(runQualityReference(options)).toBe(0);
    const original = readFileSync(options.outputPath, 'utf8');
    const changed = structuredClone(fixture);
    changed.properties.policy.properties.days.default = 100;
    writeFileSync(options.schemaPath, JSON.stringify(changed));
    expect(runQualityReference({ ...options, check: true })).toBe(1);
    expect(readFileSync(options.outputPath, 'utf8')).toBe(original);
  });

  it('[REQ-321] 実行スクリプトはcwdに依存せず、欠落checkと不明引数で生成しない', () => {
    const { directory } = referenceWorkspace();
    for (const path of ['scripts', 'packages/core/schema', 'docs/guide/3.reference']) mkdirSync(join(directory, path), { recursive: true });
    for (const file of ['quality-reference.mjs', 'generate-quality-reference.mjs']) copyFileSync(join(root, 'scripts', file), join(directory, 'scripts', file));
    copyFileSync(join(root, 'packages/core/schema/quality.schema.json'), join(directory, 'packages/core/schema/quality.schema.json'));
    const target = join(directory, 'docs/guide/3.reference/4.quality-yaml.md');
    const run = (...args: string[]) => spawnSync(process.execPath, [join(directory, 'scripts/generate-quality-reference.mjs'), ...args], { cwd: tmpdir(), encoding: 'utf8' });
    expect(run('--check').status).toBe(1);
    expect(existsSync(target)).toBe(false);
    const invalid = run('--unknown');
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('使い方');
    expect(existsSync(target)).toBe(false);
    const generated = run();
    expect(generated.status, generated.stderr).toBe(0);
    expect(readFileSync(target, 'utf8')).toBe(renderQualityReference(schema));
    const checked = run('--check');
    expect(checked.status, checked.stderr).toBe(0);
  });
});


describe('実ページと文書導線', () => {
  const generatedPath = join(root, 'docs/guide/3.reference/4.quality-yaml.md');
  const readPage = () => readFileSync(generatedPath, 'utf8').replace(/\r\n/g, '\n');
  const table = (text: string) => text.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| パス |') && !line.startsWith('| --- |'))
    .map((line) => line.slice(2, -2).split(' | ').map((value) => value.replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))));

  it('[REQ-320][REQ-322] 保存済みページは全階層の全パスとNA条件を含む', () => {
    const fixed = ['$', 'version', 'model', 'defaults', 'defaults.window', 'defaults.min_samples', 'report', 'report.status', 'report.publish',
      'evidence', ...['artifact_retention', 'long_term_store', 'long_term_retention', 'access', 'delete_policy'].map((key) => `evidence.${key}`),
      'automation', ...['level', 'max_diff_lines', 'require_rollback', 'allowed_paths', 'allowed_paths[]', 'protected_paths', 'protected_paths[]'].map((key) => `automation.${key}`)];
    const expected = new Set(fixed);
    for (const [group, ownFields] of [['objectives', ['context', 'task', 'guardrails', 'guardrails[]']], ['product', ['subcharacteristic', 'objectives', 'objectives[]']]] as const) {
      expected.add(group);
      expected.add(`${group}.<id>`);
      for (const name of ['applicability', 'blocking', 'characteristic', 'confirmed_by', 'reason', 'linked_requirements', 'linked_requirements[]', ...ownFields]) expected.add(`${group}.<id>.${name}`);
      for (const name of ['evidence', 'indicators']) {
        expected.add(`${group}.<id>.${name}`);
        expected.add(`${group}.<id>.${name}[]`);
        for (const field of ['metric', 'source', 'target', 'min_samples']) expected.add(`${group}.<id>.${name}[].${field}`);
      }
    }
    const rows = table(readPage());
    expect([...new Set(rows.map((row) => row[0]))].sort()).toEqual([...expected].sort());
    for (const group of ['objectives', 'product']) {
      const reason = rows.filter((row) => row[0] === `${group}.<id>.reason`);
      expect(reason.find((row) => row[1].includes('"not_applicable"'))?.[3]).toBe('必須');
      expect(reason.find((row) => row[1].includes('"applicable"'))?.[3]).toBe('省略可');
    }
    expect(rows.find((row) => row[0] === 'evidence')?.[4]).toBe('{}');
    expect(rows.find((row) => row[0] === 'evidence.artifact_retention')?.[4]).toBe('"90d"');
    expect(readPage()).not.toContain('scope: local');
    expect(readPage()).not.toContain('schemaVersion: 2.0.0');
  });

  it('[REQ-321] 実スキーマからの再生成内容が保存済みページと一致する', () => {
    expect(readPage(), 'node scripts/generate-quality-reference.mjs で再生成してください').toBe(renderQualityReference(schema));
    expect(runQualityReference({ check: true, stdout: () => {}, stderr: () => {} })).toBe(0);
  });

  it('[REQ-322] title/description・生成元と再生成方法を持ち、既存3ページとともに入口から辿れる', () => {
    const page = readPage();
    expect(page).toMatch(/^---\ntitle: .+\ndescription: .+\n---\n/);
    expect(page).toContain('../../../packages/core/schema/quality.schema.json');
    expect(page).toContain('node scripts/generate-quality-reference.mjs');
    expect(page).toContain('説明中の改行は `\\n` と表記します。');
    const index = readFileSync(join(root, 'docs/guide/index.md'), 'utf8');
    for (const file of ['1.compatibility.md', '2.resources.md', '3.security.md', '4.quality-yaml.md']) {
      expect(index).toContain(`](3.reference/${file})`);
      expect(existsSync(join(root, 'docs/guide/3.reference', file))).toBe(true);
    }
  });
});
