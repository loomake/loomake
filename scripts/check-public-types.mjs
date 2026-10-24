// 配布したd.tsだけを使い、利用側のTypeScriptをコンパイルする。開発用Nodeで実行する。
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [targetArg, outputArg] = process.argv.slice(2);
assert.ok(targetArg && outputArg, '準備した配布物と、新しい結果の保存先を指定してください');
const consumer = join(resolve(targetArg), 'consumer'); const output = resolve(outputArg);
assert.equal(JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8')).name, 'loomake-smoke-consumer');
mkdirSync(output);
const scratch = mkdtempSync(join(consumer, '.public-types-'));
try {
  writeFileSync(join(scratch, 'consumer.ts'), readFileSync(join(root, 'tests/fixtures/public-api/consumer.ts')));
  writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false, types: ['node'], typeRoots: [join(root, 'node_modules/@types')], customConditions: [] }, files: ['consumer.ts'] }));
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(scratch, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  writeFileSync(join(output, 'stdout.txt'), result.stdout ?? ''); writeFileSync(join(output, 'stderr.txt'), result.stderr ?? '');
  writeFileSync(join(output, 'results.json'), JSON.stringify({ ok: result.status === 0 && !result.error, exitCode: result.status, compiler: JSON.parse(readFileSync(join(root, 'node_modules/typescript/package.json'), 'utf8')).version, nodeTypes: JSON.parse(readFileSync(join(root, 'node_modules/@types/node/package.json'), 'utf8')).version, scope: 'selected-public-api-types', sourceConditions: false }, null, 2) + '\n');
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error || result.status !== 0) process.exitCode = 1;
  else console.log('配布物の公開型を使う利用側のコンパイルに合格しました');
} finally { rmSync(scratch, { recursive: true, force: true }); }
