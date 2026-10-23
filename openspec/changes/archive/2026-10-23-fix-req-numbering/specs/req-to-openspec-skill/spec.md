## MODIFIED Requirements

### Requirement: 台帳づくりの手順
Skill は要件書の要求文を 1 文ずつ採番し、出典（文書名・章と行）つきで要件台帳に載せる手順を定める SHALL。REQ の番号は、リポジトリにある trace.md（進行中と archive の change）に出てくる最大の REQ 番号の次から振り、trace.md が 1 つもなければ REQ-001 から振るよう定める SHALL。REQ・Q・A の番号は、change をまたいでも同じ番号を使い、Q・A は要件書 1 冊の中で通し番号にするよう定める SHALL。

Source: REQ-026

#### Scenario: 採番と出典の指示がある
- **WHEN** kit の Skill テンプレート（SKILL.md）を読む
- **THEN** 1 文ずつ載せること、出典に文書名・章と行を書くことが指示されている

#### Scenario: 既存の番号の次から振る指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** リポジトリにある trace.md の最大の REQ 番号の次から振ること、trace.md がなければ REQ-001 から振ることが指示されている

#### Scenario: 通し番号の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** REQ・Q・A を change をまたいでも同じ番号で使い、Q・A を要件書 1 冊の中で通し番号にすることが指示されている
