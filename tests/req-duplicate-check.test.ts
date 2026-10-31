import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkReqDuplicates, parseRequirements } from '../scripts/req-duplicate-check.mjs';

// REQ ID の重複検査（scripts/req-duplicate-check.mjs）。開発の仕組みなので要件 ID は付けない（ADR 0005）
const script = join(import.meta.dirname, '..', 'scripts', 'req-duplicate-check.mjs');
const requirement = (name: string, ...ids: string[]) => `### Requirement: ${name}\n本文 SHALL。\n\nSource: ${ids.join(', ')}\n\n#### Scenario: 場面\n- **WHEN** 条件\n- **THEN** 結果\n`;
const main = (...blocks: string[]) => `# x Specification\n\n## Purpose\n目的。\n\n## Requirements\n\n${blocks.join('\n')}`;
const delta = (op: string, ...blocks: string[]) => `## ${op} Requirements\n\n${blocks.join('\n')}`;

function withFiles(files: Record<string, string>, check: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-req-dup-'));
  try {
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }
    check(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('REQ ID の重複検査', () => {
  it('重複がなければ合格し、CLI は終了コード 0 で終わる', () => {
    withFiles({
      'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001'), requirement('二つ目', 'REQ-002')),
      'openspec/changes/c1/specs/a/spec.md': delta('ADDED', requirement('三つ目', 'REQ-003')),
    }, (dir) => {
      expect(checkReqDuplicates(dir)).toEqual({ duplicates: [], problems: [], stale: [] });
      const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    });
  });

  it('同じ ID が主仕様と change の 2 つの Requirement に付いていたら、日本語の一覧を出して終了コード 1 で終わる', () => {
    withFiles({
      'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001', 'REQ-002')),
      'openspec/changes/c1/specs/b/spec.md': delta('ADDED', requirement('別の要件', 'REQ-002')),
      // archive の change は読まない
      'openspec/changes/archive/2026-10-01-old/specs/a/spec.md': delta('ADDED', requirement('古い要件', 'REQ-001')),
    }, (dir) => {
      expect(checkReqDuplicates(dir).problems).toEqual([{ id: 'REQ-002', requirements: ['a: 一つ目', 'b: 別の要件'] }]);
      const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('同じ REQ ID が 2 つ以上の Requirement の Source に付いています（1 件）');
      expect(result.stderr).toContain('REQ-002：a: 一つ目 ／ b: 別の要件');
    });
  });

  it('同じ Requirement を MODIFIED した差分仕様は重複に数えず、MODIFIED で外した ID・REMOVED・RENAMED も反映する', () => {
    withFiles({
      'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001', 'REQ-009'), requirement('消す要件', 'REQ-002'), requirement('旧名', 'REQ-003')),
      'openspec/changes/c1/specs/a/spec.md': [
        delta('MODIFIED', requirement('一つ目', 'REQ-001')),
        delta('REMOVED', '### Requirement: 消す要件\n**Reason**: 分ける\n**Migration**: なし\n'),
        delta('RENAMED', '- FROM: `### Requirement: 旧名`\n- TO: `### Requirement: 新名`\n'),
        delta('ADDED', requirement('移した要件', 'REQ-009'), requirement('分けた要件', 'REQ-002')),
      ].join('\n'),
      // 2 つ目の change も同じ Requirement を MODIFIED する
      'openspec/changes/c2/specs/a/spec.md': delta('MODIFIED', requirement('新名', 'REQ-003'), requirement('一つ目', 'REQ-001')),
    }, (dir) => {
      expect(checkReqDuplicates(dir)).toEqual({ duplicates: [], problems: [], stale: [] });
    });
  });

  it('既知の共有は失敗にせず、既知の ID でも一覧にない Requirement に付いたら失敗にする', () => {
    const known = (requirements: string[]) => JSON.stringify({ known: [{ id: 'REQ-001', requirements }] });
    const specs = { 'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001'), requirement('二つ目', 'REQ-001')) };
    withFiles({ ...specs, 'scripts/req-duplicate-known.json': known(['a: 一つ目', 'a: 二つ目']) }, (dir) => {
      expect(checkReqDuplicates(dir).problems).toEqual([]);
    });
    withFiles({ ...specs, 'scripts/req-duplicate-known.json': known(['a: 一つ目', 'a: 三つ目']) }, (dir) => {
      expect(checkReqDuplicates(dir).problems).toEqual([{ id: 'REQ-001', requirements: ['a: 一つ目', 'a: 二つ目'] }]);
    });
  });

  it('Requirement は次の Requirement か ## の見出しまで続き、### 補足 の下の Source も読む', () => {
    withFiles({
      'openspec/specs/a/spec.md': '## Requirements\r\r### Requirement: 一つ目\r本文 SHALL。\r\r### 補足\r\rSource: REQ-001\r\r### Requirement: 二つ目\r本文 SHALL。\r\rSource: REQ-001\r',
    }, (dir) => {
      expect(checkReqDuplicates(dir).problems).toEqual([{ id: 'REQ-001', requirements: ['a: 一つ目', 'a: 二つ目'] }]);
    });
  });

  it.each([
    ['構文の誤り', '{ "known": [', 'scripts/req-duplicate-known.json を JSON として読めませんでした'],
    ['null', 'null', 'scripts/req-duplicate-known.json の known は { id, requirements: [...] } の配列にしてください'],
  ])('既知の一覧が%sのときは、日本語の理由を出して終了コード 1 で終わる', (_, known, message) => {
    withFiles({ 'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001')), 'scripts/req-duplicate-known.json': known }, (dir) => {
      const cli = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
      expect(cli.status).toBe(1);
      expect(cli.stderr).toContain(`REQ ID の重複を調べられませんでした：${message}`);
      expect(cli.stderr).not.toMatch(/TypeError|SyntaxError|Cannot read/);
    });
  });

  it('既知の一覧のうち今の重複と一致しない項目は、失敗にせず警告を標準エラーに出す', () => {
    withFiles({
      'openspec/specs/a/spec.md': main(requirement('一つ目', 'REQ-001'), requirement('二つ目', 'REQ-001'), requirement('三つ目', 'REQ-002')),
      // REQ-001 は一致、REQ-002 は重複でなくなった、REQ-003 は仕様にない
      'scripts/req-duplicate-known.json': JSON.stringify({ known: [
        { id: 'REQ-001', requirements: ['a: 一つ目', 'a: 二つ目'] },
        { id: 'REQ-002', requirements: ['a: 三つ目', 'a: 旧名'] },
        { id: 'REQ-003', requirements: ['a: x', 'a: y'] },
      ] }),
    }, (dir) => {
      const result = checkReqDuplicates(dir);
      expect(result.problems).toEqual([]);
      expect(result.stale.map((entry: { id: string }) => entry.id)).toEqual(['REQ-002', 'REQ-003']);
      const cli = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
      expect(cli.status, cli.stderr).toBe(0);
      expect(cli.stderr).toContain('REQ ID の重複（警告）：scripts/req-duplicate-known.json の 2 件が今の重複と一致しません');
      expect(cli.stderr).toContain('REQ-002：a: 三つ目 ／ a: 旧名');
    });
  });

  it('コードブロックの中と、Requirement の外（別の ## 節）の Source は読まない', () => {
    const text = '## Requirements\n\n### Requirement: 一つ目\n本文。\n\nSource: REQ-001\n\n```md\n### Requirement: 例\nSource: REQ-002\n```\n\n## 別の節\nSource: REQ-003\n';
    expect(parseRequirements(text)).toEqual([{ op: null, name: '一つ目', sources: ['REQ-001'] }]);
  });

  it('リポジトリの仕様に、既知の一覧にない重複がない', () => {
    expect(checkReqDuplicates(join(import.meta.dirname, '..')).problems).toEqual([]);
  });
});
