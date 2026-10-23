# fix-req-numbering

## Why
1 つのリポジトリに要件書が 2 冊以上あると、どちらも REQ-001 から番号を振るため、番号がぶつかる。テスト名の `[REQ-012]` はリポジトリ全体で探すので、完了ゲートが別の要件書の要件のテストを数えてしまう（docs/review.md「2026-10-23 試験プロジェクトでの kit の試用」の指摘 7）。

## What Changes
- req-to-openspec Skill の採番の手順を、「リポジトリにある trace.md の最大の REQ 番号の次から」に変える（REQ-026）

## Non-goals
- Q・A の番号の振り方（要件書 1 冊の中の通し番号のまま）
- すでに振った番号の振り直し
- verify が、重なった REQ 番号を見つけて知らせること

## Impact
- 影響する capability：req-to-openspec-skill（Requirement の変更）
- 影響するコード：`packages/kit/templates/skills/req-to-openspec/SKILL.md`、`.agents/skills/req-to-openspec/SKILL.md`
