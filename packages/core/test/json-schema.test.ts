import { describe, it, expect } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { qualitySchema } from '../src/quality-schema.js';
import { evidenceSchema, reportSchema } from '../src/trace-schemas.js';
import { evidenceValue, reportValue } from './fixtures/trace-contract-values.js';
import { createTraceTemplate, parseTrace, parseSpec, parseTasks } from '../src/index.js';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderJsonSchemas } from '../src/json-schema.js';

const pkgDir = join(import.meta.dirname, '..');
const schemaDir = join(pkgDir, 'schema');

describe('JSON Schema の書き出し', () => {
  it('[REQ-276][REQ-287][REQ-300][REQ-304] Zod スキーマから書き出した内容と packages/core/schema/ のファイルが一致する', () => {
    const rendered = renderJsonSchemas();
    expect(Object.keys(rendered).sort()).toEqual(readdirSync(schemaDir).filter((f) => f.endsWith('.json')).sort());
    for (const [file, text] of Object.entries(rendered)) {
      // Windows の checkout では改行が CRLF になりうるので、改行をそろえて比べる
      expect(readFileSync(join(schemaDir, file), 'utf8').replace(/\r\n/g, '\n'), `schema/${file} が Zod スキーマと違います。pnpm --filter @loomake/core schema:write で書き出してください`).toBe(text);
    }
  });


  it('[REQ-300] 3 形式の JSON Schema は公開 exports から読み取れ、既存の解析値を検証する', () => {
    const rendered = renderJsonSchemas();
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const traceText = readFileSync(join(pkgDir, 'test/fixtures/openspec-project/openspec/changes/add-x/trace.md'), 'utf8').replace('反映済', '対応中');
    const examples = [
      ['trace.schema.json', parseTrace('trace.md', traceText).value, { ledger: [], questions: 'bad', assumptions: [] }],
      ['spec.schema.json', parseSpec('spec.md', '### Requirement: outside\n## RENAMED Requirements\n- FROM: ### Requirement: old\n- TO: ### Requirement: new').value, [{ op: 'UNKNOWN', name: 'x', sources: [], scenarios: 0, line: 1 }]],
      ['tasks.schema.json', parseTasks('tasks.md', '- [ ] first\n- [X] second').value, [{ checked: 1, text: 'x', line: 1 }]],
    ] as const;
    for (const [file, value, invalid] of examples) {
      const schema = JSON.parse(rendered[file]);
      const validate = new Ajv2020({ strict: false }).compile(schema);
      for (const exports of [pkg.exports, pkg.publishConfig.exports]) expect(exports[`./schema/${file}`]).toBe(`./schema/${file}`);
      expect(schema.$id).toBe(`https://loomake.dev/schema/${file}`);
      expect(schema).not.toHaveProperty('version');
      expect(schema.properties ?? {}).not.toHaveProperty('version');
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(invalid)).toBe(false);
      expect(validate(file === 'trace.schema.json' ? parseTrace('trace.md', createTraceTemplate({ changeId: 'empty' })).value : [])).toBe(true);
    }
  });

  it('[REQ-304] Evidence/Report の JSON は構造・任意フィールド・未知キーを Zod と同じに公開する', () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const cases = [
      ['evidence', evidenceSchema, evidenceValue(), { ...evidenceValue(), documents: null }],
      ['report', reportSchema, reportValue(), { ...reportValue(), warnings: null }],
    ] as const;
    for (const [name, zodSchema, value, invalid] of cases) {
      const file = `${name}.schema.json`;
      const schema = JSON.parse(readFileSync(join(schemaDir, file), 'utf8'));
      const validate = new Ajv2020({ strict: false }).compile(schema);
      expect(schema.properties.schemaVersion.type).toBe('number');
      expect(schema.properties.schemaVersion).not.toHaveProperty('const');
      expect(schema.properties).not.toHaveProperty('version');
      for (const exports of [pkg.exports, pkg.publishConfig.exports]) expect(exports[`./schema/${file}`]).toBe(`./schema/${file}`);
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
      expect(zodSchema.safeParse(value).success).toBe(true);
      expect(validate(invalid)).toBe(false);
      expect(zodSchema.safeParse(invalid).success).toBe(false);
      const future = { ...value, schemaVersion: 9.5, extra: { note: 'future' } };
      expect(validate(future), JSON.stringify(validate.errors)).toBe(true);
      expect(zodSchema.parse(future)).toEqual(future);
      if (name === 'evidence') {
        expect(schema.required).not.toContain('documents');
        expect(schema.properties.documents).not.toHaveProperty('default');
      }
    }
  });

  it('[REQ-276] 書き出した verify 結果の JSON Schema が、移す前の必須プロパティと値を持つ', () => {
    const schema = JSON.parse(renderJsonSchemas()['verify-result.schema.json']);
    expect(schema.$id).toBe('https://loomake.dev/schema/verify-result.schema.json');
    expect(schema.required).toEqual(['schemaVersion', 'mode', 'change', 'ok', 'results']);
    expect(schema.properties.schemaVersion.const).toBe('1.0.0');
    expect(schema.properties.mode.enum).toEqual(['quality', 'spec-only', 'done']);
    expect(schema.properties.results.items.required).toEqual(['check', 'status', 'detail']);
    expect(schema.properties.results.items.properties.status.enum).toEqual(['pass', 'fail', 'warn', 'skip']);
    expect(schema.properties.coverage.propertyNames.pattern).toBe('^REQ-[0-9]{3,}$');
  });

  it('[REQ-287] quality.yaml の JSON Schema は入力の省略と既定値を表し、パッケージから公開する', () => {
    const schema = JSON.parse(renderJsonSchemas()['quality.schema.json']);
    expect(schema.$id).toBe('https://loomake.dev/schema/quality.schema.json');
    expect(schema.required).toEqual(['version', 'model']);
    expect(schema.properties.version.const).toBe(2);
    expect(schema.properties.evidence.properties.artifact_retention.default).toBe('90d');
    for (const branch of schema.properties.objectives.additionalProperties.oneOf) {
      expect(branch.properties.evidence.default).toEqual([]);
    }
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    for (const exports of [pkg.exports, pkg.publishConfig.exports]) {
      expect(exports['./schema/quality.schema.json']).toBe('./schema/quality.schema.json');
    }
  });

  it('[REQ-286][REQ-287] Zod と配布 JSON Schema が対象外の理由と確認者をともに必須にする', () => {
    const schema = JSON.parse(readFileSync(join(schemaDir, 'quality.schema.json'), 'utf8'));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    for (const [collection, id] of [['product', 'PQ-001'], ['objectives', 'UQ-001']]) {
      const base = { characteristic: 'custom', applicability: 'not_applicable' };
      for (const item of [base, { ...base, reason: '対象外' }, { ...base, confirmed_by: 'owner' }, { ...base, reason: '', confirmed_by: 'owner' }]) {
        const input = { version: 2, model: 'm', [collection]: { [id]: item } };
        expect(qualitySchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
        expect(validate(input), JSON.stringify(input)).toBe(false);
      }
      for (const item of [
        { ...base, reason: '対象外', confirmed_by: 'owner' },
        { characteristic: 'custom', applicability: 'applicable' },
        { characteristic: 'custom' },
      ]) {
        const input = { version: 2, model: 'm', [collection]: { [id]: item } };
        expect(qualitySchema.safeParse(input).success, JSON.stringify(input)).toBe(true);
        expect(validate(input), JSON.stringify(validate.errors)).toBe(true);
      }
    }
  });

  it('[REQ-276][REQ-287][REQ-300][REQ-304] 書き出しのコマンドで schema/ のファイルを作り直せる', () => {
    const work = mkdtempSync(join(tmpdir(), 'loomake-core-schema-'));
    try {
      // 実際の schema/ を書き換えないように、書き出しのスクリプトとビルドの結果を一時ディレクトリに写して実行する
      const build = spawnSync(process.execPath, [join(pkgDir, '..', '..', 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pkgDir, 'tsconfig.build.json'), '--outDir', join(work, 'dist')], { encoding: 'utf8' });
      expect(build.status, build.stdout + build.stderr).toBe(0);
      cpSync(join(pkgDir, 'scripts'), join(work, 'scripts'), { recursive: true });
      mkdirSync(join(work, 'node_modules'));
      symlinkSync(realpathSync(join(pkgDir, 'node_modules', 'zod')), join(work, 'node_modules', 'zod'), 'junction');
      cpSync(join(pkgDir, 'package.json'), join(work, 'package.json'));
      cpSync(schemaDir, join(work, 'schema'), { recursive: true });
      for (const file of Object.keys(renderJsonSchemas())) rmSync(join(work, 'schema', file));
      const run = spawnSync(process.execPath, [join(work, 'scripts', 'write-schemas.mjs')], { encoding: 'utf8' });
      expect(run.status, run.stdout + run.stderr).toBe(0);
      for (const [file, text] of Object.entries(renderJsonSchemas())) {
        expect(readFileSync(join(work, 'schema', file), 'utf8'), file).toBe(text);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 60000);
});
