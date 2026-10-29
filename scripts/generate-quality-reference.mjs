#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderQualityReference } from './quality-reference.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const regenerate = 'node scripts/generate-quality-reference.mjs';

/** 開発用の生成とcheck。一時領域でも同じI/O経路を検査できるようパスと表示先を受け取る。 */
export function runQualityReference({
  schemaPath = join(root, 'packages/core/schema/quality.schema.json'),
  outputPath = join(root, 'docs/guide/3.reference/4.quality-yaml.md'),
  check = false,
  stdout = (text) => console.log(text),
  stderr = (text) => console.error(text),
} = {}) {
  try {
    const rendered = renderQualityReference(JSON.parse(readFileSync(schemaPath, 'utf8')));
    if (check) {
      const current = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
      if (current !== rendered) {
        stderr(`${outputPath} がスキーマからの生成内容と違います。${regenerate} で再生成してください。`);
        return 1;
      }
      stdout(`リファレンスは一致しています：${outputPath}`);
    } else {
      writeFileSync(outputPath, rendered, 'utf8');
      stdout(`書き出しました：${outputPath}`);
    }
    return 0;
  } catch (error) {
    stderr(`${outputPath} の生成・照合に失敗しました（入力：${schemaPath}）：${error instanceof Error ? error.message : String(error)}。${regenerate} で再生成してください。`);
    return 1;
  }
}

export function runQualityReferenceCommand(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    console.error(`使い方: ${regenerate} [--check]`);
    return 2;
  }
  return runQualityReference({ check: args.length === 1 });
}

let directlyInvoked = false;
if (process.argv[1]) {
  try {
    directlyInvoked = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    // import元の起動パスを解決できない場合は、生成・照合を開始しない。
  }
}

if (directlyInvoked) {
  process.exitCode = runQualityReferenceCommand(process.argv.slice(2));
}
