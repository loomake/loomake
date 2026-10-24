import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
// 利用者と開発者が読む文書。日付つきの記録（docs/review.md・docs/worklog/）は、書いた時点のリンクを残すので対象にしない
const documents = [
  'README.md', 'README.en.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'CODE_OF_CONDUCT.md', 'AGENTS.md',
  ...readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md') && f !== 'review.md').map((f) => `docs/${f}`),
  ...readdirSync(join(root, 'docs/quality')).filter((f) => f.endsWith('.md')).map((f) => `docs/quality/${f}`),
];

// インラインのリンクと画像：[説明](先 "タイトル")。先は <...> で囲んでもよい。タイトルは "..."・'...'・(...) のどれか
const INLINE = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
// 参照の形のリンクの定義：[名前]: 先 "タイトル"
const DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/gm;

/** コードブロックとインラインのコードを除いた本文の、相対パスのリンクの先 */
export function relativeLinks(markdown: string): string[] {
  const text = markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
  return [...text.matchAll(INLINE), ...text.matchAll(DEFINITION)]
    .map(([, target]) => target.replace(/^<|>$/g, ''))
    .filter((url) => url !== '' && !/^([a-z][a-z0-9+.-]*:|#)/i.test(url));
}

describe('文書のリンクの取り出し', () => {
  it.each([
    ['タイトルつき', '[説明](missing.md "タイトル")'],
    ["単一引用符のタイトル", "[説明](missing.md 'タイトル')"],
    ['括弧のタイトル', '[説明](missing.md (タイトル))'],
    ['山かっこ', '[説明](<missing.md>)'],
    ['画像', '![図](missing.md)'],
    ['参照の形', '[説明][ref]\n\n[ref]: missing.md "タイトル"'],
  ])('%s のリンクの先を取り出す', (_name, markdown) => {
    expect(relativeLinks(markdown)).toEqual(['missing.md']);
  });

  it('外部の URL・ページ内のリンク・コードの中は取り出さない', () => {
    expect(relativeLinks('[a](https://example.com) [b](#節) [c](mailto:x@example.com) `[d](missing.md)`\n\n```md\n[e](missing.md)\n```\n')).toEqual([]);
  });
});

describe('文書のリンク', () => {
  it.each(documents)('%s の相対パスのリンクは、リポジトリにあるファイルを指す', (file) => {
    const links = relativeLinks(readFileSync(join(root, file), 'utf8'));
    const broken = links.filter((url) => !existsSync(resolve(root, dirname(file), decodeURI(url.split('#')[0]))));
    expect(broken).toEqual([]);
  });
});
