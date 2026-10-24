import { describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { findViolations } from '@loomake/runner';
import { makeRepo } from './helpers.js';

const names = process.platform === 'win32' ? ['日本語 空白'] : ['日本語 空白', 'tab\tname', 'line\nname'];

describe('Gitの表示形式から独立したパスの検査', () => {
  it.each(names)('[REQ-138] %j の仕様変更とテスト削除を検出する', (name) => {
    const repo = makeRepo();
    try {
      const spec = `openspec/specs/${name}/spec.md`;
      const test = `tests/${name}.ts`;
      repo.git('config', 'core.quotepath', 'true');
      repo.write(spec, 'before\n');
      repo.write(test, 'before\n');
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'paths');
      repo.write(spec, 'after\n');
      rmSync(join(repo.root, test));
      const result = findViolations(repo.root, repo.env);
      expect(result.findings).toContainEqual({ file: spec, reason: 'いまの仕様を変えました' });
      expect(result.findings).toContainEqual({ file: test, reason: 'テストファイルを消しました' });
      expect(result.diff).toContain('after');
    } finally {
      repo.cleanup();
    }
  });

  it.each(names)('[REQ-138] %j のテストへのskip追加を検出する', (name) => {
    const repo = makeRepo();
    try {
      const file = `tests/${name}.test.ts`;
      repo.write(file, "it.skip('case', () => {});\n");
      expect(findViolations(repo.root, repo.env).findings).toContainEqual({
        file,
        reason: "skip・todo を足しました：it.skip('case', () => {});",
      });
    } finally {
      repo.cleanup();
    }
  });
});
