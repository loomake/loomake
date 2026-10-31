## MODIFIED Requirements

### Requirement: JSON 出力
`--json` を指定すると、verify は core の2.0.0スキーマに沿った結果をJSON で標準出力に出す SHALL。completed/partialでは、要件ごとの成功テストファイル一覧を取得した場合、従来どおり `coverage` に出す SHALL。スキーマでは任意とするが、取得済み一覧を常に省略してはならない MUST NOT。abortedへ成功一覧を補わない MUST。doneでskip-commandsを指定した場合はcoverageプロパティを省略し、前回レポートを今回の成功一覧に使わない MUST。

Source: REQ-040

#### Scenario: スキーマに沿った出力
- **WHEN** `--change <id> --done --json` を実行する
- **THEN** 標準出力は JSON のみで、`schemaVersion` を含み、core の JSON スキーマで検証できる

#### Scenario: 要件ごとのテストファイル
- **WHEN** REQ-012 を名前に含むテストが `tests/a.test.ts` にあり、その実行で成功テスト対応を取得したchangeに `--done --json` を実行する
- **THEN** 2.0.0の出力のcoverageでREQ-012に `tests/a.test.ts` が含まれ、一覧を省略しない

#### Scenario: コマンド省略時のcoverage
- **WHEN** 前回の成功レポートがあるプロジェクトでdone/skip-commands/jsonを実行する
- **THEN** 終了コード1の不足を返し、coverageプロパティを出さない。前回一覧を今回の対応として表示しない

### Requirement: 終了コード
verifyはREQ-311の終了コード判定をAPIとCLIで共通に使う SHALL。`--change` の値が OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）でないとき（`/`・`\`・`..` を含むときを含む）と、`archive` のときは、使い方の誤りとする SHALL。

Source: REQ-041

#### Scenario: 合格
- **WHEN** ciのverdictがPASSか、local項目が全完了であり、いずれも要判断がなくabortedでもない
- **THEN** 終了コードは 0 である

#### Scenario: 不合格
- **WHEN** abortedではなく、必須検査のFAIL・証跡不足・未完了・要判断のいずれかがある
- **THEN** 終了コードは 1 である

#### Scenario: 使い方の誤り
- **WHEN** `--change` を付けずに `--spec-only` を指定する
- **THEN** 使い方が日本語で表示され、終了コードは 2 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake verify --change ../../packages --spec-only` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

#### Scenario: change 名の形でない change-id
- **WHEN** `loomake verify --change 'c1&echo' --spec-only` を実行する
- **THEN** change-id の形が正しくないと日本語で表示され、`openspec validate` は呼ばれず、終了コードは 2 である

#### Scenario: archive を change-id にする
- **WHEN** `loomake verify --change archive --spec-only` を実行する
- **THEN** archive は change-id に使えないと日本語で表示され、終了コードは 2 である

## ADDED Requirements

### Requirement: v2出力と終了コードの一貫性
verifyの関数APIとCLIは`schemaVersion: 2.0.0`の結果を書き出し、同じv2判定と終了コードを使う SHALL。abortedのusage/configは2、それ以外のabortedは3、decision.required・ciのFAIL/不足・localのpending/failは1、ciのPASSまたはlocalのpending=fail=0は0の順に判定する MUST。JSON指定時のstdoutは結果JSONだけ、進捗・診断はstderrとし、CI=1で入力を待たない MUST。localの0を最終合格と呼ばない MUST。

Source: REQ-311

#### Scenario: 優先順の契約
- **WHEN** abortedの各種別、decision.requiredとFAILの同時発生、ciのPASS/FAIL/不足、localの完了/未完了を与える
- **THEN** 表どおりの0〜3となり、要判断の理由とFAILのchecksを同時に保持する

#### Scenario: JSONと非対話
- **WHEN** CI=1で正常・不正入力を --json あり/なしで実行する
- **THEN** 終了コードは表示形式によらず一致し、--jsonのstdoutを単独のJSONとして解析できる
