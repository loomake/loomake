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

// コードブロックを除いた本文の、相対パスのリンク
const relativeLinks = (file: string) =>
  [...readFileSync(join(root, file), 'utf8').replace(/```[\s\S]*?```/g, '').matchAll(/\]\(([^)\s]+)\)/g)]
    .map(([, url]) => url)
    .filter((url) => !/^(https?:|mailto:|#)/.test(url));

describe('文書のリンク', () => {
  it.each(documents)('%s の相対パスのリンクは、リポジトリにあるファイルを指す', (file) => {
    const broken = relativeLinks(file).filter((url) => !existsSync(resolve(root, dirname(file), decodeURI(url.split('#')[0]))));
    expect(broken).toEqual([]);
  });
});
