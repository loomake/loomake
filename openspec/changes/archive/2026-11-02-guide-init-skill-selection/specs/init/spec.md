## MODIFIED Requirements

### Requirement: OpenSpec 初期化の案内
`openspec/` ディレクトリが無い場合、`loomake init` は `openspec init` の実行を案内する SHALL。成功して終了コード0を返すとき、`openspec/` の有無と `--codex` の指定によらず「要件書から change を作るときは req-to-openspec、作成済み change の調査・更新・実装・archive には OpenSpec が配置する openspec-* の Skill を使ってください。」を日本語の1行で1回だけ案内する SHALL。中止して終了コード1を返すときと使い方の誤りで終了コード2を返すときは、この使い分けの案内を出さない MUST。

Source: REQ-023

#### Scenario: openspec/ が無い
- **WHEN** `openspec/` の無いプロジェクトで `loomake init` を実行する
- **THEN** 出力に `openspec init` の実行を促す案内が含まれる

#### Scenario: openspec/ がある
- **WHEN** `openspec/` のあるプロジェクトで `loomake init` を実行する
- **THEN** `openspec init` の案内は出力されない

#### Scenario: 成功時の使い分けの案内
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** 使い分けの案内が1行で1回だけ出て、終了コードは0である

#### Scenario: OpenSpec がある状態で Codex 向けに配置する
- **WHEN** `openspec/` のあるプロジェクトで `loomake init --codex` を実行する
- **THEN** 同じ使い分けの案内が1回だけ出て、`openspec init` の文字列は含まれず、`openspec-*` のSkillは配置しない

#### Scenario: 中止や使い方の誤り
- **WHEN** 確認できない環境で同名ファイルの差があるか、置き先のリンクが安全でないか、未対応のオプションがある
- **THEN** 使い分けの案内は出ず、終了コードはそれぞれ1・1・2である
