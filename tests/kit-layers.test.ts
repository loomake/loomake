import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const src = join(import.meta.dirname, '..', 'packages', 'kit', 'src');
const filesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [])) : [];

/**
 * ファイルが import するもの。TypeScript の構文解析で、引用符の種類・副作用の import・export from・動的な import をすべて拾う。
 * 相対パスは src からのパス（拡張子は .ts）にする
 */
export function importsOf(file: string, text: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) =>
    fileName.startsWith('.') ? relative(src, resolve(dirname(file), fileName)).split('\\').join('/').replace(/\.js$/, '.ts') : fileName,
  );
}

// REQ-207 の決まりに反する import。layer は runtime か機能のディレクトリ名。
// 外部のパッケージは @loomake/core と yaml だけを認める（REQ-047）。@loomake/kit（自分の公開の入口）を経由すると、別の機能への依存を隠せるため
export function forbiddenImports(file: string, text: string): string[] {
  const layer = relative(src, file).split(/[\\/]/)[0];
  return importsOf(file, text).filter((spec) => {
    if (spec.startsWith('node:') || spec === '@loomake/core' || spec === 'yaml') return false;
    if (layer === 'runtime') return !spec.startsWith('runtime/');
    return !(spec.startsWith(`${layer}/`) || spec.startsWith('runtime/') || spec === 'verify/config.ts');
  });
}

const read = (file: string) => readFileSync(file, 'utf8');

describe('kit の中の依存の向き', () => {
  it('[REQ-207] 実行の基盤は runtime/ にあり、node:・@loomake/core・runtime/ だけを import する', () => {
    const runtime = filesIn(join(src, 'runtime'));
    expect(runtime.map((f) => relative(src, f).split('\\').join('/')).sort()).toEqual(['runtime/change-files.ts', 'runtime/errors.ts', 'runtime/input.ts', 'runtime/process.ts']);
    for (const file of runtime) expect(forbiddenImports(file, read(file)), relative(src, file)).toEqual([]);
  });

  it.each(['verify', 'init', 'doctor'])('[REQ-207] %s/ は、自分のディレクトリ・runtime/・verify/config.ts だけを import する', (feature) => {
    const files = filesIn(join(src, feature));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(forbiddenImports(file, read(file)), relative(src, file)).toEqual([]);
  });

  it.each([
    ['二重引用符', 'import { runVerify } from "../verify/run.js";'],
    ['副作用の import', "import '../verify/run.js';"],
    ['export from', "export { runVerify } from '../verify/run.js';"],
    ['動的な import', "const m = await import('../verify/run.js');"],
    ['型だけの import', "import type { VerifyOptions } from '../verify/run.js';"],
  ])('[REQ-207] runtime/ から機能への %s を見つける', (_name, line) => {
    expect(forbiddenImports(join(src, 'runtime', 'process.ts'), `${line}\n`)).toEqual(['verify/run.ts']);
  });

  it.each([
    ['runtime', "import { runVerify } from '@loomake/kit';"],
    ['init', "import { runVerify } from '@loomake/kit';"],
    ['doctor', 'export { runInit } from "@loomake/kit";'],
    ['verify', "import { runRecord } from '@loomake/trace';"],
  ])('[REQ-207] %s/ から公開の入口やほかのパッケージを経由する依存を見つける', (layer, line) => {
    expect(forbiddenImports(join(src, layer, 'x.ts'), `${line}\n`)).toHaveLength(1);
  });

  it('[REQ-207] 機能から別の機能への import を見つけ、設定の読み込みは認める', () => {
    const file = join(src, 'init', 'init.ts');
    expect(forbiddenImports(file, 'import { runDoctor } from "../doctor/doctor.js";\nimport { loadConfig } from "../verify/config.js";\n')).toEqual(['doctor/doctor.ts']);
  });
});
