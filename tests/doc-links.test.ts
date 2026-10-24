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

/**
 * インラインのリンクと画像 [説明](先 "タイトル") の先を、`](` のあとから読む。
 * 先は <...> で囲むか、空白を含まず括弧の対応がとれた文字列（docs/guide(v2).md など）。\ でエスケープした文字はそのまま読む
 */
function inlineTargets(text: string): string[] {
  const targets: string[] = [];
  for (let start = text.indexOf(']('); start >= 0; start = text.indexOf('](', start + 2)) {
    let i = start + 2;
    while (text[i] === ' ' || text[i] === '\t') i++;
    if (text[i] === '<') {
      const end = text.indexOf('>', i);
      if (end > i && !text.slice(i, end).includes('\n')) targets.push(text.slice(i + 1, end));
      continue;
    }
    let depth = 0;
    let target = '';
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '\\' && i + 1 < text.length) target += text[++i];
      else if (c === '(') { depth++; target += c; }
      else if (c === ')') { if (depth === 0) break; depth--; target += c; }
      else if (/\s/.test(c)) break;
      else target += c;
    }
    targets.push(target);
  }
  return targets;
}

// 参照の形のリンクの定義：[名前]: 先 "タイトル"
const DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/gm;

/** コードブロックとインラインのコードを除いた本文の、相対パスのリンクの先 */
export function relativeLinks(markdown: string): string[] {
  const text = markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
  return [...inlineTargets(text), ...[...text.matchAll(DEFINITION)].map(([, target]) => target.replace(/^<|>$/g, ''))]
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
    ['括弧を含む先', '[説明](missing(v2).md)', 'missing(v2).md'],
    ['括弧を含む先とタイトル', '[説明](missing(v2).md "タイトル")', 'missing(v2).md'],
    ['エスケープした括弧', '[説明](missing\\(v2.md)', 'missing(v2.md'],
  ])('%s のリンクの先を取り出す', (_name, markdown, target = 'missing.md') => {
    expect(relativeLinks(markdown)).toEqual([target]);
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
