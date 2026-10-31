## ADDED Requirements

### Requirement: v2証拠の記録と旧版の非再利用
trace recordは2.0.0のverify結果をEvidence 2にそのまま保存し、scopeと実行状態を取り違えない SHALL。CLI/APIのscope省略時はciとし、明示したlocalはlocalのまま検証・記録する SHALL。verifyと同じ0〜3を返し、abortedの品質判定を補わない MUST。既存の文書snapshot・HEAD/作業ツリー/文書hash照合・未コミット拒否・追記専用保存・同期APIを維持する MUST。旧Evidence 1とverify 1.0.0は閲覧だけに対応し、新しい自動再利用や最終合格へ使わない MUST。Evidence 2のlocal記録はREQ-164の同一状態での外部操作再試行に限り参照できるが、再度のlocal完了ゲートや新しい品質実施/ci合格の根拠を代替しない MUST。

Source: REQ-315

#### Scenario: v2の結果をそのまま記録する
- **WHEN** ci/localの結果と、changeが確定した実行時abortedを記録する
- **THEN** v2の構造と終了コードを保ち、abortedへchecks等を足さず、旧ファイルを上書きしない

#### Scenario: scopeの既定値
- **WHEN** CLIの --scopeとAPIのscopeを省略して記録する
- **THEN** verifyはscope:ciで実行され、明示localの場合はscope:localのまま記録する。ローカル完了を最終CI合格に変換しない

#### Scenario: 旧版と変更検知
- **WHEN** 旧1.0.0のok:trueを再利用しようとする、または検査中にHEAD/文書が変化する
- **THEN** 旧版を合格根拠にせず、変化時は従来どおり記録しない
