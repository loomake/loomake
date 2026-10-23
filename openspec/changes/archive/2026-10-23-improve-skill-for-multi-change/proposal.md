# improve-skill-for-multi-change

## Why
試験プロジェクトで kit-v1.0.md を 3 つの change にしたとき、req-to-openspec Skill の手順からは、複数の change にまたがる番号の振り方、後のフェーズの要件の扱い、要件書の中の未決事項の扱いが決まらなかった（docs/review.md「2026-10-23 試験プロジェクトでの kit の試用」の指摘 3・4・6）。

## What Changes
- Skill に、REQ・Q・A を要件書で通し番号にし、複数の change にかかわる行をそれぞれの trace.md に載せる手順を足す（REQ-026、REQ-029）
- Skill に、要件書の未決事項をすべて確認事項にする手順を足す（REQ-027）
- Skill に、後のフェーズの要件を範囲外として書き、Non-goals で分けて書く手順を足す（REQ-031）

## Non-goals
- 台帳の状態に「後のフェーズ」を足すこと（core と verify を変えずに済む書き方にする）
- 同じ確認事項の回答の食い違いの検査（add-shared-question-check で扱う）

## Impact
- 影響する capability：req-to-openspec-skill（Requirement の変更）
- 影響するコード：`packages/kit/templates/skills/req-to-openspec/SKILL.md`、`.claude/skills/req-to-openspec/SKILL.md`
