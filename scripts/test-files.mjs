// verify.mjs と vitest.config.ts が共有する、loomake.config.json の読み込みとテストファイルの選び方。
// verify が要件のテストとして数えるファイルと、Vitest が実行するファイルを、同じ規則で選ぶ
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 呼ぶたびに新しいオブジェクトを返し、呼び出し側が変えても既定値に残らないようにする
const defaults = () => ({
  openspecDir: 'openspec',
  openspecValidate: 'auto',
  tests: { dirs: ['tests', 'test', 'src'], pattern: '\\.(test|spec)\\.(ts|tsx|js|mjs|cjs|vue)$' },
  commands: {},
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// loomake.config.json を読み、既定値と合わせて返す。形が正しくないときは Error を投げる
/** @param {string} root */
export function loadConfig(root) {
  const p = join(root, 'loomake.config.json');
  const base = defaults();
  if (!existsSync(p)) return base;
  let c;
  try {
    c = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`loomake.config.json を読めません（${e.message}）`, { cause: e });
  }
  if (!isObject(c)) throw new Error('loomake.config.json は JSON のオブジェクトにしてください');
  if (c.openspecDir !== undefined && typeof c.openspecDir !== 'string') throw new Error('loomake.config.json の openspecDir は文字列にしてください');
  if (c.openspecValidate !== undefined && ![true, false, 'auto'].includes(c.openspecValidate)) {
    throw new Error('loomake.config.json の openspecValidate は true・false・"auto" のどれかにしてください');
  }
  if (c.tests !== undefined && !isObject(c.tests)) throw new Error('loomake.config.json の tests はオブジェクトにしてください');
  const tests = { ...base.tests, ...(c.tests ?? {}) };
  if (!Array.isArray(tests.dirs) || !tests.dirs.every((d) => typeof d === 'string')) {
    throw new Error('loomake.config.json の tests.dirs は文字列の配列にしてください');
  }
  if (typeof tests.pattern !== 'string') throw new Error('loomake.config.json の tests.pattern は文字列にしてください');
  try {
    new RegExp(tests.pattern);
  } catch (e) {
    throw new Error(`loomake.config.json の tests.pattern が正規表現として読めません（${e.message}）`, { cause: e });
  }
  if (c.commands !== undefined && (!isObject(c.commands) || !Object.values(c.commands).every((v) => typeof v === 'string' || v === null))) {
    throw new Error('loomake.config.json の commands は、値が文字列（または null）のオブジェクトにしてください');
  }
  return { ...base, ...c, tests };
}

// node_modules・ドットで始まるディレクトリと、skip に挙げた名前のディレクトリは見ない
/** @param {string} dir @param {string[]} [skip] @param {string[]} [out] @returns {string[]} */
export function walk(dir, skip = [], out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!skip.includes(name)) walk(p, skip, out);
    } else out.push(p);
  }
  return out;
}

// tests.dirs の下で tests.pattern に一致するファイルを、絶対パスで返す。ビルドの出力（dist）は見ない
/** @param {string} root @param {{ dirs: string[], pattern: string }} tests @returns {string[]} */
export function listTestFiles(root, tests) {
  const re = new RegExp(tests.pattern);
  return tests.dirs.flatMap((d) => walk(join(root, d), ['dist'])).filter((f) => re.test(f));
}
