## ADDED Requirements

### Requirement: 完了ゲートのタスクの印
Skill は、tasks.md の完了ゲートのタスク（`verify --change <change-id> --done` を通すタスク）の行末に `<!-- loomake:gate=done -->` を付けるよう定める SHALL。

Source: REQ-136

#### Scenario: 雛形に印がある
- **WHEN** Skill テンプレートの書式の参照ファイルの tasks.md の雛形を読む
- **THEN** 完了ゲートのタスクの行末に `<!-- loomake:gate=done -->` があり、SKILL.md がこの印を付けるよう指示している
