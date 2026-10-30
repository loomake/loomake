import { describe, expect, it } from 'vitest';
import { classifyPath, decideTier, declaredTier, formatTierLine, isSpecPath, requirementBodyChanged, requirementChangedSpecs } from '../scripts/ci-tier.mjs';

// `git diff --raw -z -M` を parseRawDiff で読んだ形。名前の変更は変更前と変更後の両方のパスを持つ
const entry = (status: string, ...paths: string[]) => ({ status, modes: ['100644', '100644'] as [string, string], paths });
const changed = (...paths: string[]) => paths.map((path) => entry('M', path));
// `git diff -U0` の形の差分。file ごとに、足した行（+）と消した行（-）を並べる
const unified = (file: string, lines: string[]) => [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, '@@ -1,0 +2 @@', ...lines].join('\n') + '\n';
const decide = (paths: string[], specDiff = '', body = '') => decideTier({ entries: changed(...paths), specDiff, body });

describe('パスの段階', () => {
  it('[REQ-342] docs/・直下の .md・.changeset の本文・change の成果物は L1', () => {
    for (const path of ['docs/usage.md', 'README.md', '.changeset/x.md', 'openspec/changes/c1/tasks.md', 'openspec/changes/c1/proposal.md', 'openspec/specs/x/spec.md', 'docs/worklog/2026-10-31/change-x.md'])
      expect(classifyPath(path), path).toBe('L1');
    expect(decide(['docs/usage.md', 'README.md', '.changeset/x.md', 'openspec/changes/c1/tasks.md'])).toMatchObject({ tier: 'L1' });
  });

  it('[REQ-342] tests/・test/・.github/・scripts/・.agents/skills/・packages/*/templates/ は L2', () => {
    for (const path of ['tests/a.test.ts', 'test/a.test.ts', 'packages/runner/test/a.test.ts', '.github/workflows/ci.yml', '.github/PULL_REQUEST_TEMPLATE.md', 'scripts/x.mjs', '.agents/skills/delivery/SKILL.md', 'packages/kit/templates/AGENTS.md'])
      expect(classifyPath(path), path).toBe('L2');
  });

  it('[REQ-342] packages/*/src は L3、packages/ のそのほかと設定・どれにも当たらないファイルは L2', () => {
    expect(classifyPath('packages/kit/src/verify/run.ts')).toBe('L3');
    expect(classifyPath('packages/core/src/index.ts')).toBe('L3');
    for (const path of ['packages/runner/test/a.test.ts', 'packages/kit/package.json', 'packages/cli/README.md', '.changeset/config.json', 'openspec/config.yaml', 'package.json', 'eslint.config.js', 'docs/site.yml', 'tests/fixtures/README.md'])
      expect(classifyPath(path), path).toBe('L2');
  });

  it('[REQ-342] 名前を変えたファイルは変更前と変更後の両方を判定する', () => {
    const renamed = decideTier({ entries: [entry('R100', 'scripts/x.md', 'docs/x.md')] });
    expect(renamed).toMatchObject({ tier: 'L2', reasons: ['scripts/x.md'] });
    expect(decideTier({ entries: [entry('R090', 'docs/old.md', 'docs/new.md')] })).toMatchObject({ tier: 'L1' });
  });

  it('[REQ-342] 複数の段階に当たるときは最も高い段階にし、その段階のパスを理由にする', () => {
    expect(decide(['docs/usage.md', 'scripts/x.mjs'])).toMatchObject({ tier: 'L2', reasons: ['scripts/x.mjs'] });
    expect(decide(['docs/usage.md', 'scripts/x.mjs', 'packages/kit/src/a.ts'])).toMatchObject({ tier: 'L3', reasons: ['packages/kit/src/a.ts'] });
  });

  it('[REQ-342] 変えたファイルがなければ安全側の L2 にする', () => {
    expect(decideTier({ entries: [] })).toMatchObject({ tier: 'L2', reasons: ['変えたファイルがありません'] });
  });
});

describe('Requirement の本文の変更', () => {
  it('[REQ-342] いまの仕様と change の差分仕様の spec.md だけを対象にする', () => {
    for (const path of ['openspec/specs/monorepo/spec.md', 'openspec/changes/c1/specs/monorepo/spec.md']) expect(isSpecPath(path), path).toBe(true);
    for (const path of ['openspec/changes/archive/2026-10-23-c1/specs/x/spec.md', 'openspec/changes/c1/tasks.md', 'openspec/changes/c1/proposal.md', 'docs/spec.md', 'openspec/specs/spec.md'])
      expect(isSpecPath(path), path).toBe(false);
  });

  it('[REQ-342] `### Requirement:` の行か RFC 2119 の語を含む行の追加・削除を本文の変更とみなす', () => {
    for (const line of ['+### Requirement: 新しい振る舞い', '-### Requirement: 古い振る舞い', '+CI は完了ゲートを実行する SHALL。', '-ジョブを失敗させる MUST。', '+推奨する SHOULD。', '+許す MAY。'])
      expect(requirementBodyChanged(unified('openspec/specs/x/spec.md', [line])), line).toBe(true);
    expect(requirementChangedSpecs(unified('openspec/changes/c1/specs/x/spec.md', ['+本文 MUST']))).toEqual(['openspec/changes/c1/specs/x/spec.md']);
  });

  it('[REQ-342] Scenario の WHEN/THEN・Purpose・見出しの文言の変更と、spec.md 以外の差分は本文の変更にしない', () => {
    const scenario = ['-- **WHEN** 古い条件', '+- **WHEN** 新しい条件', '-- **THEN** 古い結果', '+- **THEN** 新しい結果', '+#### Scenario: 新しい場面', '+## Purpose', '+段階の説明。', '+MAYBE や MUSTARD のような語は数えない'];
    expect(requirementBodyChanged(unified('openspec/specs/x/spec.md', scenario))).toBe(false);
    // 差分のヘッダ（--- a/… と +++ b/…）は数えない
    expect(requirementBodyChanged(unified('openspec/specs/x/spec.md', []))).toBe(false);
    for (const file of ['openspec/changes/c1/tasks.md', 'openspec/changes/c1/proposal.md', 'docs/usage.md'])
      expect(requirementBodyChanged(unified(file, ['+この変更は MUST を足す'])), file).toBe(false);
    expect(requirementBodyChanged('')).toBe(false);
  });

  it('[REQ-342] Requirement の本文を変えた spec.md は L3 にし、その spec.md を理由にする', () => {
    const diff = unified('openspec/specs/x/spec.md', ['+新しい振る舞い SHALL。']);
    expect(decide(['openspec/specs/x/spec.md'], diff)).toMatchObject({ tier: 'L3', reasons: ['openspec/specs/x/spec.md'] });
    const change = unified('openspec/changes/c1/specs/x/spec.md', ['+### Requirement: 新しい振る舞い']);
    expect(decide(['openspec/changes/c1/specs/x/spec.md', 'openspec/changes/c1/tasks.md'], change)).toMatchObject({ tier: 'L3', reasons: ['openspec/changes/c1/specs/x/spec.md'] });
    // src と spec の両方が理由になる
    expect(decide(['packages/kit/src/a.ts', 'openspec/specs/x/spec.md'], diff)).toMatchObject({ tier: 'L3', reasons: ['packages/kit/src/a.ts', 'openspec/specs/x/spec.md'] });
    // Scenario の文言だけなら L1 のまま
    expect(decide(['openspec/specs/x/spec.md'], unified('openspec/specs/x/spec.md', ['+- **THEN** 新しい結果']))).toMatchObject({ tier: 'L1' });
  });

  it('[REQ-342] archive の PR は Requirement を足していても L1', () => {
    const entries = [entry('D', 'openspec/changes/c1/tasks.md'), entry('A', 'openspec/changes/archive/2026-10-23-c1/tasks.md'), entry('M', 'openspec/specs/x/spec.md')];
    const diff = unified('openspec/specs/x/spec.md', ['+### Requirement: 反映した振る舞い', '+本文 SHALL。']);
    expect(decideTier({ entries, specDiff: diff })).toMatchObject({ tier: 'L1' });
    // archive と一緒にコードを変えていれば例外ではない
    expect(decideTier({ entries: [...entries, entry('M', 'scripts/x.mjs')], specDiff: diff })).toMatchObject({ tier: 'L3' });
  });
});

describe('本文の loomake-tier:', () => {
  it('[REQ-342] 上げる指定は採用し、理由に本文の指定を足す', () => {
    const raised = decide(['docs/usage.md'], '', '概要\n\nloomake-tier: L3\n');
    expect(raised).toMatchObject({ tier: 'L3', detected: 'L1', override: { from: 'L1', to: 'L3' } });
    expect(formatTierLine(raised as never)).toBe('loomake-tier: L3（本文の指定 L1→L3、docs/usage.md）');
    expect(decide(['scripts/x.mjs'], '', 'loomake-tier: L3\r\n')).toMatchObject({ tier: 'L3', override: { from: 'L2', to: 'L3' } });
  });

  it('[REQ-342] 下げる指定は失敗にする', () => {
    expect(decide(['packages/kit/src/a.ts'], '', 'loomake-tier: L2')).toEqual({ error: '段階は上げる方向にだけ上書きできます：判定 L3、指定 L2' });
    expect(decide(['scripts/x.mjs'], '', 'loomake-tier: L1')).toHaveProperty('error');
  });

  it('[REQ-342] テンプレートのまま・行なし・同じ段階の指定は判定どおり', () => {
    for (const body of ['', 'loomake-tier: L1|L2|L3', '概要だけ', 'loomake-tier: L2']) {
      const result = decide(['scripts/x.mjs'], '', body);
      expect(result, body).toMatchObject({ tier: 'L2', detected: 'L2' });
      expect(result, body).not.toHaveProperty('override');
    }
    expect(declaredTier('')).toBeUndefined();
    expect(declaredTier('  loomake-tier:  L3  ')).toBe('L3');
  });

  it('[REQ-342] L1・L2・L3 以外の値は失敗にする', () => {
    for (const value of ['L4', 'l2', 'L', '高い', 'L2 L3']) expect(decide(['docs/usage.md'], '', `loomake-tier: ${value}`), value).toEqual({ error: `PR 本文の loomake-tier: の値が読めません：${value}（L1・L2・L3 のどれかを書いてください）` });
  });
});

describe('段階の出力行', () => {
  it('[REQ-343] 段階と理由のパス 3 件までと残りの件数を 1 行にする', () => {
    expect(formatTierLine(decide(['packages/kit/src/a.ts']) as never)).toBe('loomake-tier: L3（packages/kit/src/a.ts）');
    const four = decide(['scripts/a.mjs', 'scripts/b.mjs', 'scripts/c.mjs', 'scripts/d.mjs', 'docs/usage.md']);
    expect(formatTierLine(four as never)).toBe('loomake-tier: L2（scripts/a.mjs、scripts/b.mjs、scripts/c.mjs、ほか 1 件）');
    expect(formatTierLine(decide(['docs/a.md', 'docs/b.md', 'docs/c.md']) as never)).toBe('loomake-tier: L1（docs/a.md、docs/b.md、docs/c.md）');
  });
});
