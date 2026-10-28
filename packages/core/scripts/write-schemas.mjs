// Zod スキーマから packages/core/schema/ の JSON Schema を書き出す（REQ-275）。
// `pnpm --filter @loomake/core schema:write` で、ビルドしてから実行する
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJsonSchemas } from '../dist/json-schema.js';

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
for (const [file, text] of Object.entries(renderJsonSchemas())) {
  writeFileSync(join(schemaDir, file), text);
  console.log(`書き出しました：schema/${file}`);
}
