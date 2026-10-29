import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const packages = join(import.meta.dirname, '..', '..');
const entry = (name: string) => join(packages, name === 'loomake' ? 'cli' : name.replace('@loomake/', ''), 'src', 'index.ts');

/**
 * file から静的な import・export … from（型だけのものを除く）をたどり、読み込まれる外部のパッケージを返す。
 * 動的な import() は、使うときまで読まないのでたどらない
 */
function staticPackages(file: string, seen = new Set<string>(), found = new Set<string>()): Set<string> {
  if (seen.has(file)) return found;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
    const spec = m[1];
    if (spec.startsWith('.')) {
      const ts = resolve(dirname(file), spec.replace(/\.js$/, '.ts'));
      if (existsSync(ts)) staticPackages(ts, seen, found);
    } else if (spec.startsWith('@loomake/')) {
      staticPackages(entry(spec), seen, found);
    } else if (!spec.startsWith('node:')) {
      found.add(spec.split('/')[0]);
    }
  }
  return found;
}

describe('CLI の起動で zod を読まない', () => {
  it('[REQ-050][REQ-284][REQ-303] CLI の入口から静的にたどれる範囲で zod を読まない', () => {
    expect([...staticPackages(join(packages, 'cli', 'src', 'cli.ts'))]).not.toContain('zod');
    expect([...staticPackages(entry('@loomake/core'))]).not.toContain('zod');
    expect([...staticPackages(entry('@loomake/trace'))]).not.toContain('zod');
  });

  it('[REQ-050][REQ-284][REQ-303] zod を読むファイルは、この検査で見つかる', () => {
    expect([...staticPackages(join(packages, 'core', 'src', 'json-schema.ts'))]).toContain('zod');
    expect([...staticPackages(join(packages, 'core', 'src', 'verify-result-schema.ts'))]).toContain('zod');
    expect([...staticPackages(join(packages, 'core', 'src', 'parser-schemas.ts'))]).toContain('zod');
    expect([...staticPackages(join(packages, 'core', 'src', 'quality-schema.ts'))]).toContain('zod');
    expect([...staticPackages(join(packages, 'core', 'src', 'trace-schemas.ts'))]).toContain('zod');
  });
});
