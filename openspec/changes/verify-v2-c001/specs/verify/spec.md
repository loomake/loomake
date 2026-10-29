## MODIFIED Requirements

### Requirement: JSON 出力
`--json` を指定すると、verify は core の2.0.0スキーマに沿った結果をJSON で標準出力に出す SHALL。completed/partialでは、要件ごとの成功テストファイル一覧を取得した場合、従来どおり `coverage` に出す SHALL。スキーマでは任意とするが、取得済み一覧を常に省略してはならない MUST NOT。abortedへ成功一覧を補わない MUST。

Source: REQ-040

#### Scenario: スキーマに沿った出力
- **WHEN** `--change <id> --done --json` を実行する
- **THEN** 標準出力は JSON のみで、`schemaVersion` を含み、core の JSON スキーマで検証できる

#### Scenario: 要件ごとのテストファイル
- **WHEN** REQ-012 を名前に含むテストが `tests/a.test.ts` にあり、その実行で成功テスト対応を取得したchangeに `--done --json` を実行する
- **THEN** 2.0.0の出力のcoverageでREQ-012に `tests/a.test.ts` が含まれ、一覧を省略しない

### Requirement: 終了コード
verifyは、abortedのusage/configを2、それ以外のabortedを3、decision.required・ciのFAIL/不足・localのpending/failを1、ciのPASSまたはlocalのpending=fail=0を0として、この順で判定する SHALL。`--change` の値が OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）でないとき（`/`・`\`・`..` を含むときを含む）と、`archive` のときは、使い方の誤りとする SHALL。

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

### Requirement: quality.yamlの最小読取
verifyのchange必須ゲートはプロジェクトルートのquality.yamlを読み、既存のversion 2スキーマと既定値を適用する SHALL。YAML構文・型・対応版・対象外理由の不正はconfigのaborted、必要ファイルの不在や権限などの読取不能はruntime/permissionのabortedとする MUST。設定ファイル内容の誤り2と読取不能3を区別する MUST。31副特性のinit生成は後続とし、既存導入へ最小ファイルの手動作成を案内する SHALL。

Source: REQ-310

#### Scenario: 最小入力と未知キー
- **WHEN** versionとmodelを持つ最小quality.yaml、および未知キーを含む入力を読む
- **THEN** スキーマの既定値を補い、未知値を失わず、空の評価対象を完了ゲートのPASSにしない

#### Scenario: 不正・不在・権限エラー
- **WHEN** YAML構文不正・version不正、ファイル不在、読取権限不足をそれぞれ発生させる
- **THEN** 前2者は終了コード2、不在・権限不足は終了コード3のabortedで返し、nextに設定の修正・最小ファイル作成・権限確認を示す

### Requirement: v2出力と終了コードの一貫性
verifyの関数APIとCLIは同じv2判定と終了コードを使う SHALL。abortedのusage/configは2、それ以外のabortedは3、decision.required・ciのFAIL/不足・localのpending/failは1、ciのPASSまたはlocalのpending=fail=0は0の順に判定する MUST。JSON指定時のstdoutは結果JSONだけ、進捗・診断はstderrとし、CI=1で入力を待たない MUST。localの0を最終合格と呼ばない MUST。

Source: REQ-311

#### Scenario: 優先順の契約
- **WHEN** abortedの各種別、decision.requiredとFAILの同時発生、ciのPASS/FAIL/不足、localの完了/未完了を与える
- **THEN** 表どおりの0〜3となり、要判断の理由とFAILのchecksを同時に保持する

#### Scenario: JSONと非対話
- **WHEN** CI=1で正常・不正入力を --json あり/なしで実行する
- **THEN** 終了コードは表示形式によらず一致し、--jsonのstdoutを単独のJSONとして解析できる

### Requirement: scopeの指定と既存ゲートの保持
verifyはciとlocalを明示して実行できる SHALL。ciの完了ゲートはCI必須項目を含む全条件で集約し、localはローカル実施項目の完了だけを返す MUST。既存の合意・仕様整合性・未完了タスク・成功したID付きテスト・品質コマンド・安全制約の検査を省略または弱化しない MUST。--skip-commandsを実施済みの証明にせず、証跡のない項目は不足とする MUST。bare verifyの境界はR-C001-01の回答後に確定する SHALL。

Source: REQ-312

#### Scenario: 未回答の仕様ゲート
- **WHEN** ブロッキング確認事項が未回答のchangeを --spec-only で検査する
- **THEN** 従来どおり不合格となり、品質コマンドやJSON移行を理由に合格へ変えない

#### Scenario: local結果の持ち込み
- **WHEN** localの完了結果、旧1.0.0のok:true、または証跡のないskip-commandsをciゲートへ使う
- **THEN** それだけではPASSにしない

### Requirement: C-001の成功経路と不足拒否
C-001は、最小quality.yamlから適格な実証跡に基づく正常なPASS、不正入力のaborted、証跡不足のINSUFFICIENT_EVIDENCEを区別できる MUST。C-003待ちを理由に成功経路・自己完了ゲートを削らず、未実施・古い・旧形式・全NAを合格にする例外を作らない MUST。最小実証跡の取得をC-001へ含める範囲かC-003への依存方法はR-C001-03の回答後に確定する SHALL。回答までは実装と形式切替を行わない MUST。

Source: REQ-319

#### Scenario: 正常・不正・不足の受入
- **WHEN** 最小の適格な実証跡がある正常入力、不正設定、未実施または古い証跡を使って同じCLI/APIを検査する
- **THEN** 正常はciのPASS/0、不正はaborted/2または3、不足はINSUFFICIENT_EVIDENCE/1となる。成功例に手書きのok:trueや未照合の適格フラグを使わない

#### Scenario: 完了ゲートの維持
- **WHEN** 本changeを完了と報告する
- **THEN** 全要件のID付き試験と全タスクの完了、最終headの通常の完了ゲートexit 0が必要であり、未接続を理由に省略しない
