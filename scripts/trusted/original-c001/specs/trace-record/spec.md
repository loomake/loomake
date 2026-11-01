## MODIFIED Requirements

### Requirement: 証拠の記録
`loomake trace record --change <id>` は、その change にscopeを明示した `verify --done` を実行し、2.0.0の結果をEvidence 2で、検査したコミットの SHA・コミットの日時・記録した日時と合わせて、`.loomake/evidence/<change-id>/` に JSON のファイルとして保存する SHALL。verify が不合格でも記録し、終了コードは verify と同じにする SHALL。記録したあとは、記録のファイルを git にコミットするよう日本語で案内する SHALL。change-id が OpenSpec の change 名の形でないときと、`archive` のときは、何も記録せず、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-066

#### Scenario: 合格した結果を記録する
- **WHEN** ci完了ゲートに合格するchangeに、未コミットの変更のない作業ツリーで `loomake trace record --change c1 --scope ci` を実行する
- **THEN** `.loomake/evidence/c1/` に JSON のファイルが 1 つ作られ、verify の結果・HEAD のコミットの SHA・コミットの日時・記録した日時が入り、終了コードは 0 である

#### Scenario: コミットを案内する
- **WHEN** `loomake trace record --change c1` で記録が保存される
- **THEN** 保存したファイルのパスと、そのファイルを git にコミットするよう促す案内が表示される

#### Scenario: 不合格の結果も記録する
- **WHEN** 完了ゲートに不合格になる change に `loomake trace record --change c1` を実行する
- **THEN** 不合格の結果が記録され、終了コードは 1 である

#### Scenario: 存在しない change
- **WHEN** 存在しない change-id を `--change` に渡す
- **THEN** 何も記録されず、日本語のエラーメッセージが表示され、終了コードは 2 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace record --change ../../packages` を実行する
- **THEN** 何も記録されず、change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である


## ADDED Requirements

### Requirement: v2証拠の記録と旧版の非再利用
trace recordはverify 2.0.0をEvidence 2にそのまま保存し、scopeと実行状態を混同しない SHALL。scope省略はci、明示local/ciを保持し、空/範囲外値はGit・verify・保存前に使い方の誤り/2とする SHALL。verifyと同じ0〜3、abortedの非補完、文書snapshot・HEAD/作業ツリー/文書hash照合・未コミット拒否・追記専用・同期APIを維持する MUST。RecordOptions.onLimitを任意で受けrunVerifyへ同期転送し、JSON外形と既存onVerifyを保つ SHALL。旧Evidence 1/verify 1.0.0は閲覧専用で自動再利用/最終合格に使わず、Evidence 2/localもREQ-164の同一状態の外部再試行に限り参照し、再localゲートや新品質実施/ci合格を代替しない MUST。

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

#### Scenario: 不正scopeで記録しない
- **WHEN** CLI/APIのscopeに空値またはlocal/ci以外を渡す
- **THEN** 使い方の誤りで終了コード2となり、Git・verify・証拠ファイル作成を行わない。省略ciと明示local/ciの既存契約は維持する
