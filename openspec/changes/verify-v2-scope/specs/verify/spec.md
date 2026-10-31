## MODIFIED Requirements

### Requirement: verify の性能
テストファイル 1,000 個・要件 500 件の change で、commandsを除くverifyのlocal完了検査（`--done --scope local --skip-commands`）は 3 秒以内に終わる SHALL。この数値は暫定であり、実案件で計測したあと見直す。

Source: REQ-050

#### Scenario: 1,000 ファイル・500 要件
- **WHEN** 要件 500 件の change と、テストファイル 1,000 個を生成した一時ディレクトリで `verify --change <id> --done --scope local --skip-commands --json` を実行する
- **THEN** 3秒以内に終わり、コマンド未実施の不足で終了コード1になる。時間条件を満たすことを完了ゲート合格とは呼ばない

#### Scenario: テスト対応解析を含む処理量の保持
- **WHEN** 同じ500要件/1,000ファイルのfixtureで、localの省略ゲートと実際のテストレポート抽出・要件対応判定の純粋処理を連続して計測する
- **THEN** commandsを除く合計処理は3秒以内で、500要件それぞれの成功テスト対応を確認できる。独立に解析したfixtureをゲートのcoverageや品質PASSへ転用しない

## ADDED Requirements

### Requirement: scopeの指定と既存ゲートの保持
verifyはciとlocalを明示して実行できる SHALL。scope省略時、doneはci、spec-onlyはlocalを既定にする SHALL。ciの完了ゲートはCI必須項目を含む全条件で集約し、localはローカル実施項目の完了だけを返す MUST。既存の合意・仕様整合性・未完了タスク・成功したID付きテスト・品質コマンド・安全制約の検査を省略または弱化しない MUST。--skip-commandsを実施済みの証明にせず、証跡のない項目は不足とする MUST。spec-onlyは仕様/構造検査だけをchecks/summaryに数え、品質targetと品質対象guardを生成しない SHALL。changeなしのverifyはscope省略か明示localを受理し、明示ciは使い方の誤りとして終了コード2にする SHALL。

Source: REQ-312

#### Scenario: bare verifyの品質専用経路
- **WHEN** changeを指定せずbare verifyを実行する
- **THEN** 品質コマンド専用のlocal結果をchange:null・verdictなしで返し、quality.yamlを新たに必須にしない。change必須ゲートの欠落と同一視しない

#### Scenario: changeなしの明示scope
- **WHEN** changeを指定せずに --scope local と --scope ci を別々に付けてverifyをCLI/APIで実行する
- **THEN** localは品質コマンド専用のlocal結果を返し、ciは使い方の誤り（UsageError）として終了コード2を返す。品質コマンドは実行しない

#### Scenario: scopeの既定値と明示指定
- **WHEN** scopeを省略してdoneまたはspec-onlyを実行し、別に明示scopeを渡してCLI/APIを実行する
- **THEN** 省略したdoneはci、spec-onlyはlocalになり、明示したlocal/ciはそのまま使う。環境変数CIだけで既定値を上書きしない

#### Scenario: 未回答の仕様ゲート
- **WHEN** ブロッキング確認事項が未回答のchangeを --spec-only で検査する
- **THEN** 従来どおり不合格となり、品質コマンドやJSON移行を理由に合格へ変えない

#### Scenario: local結果の持ち込み
- **WHEN** localの完了結果、旧1.0.0のok:true、または証跡のないskip-commandsをciゲートへ使う
- **THEN** それだけではPASSにしない

#### Scenario: 仕様ゲートの件数
- **WHEN** spec-onlyをlocalで実行する
- **THEN** 仕様と構造の検査だけがchecks/summaryへ入り、品質targetの未実施をpendingへ数えない
