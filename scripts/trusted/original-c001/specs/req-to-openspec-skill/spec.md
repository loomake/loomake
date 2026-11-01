## MODIFIED Requirements

### Requirement: 完了ゲートのタスクの印
Skill は、tasks.md の完了ゲートのタスク（`verify --change <change-id> --done --scope local` を通すタスク）の行末に `<!-- loomake:gate=done -->` を付け、ローカル完了と別途の最終CI合格確認を区別する説明を両雛形へ載せる SHALL。

Source: REQ-136

#### Scenario: 雛形に印がある
- **WHEN** Skill テンプレートの書式の参照ファイルの tasks.md の雛形を読む
- **THEN** 完了ゲートのタスクの行末に `<!-- loomake:gate=done -->` があり、コマンドは `verify --change <change-id> --done --scope local` で、SKILL.md がこの印を付けるよう指示している。ローカル完了と最終CI合格の確認を区別する
