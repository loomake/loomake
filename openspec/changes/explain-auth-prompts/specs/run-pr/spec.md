## ADDED Requirements

### Requirement: 認証や署名の入力による失敗の案内
`loomake run` は、git を `GIT_TERMINAL_PROMPT=0` で動かし、端末での入力を求めない SHALL。git の commit・push が、認証や署名の入力が要るために失敗したとき（標準エラーに `could not read Username`・`terminal prompts disabled`・`Permission denied (publickey)`・`passphrase`・`gpg failed to sign` などを含むとき）は、git のエラーに加えて、run は端末での入力ができないので、ssh-agent・credential helper（`gh auth setup-git` など）・gpg-agent を使って入力なしで動くように設定する案内を、止まった理由に添える SHALL。

Source: REQ-211

#### Scenario: push で HTTPS の認証が要る
- **WHEN** 証拠のコミットのあとの push が、`could not read Username` で失敗する
- **THEN** run は止まり、理由に git のエラーと、credential helper などを使う案内が含まれる

#### Scenario: ほかの理由で失敗する
- **WHEN** push が、認証や署名と関係のない理由で失敗する
- **THEN** 理由に、認証の案内は含まれない
