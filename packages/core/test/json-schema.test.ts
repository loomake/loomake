import { describe, it, expect } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderJsonSchemas } from '../src/json-schema.js';

const pkgDir = join(import.meta.dirname, '..');
const schemaDir = join(pkgDir, 'schema');

describe('JSON Schema の書き出し', () => {
  it('[REQ-276][REQ-287] Zod スキーマから書き出した内容と packages/core/schema/ のファイルが一致する', () => {
    const rendered = renderJsonSchemas();
    expect(Object.keys(rendered).sort()).toEqual(readdirSync(schemaDir).filter((f) => f.endsWith('.json')).sort());
    for (const [file, text] of Object.entries(rendered)) {
      // Windows の checkout では改行が CRLF になりうるので、改行をそろえて比べる
      expect(readFileSync(join(schemaDir, file), 'utf8').replace(/\r\n/g, '\n'), `schema/${file} が Zod スキーマと違います。pnpm --filter @loomake/core schema:write で書き出してください`).toBe(text);
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
    expect(schema.properties.objectives.additionalProperties.properties.evidence.default).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    for (const exports of [pkg.exports, pkg.publishConfig.exports]) {
      expect(exports['./schema/quality.schema.json']).toBe('./schema/quality.schema.json');
    }
  });

  it('[REQ-276][REQ-287] 書き出しのコマンドで schema/ のファイルを作り直せる', () => {
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
