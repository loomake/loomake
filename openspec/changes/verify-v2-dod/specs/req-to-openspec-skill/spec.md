## MODIFIED Requirements

### Requirement: 完了ゲートのタスクの印
Skill は、tasks.md のローカルの完了ゲートのタスク（`verify --change <change-id> --done --scope local` を通すタスク）の行末に `<!-- loomake:gate=done -->` を付けるよう定める SHALL。Skill は、このタスクの完了を最終の合格と扱わず、最終の合格には `--done --scope ci` の合格と必須 CI の成功が別に要ることを、tasks.md の雛形のチェックボックスでない注記で示す SHALL。

Source: REQ-136

#### Scenario: 雛形に印がある
- **WHEN** Skill テンプレートの書式の参照ファイルの tasks.md の雛形を読む
- **THEN** 完了ゲートのタスクの行末に `<!-- loomake:gate=done -->` があり、SKILL.md がこの印を付けるよう指示している

#### Scenario: 印のタスクはローカルの完了ゲート
- **WHEN** Skill テンプレートの tasks.md の雛形で、印のあるタスクを読む
- **THEN** そのタスクのコマンドは `verify --change <change-id> --done --scope local` で、印のあるタスクは 1 つだけであり、`--scope ci` を含むタスク（チェックボックス）は無い

#### Scenario: 最終の合格を区別する注記
- **WHEN** Skill テンプレートの tasks.md の雛形の末尾を読む
- **THEN** チェックボックスでない注記に、`--done --scope ci` の合格と必須 CI の成功が最終の合格に要り、印のタスクの完了だけでは最終の合格にならないことが書かれている
