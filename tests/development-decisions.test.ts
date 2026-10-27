import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, posix, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
// Windows の checkout で改行が CRLF になっても同じに読む
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

/** Markdown の見出し（## 以降）の名前の一覧 */
function headings(markdown: string, level: number): string[] {
  const mark = '#'.repeat(level);
  return markdown.split('\n').filter((line) => line.startsWith(`${mark} `)).map((line) => line.slice(level + 1).trim());
}

/** 見出し `## <name>` から次の `## ` の前までの本文 */
function section(markdown: string, name: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line === `## ${name}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** 本文の相対リンクの先（コードを除く） */
function links(markdown: string): string[] {
  const text = markdown.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target).filter((t) => !/^([a-z][a-z0-9+.-]*:|#)/i.test(t));
}

function git(...args: string[]) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

const ADR_HEADINGS = ['決定', '検討した選択肢', '理由', '適用範囲', '見直す条件'];

// 4 つの決定と、それを残した ADR
const ADRS = [
  { topic: '版管理の方式', file: 'docs/adr/0001-versioning-with-changesets.md', keyword: 'changesets' },
  { topic: '0.x の互換性の方針', file: 'docs/adr/0002-breaking-changes-in-0x.md', keyword: '0.x' },
  { topic: 'core の実行時依存', file: 'docs/adr/0003-zod-as-core-runtime-dependency.md', keyword: 'Zod' },
  { topic: '開発の技術スタック', file: 'docs/adr/0004-keep-development-stack.md', keyword: '技術スタック' },
];

describe('版管理と互換性の方針の記載', () => {
  const contributing = read('CONTRIBUTING.md');
  const policy = section(contributing, '版と互換性');

  it('[REQ-227][REQ-228] CONTRIBUTING.md に版管理の方式と 0.x の互換性の方針が書かれ、それぞれに ADR へのリンクがある', () => {
    const paragraphs = policy.split(/\n\s*\n/);
    const versioning = paragraphs.find((p) => p.includes('changesets'));
    const compatibility = paragraphs.find((p) => p.includes('`0.x`') && p.includes('破壊的変更'));
    expect(versioning, '版管理の方式の段落').toBeDefined();
    expect(compatibility, '0.x の互換性の方針の段落').toBeDefined();
    expect(links(versioning ?? '')).toContain('docs/adr/0001-versioning-with-changesets.md');
    expect(links(compatibility ?? '')).toContain('docs/adr/0002-breaking-changes-in-0x.md');
  });

  it('[REQ-227][REQ-228] CONTRIBUTING.md からたどった ADR のファイルがリポジトリにある', () => {
    const adrLinks = links(policy).filter((target) => target.startsWith('docs/adr/'));
    expect(adrLinks.length).toBeGreaterThanOrEqual(2);
    for (const target of adrLinks) expect(existsSync(resolve(root, target.split('#')[0])), target).toBe(true);
  });
});

describe('設計判断の ADR', () => {
  it.each(ADRS)('[REQ-234] $topic の ADR がある', ({ file, keyword }) => {
    expect(existsSync(join(root, file)), file).toBe(true);
    const [title] = headings(read(file), 1);
    expect(title).toContain(keyword);
    // ADR の一覧からもたどれる
    expect(links(read('docs/adr/README.md')).map((t) => posix.join('docs/adr', t))).toContain(file);
  });

  it.each(ADRS)('[REQ-234] $topic の ADR に、決定・検討した選択肢・理由・適用範囲・見直す条件の見出しがある', ({ file }) => {
    const markdown = read(file);
    expect(headings(markdown, 2)).toEqual(ADR_HEADINGS);
    for (const name of ADR_HEADINGS) expect(section(markdown, name), name).not.toBe('');
  });

  it('[REQ-234] ADR の雛形は、決定・検討した選択肢・理由・適用範囲・見直す条件の見出しを持つ', () => {
    expect(headings(read('docs/adr/template.md'), 2)).toEqual(ADR_HEADINGS);
  });
});

describe('開発効率の手書きの記録様式', () => {
  it('[REQ-229] 様式に、比較の種類・比較方式・作業範囲・推定の最小・最大・根拠・指示・レビュー・手直し・実行・待機の時間の欄がある', () => {
    const template = read('docs/effort/template.md');
    const basics = section(template, '記録の基本');
    for (const field of ['比較の種類', '比較方式', '作業範囲']) expect(basics, field).toMatch(new RegExp(`^\\| ${field} \\|`, 'm'));
    const [estimateHeader] = section(template, '事前の推定').split('\n').filter((line) => line.startsWith('|'));
    for (const field of ['最小', '最大', '根拠']) expect(estimateHeader, field).toContain(`| ${field} |`);
    const [actualHeader] = section(template, '実績').split('\n').filter((line) => line.startsWith('|'));
    for (const field of ['指示', 'レビュー', '手直し', '実行', '待機']) expect(actualHeader, field).toContain(`| ${field} |`);
  });
});

describe('C-001 の事前見積もり', () => {
  const RECORD = 'docs/effort/c-001.md';
  // 記録を最初に足したコミット
  const added = git('log', '--diff-filter=A', '--format=%H', '--', RECORD).stdout.trim().split('\n').filter(Boolean).at(-1);

  it('[REQ-230] C-001 の推定は、C-001 の change の最初のコミットより前のコミットで記録されている', () => {
    expect(added, `${RECORD} を足したコミット`).toMatch(/^[0-9a-f]{40}$/);
    const estimate = section(read(RECORD), '事前の推定');
    expect(estimate).toMatch(/^\| \d+ 時間 \| \d+ 時間 \| \S/m);
    // change を作ったら、記録の基本の表に change ID を書く。書いてあれば、その change の最初のコミットと順番を比べる
    const change = /^\| change \| (.+?) \|$/m.exec(section(read(RECORD), '記録の基本'))?.[1];
    expect(change).toBeDefined();
    if (change === '未作成') return;
    const first = git('log', '--format=%H', '--', `openspec/changes/${change}`, `openspec/changes/archive/*-${change}`).stdout.trim().split('\n').filter(Boolean).at(-1);
    expect(first, `change ${change} のコミット`).toMatch(/^[0-9a-f]{40}$/);
    expect(first).not.toBe(added);
    expect(git('merge-base', '--is-ancestor', added ?? '', first ?? '').status).toBe(0);
  });

  it('[REQ-230] 推定の最小・最大・根拠の欄は、記録したときから書き換えていない', () => {
    expect(added).toMatch(/^[0-9a-f]{40}$/);
    const before = git('show', `${added}:${RECORD}`);
    expect(before.status, before.stderr).toBe(0);
    expect(section(read(RECORD), '事前の推定')).toBe(section(before.stdout, '事前の推定'));
  });
});
