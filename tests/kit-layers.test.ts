import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const src = join(import.meta.dirname, '..', 'packages', 'kit', 'src');
const filesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [])) : [];

// ファイルが import するもの。相対パスは src からのパス（拡張子は .ts）にする
const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)[^'"]*from\s+'([^']+)'/gm)].map(([, spec]) =>
    spec.startsWith('.') ? relative(src, resolve(dirname(file), spec)).split('\\').join('/').replace(/\.js$/, '.ts') : spec,
  );

describe('kit の中の依存の向き', () => {
  it('[REQ-207] 実行の基盤は runtime/ にあり、node:・@loomake/core・runtime/ だけを import する', () => {
    const runtime = filesIn(join(src, 'runtime'));
    expect(runtime.map((f) => relative(src, f).split('\\').join('/')).sort()).toEqual(['runtime/change-files.ts', 'runtime/errors.ts', 'runtime/input.ts', 'runtime/process.ts']);
    for (const file of runtime) {
      for (const spec of importsOf(file)) expect(spec.startsWith('node:') || spec === '@loomake/core' || spec.startsWith('runtime/'), `${relative(src, file)} → ${spec}`).toBe(true);
    }
  });

  it.each(['verify', 'init', 'doctor'])('[REQ-207] %s/ は、自分のディレクトリ・runtime/・verify/config.ts だけを import する', (feature) => {
    for (const file of filesIn(join(src, feature))) {
      for (const spec of importsOf(file)) {
        if (spec.startsWith('node:') || spec.startsWith('@loomake/')) continue;
        expect(spec.startsWith(`${feature}/`) || spec.startsWith('runtime/') || spec === 'verify/config.ts', `${relative(src, file)} → ${spec}`).toBe(true);
      }
    }
  });
});
