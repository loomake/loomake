## MODIFIED Requirements

### Requirement: 仕様ゲートの警告
spec-onlyは承認が空の仮定と状態が確認待ちの要件をPASSのreasonに案内として残し、その案内だけではdecision.requiredやpendingを立てず終了コード0を保つ SHALL。ブロッキングな未回答質問の不合格は維持する MUST。doneでは未承認の仮定と確認待ちをINSUFFICIENT_EVIDENCEとして残し、要判断理由と終了コード1を返す MUST。このゲート別の変更はR-C001-08の未承認候補である。

Source: REQ-036

#### Scenario: 警告のみ
- **WHEN** 未承認の仮定 A-01 と確認待ちの REQ-002 だけが問題であるchangeに --spec-onlyを実行する
- **THEN** A-01とREQ-002がPASSのreasonと人向けの案内に残り、その案内だけではpendingや要判断にならず終了コードは0である

#### Scenario: doneに未承認が残る
- **WHEN** 未承認の仮定または確認待ちの要件を持つchangeにdoneを実行する
- **THEN** 該当IDを不足と要判断理由へ残し終了コード1を返す

### Requirement: openspec validate の実行
verifyはOpenSpec CLIが見つかるとき openspec validate <id> --strictを実行し、その結果をゲートへ含める SHALL。auto設定でCLI不在の場合、ciではINSUFFICIENT_EVIDENCEにする MUST。localはR-C001-08のA候補ではPASSのreasonに未実施の案内を残し、B候補では理由付きNOT_APPLICABLEにし、いずれもこの案内だけでは不合格にしない SHALL。明示trueでのCLI不在は従来どおり不合格とする MUST。

Source: REQ-037

#### Scenario: validate が失敗する
- **WHEN** openspec validate --strictが失敗するchangeに --spec-onlyを実行する
- **THEN** 不合格となりvalidateの出力が詳細に含まれる

#### Scenario: OpenSpec CLI が無い
- **WHEN** OpenSpec CLIが見つからない環境で openspecValidate:autoのまま --spec-only --scope localを実行する
- **THEN** 未実施の理由を案内に残し、この項目だけでは終了コードを1にしない。A候補のPASSとB候補のNAの採否はR-C001-08で決める

#### Scenario: ciでOpenSpec CLIが無い
- **WHEN** openspecValidate:autoで必要なOpenSpec CLIが見つからずscope:ciの検証を実行する
- **THEN** 不足と未実施理由を返し、ほかに実行エラーがなければ終了コードは1である

### Requirement: 完了ゲート
doneは仕様ゲートに加え、未完了タスクとタスク0件をFAIL、確認待ちの要件をREQ-036と同じINSUFFICIENT_EVIDENCEと要判断にする SHALL。必要な成功テストの実施を確認できない要件は不足とし、適格な実施済み失敗はFAILとする MUST。テストの有無は、test コマンドが書き出したテストランナーの JSON レポートで、成功したテストの名前にある `[REQ-xxx]` で判定する MUST。

Source: REQ-038

#### Scenario: 未完了タスクがある
- **WHEN** `- [ ]` のタスクが残る change に `--done` を実行する
- **THEN** 未完了タスクの行を含めて不合格になる

#### Scenario: タスクが無い
- **WHEN** タスクが 1 つも無い tasks.md を持つ change に `--done` を実行する
- **THEN** タスクが無いことを含めて不合格になる

#### Scenario: 確認待ちが残っている
- **WHEN** 台帳に状態が確認待ちの要件が残る change に `--done` を実行する
- **THEN** その要件のIDを不足と要判断理由へ残し終了コード1になる

#### Scenario: テストの無い要件
- **WHEN** 仕様で参照される REQ-012 を名前に含むテストが無い change に `--done` を実行する
- **THEN** 「テストが無い要件：REQ-012」を不足理由へ含めて終了コード1になる

#### Scenario: skip されたテスト
- **WHEN** REQ-012 を名前に含むテストが `it.skip` だけである change に `--done` を実行する
- **THEN** REQ-012はテストの実施を確認できない要件として不足となり、ほかに実行エラーがなければ終了コード1になる

#### Scenario: 修飾子が続く skip の中のテスト
- **WHEN** REQ-012 を名前に含むテストが `describe.skip.each(...)` の中にだけある change に `--done` を実行する
- **THEN** REQ-012はテストの実施を確認できない要件として不足となり、ほかに実行エラーがなければ終了コード1になる

#### Scenario: テスト名以外の文字列にだけある要件 ID
- **WHEN** REQ-012 がテストファイルの中の文字列（`const fixture = '[REQ-012]'` など）にだけあり、名前に REQ-012 を含むテストが無い change に `--done` を実行する
- **THEN** REQ-012はテストの実施を確認できない要件として不足となり、ほかに実行エラーがなければ終了コード1になる

#### Scenario: テストランナーが実行しないファイル
- **WHEN** REQ-012 を名前に含むテストが、テストランナーの実行対象に入っていないファイルにだけある change に `--done` を実行する
- **THEN** REQ-012はテストの実施を確認できない要件として不足となり、ほかに実行エラーがなければ終了コード1になる

#### Scenario: レポートが書き出されない
- **WHEN** 前回のレポートが `tests.report` に残っていて、今回の test コマンドがレポートを書き出さない設定で `--done` を実行する
- **THEN** 「要件ごとのテスト」が不足になり、レポートが無い理由を残す。前回のレポートを今回の実施証拠にしない

### Requirement: 品質コマンドの実行
doneは設定済みcommandsのlint・typecheck・testを実行し、1つでも失敗したら不合格にする SHALL。verifyは全モードでloomake.config.jsonの未知キーをPASSのreasonと人向けの案内に残し、未知キーだけでは不合格にしない SHALL。未実施コマンドをPASSにしてはならず、REQ-191に従って扱う MUST。未知キーをwarnから案内へ移す変更はR-C001-08の未承認候補である。

Source: REQ-039

#### Scenario: コマンドが失敗する
- **WHEN** commands.testが終了コード1で終わる設定でdoneを実行する
- **THEN** command:testがFAILになり出力の末尾をreasonに含める

#### Scenario: すべて成功する
- **WHEN** 3つのコマンドがすべて終了コード0で終わり、必要な実施を照合できる設定でdoneを実行する
- **THEN** 3つのcommand検査がすべてPASSになる

#### Scenario: 知らないキーがある
- **WHEN** loomake.config.jsonにcomandsのキーがあるプロジェクトでloomake verifyを実行する
- **THEN** loomake.config.json検査のPASSのreasonと人向け案内にcomandsが残り、その未知キーだけでは終了コードは1にならない

### Requirement: 品質コマンドを省いたことの表示
doneで --skip-commandsを指定した場合、品質コマンドを実行しなかった項目をchecksへINSUFFICIENT_EVIDENCEとして記載し、前回レポートを当該実行の成功証拠に使わない MUST。reasonと人向け表示の最後に未実施と --skip-commandsなしでの再実行を案内する SHALL。ほかに実行エラーがなければlocal/ciとも終了コード1を返す MUST。旧skipが単独では失敗しなかった契約からの変更はR-C001-05・08の未承認候補である。

Source: REQ-191

#### Scenario: 完了ゲートで品質コマンドを省く
- **WHEN** verify --change <id> --done --skip-commandsを実行する
- **THEN** 品質コマンド項目は不足となり表示の最後の行に未実施と再実行を案内し、ほかに実行エラーがなければ終了コード1となる

#### Scenario: JSON で品質コマンドを省く
- **WHEN** verify --change <id> --done --skip-commands --jsonを実行する
- **THEN** checksに品質コマンドの不足と未実施理由を持ち、旧results/skipや古い成功レポートを今回の成功根拠にしない

#### Scenario: 品質コマンドを実行する
- **WHEN** --skip-commandsを付けずにverify --change <id> --doneを実行する
- **THEN** 省略による品質コマンド不足項目はなく、実際に実施した結果で判定する

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

### Requirement: quality.yamlの最小読取
verifyのchange必須ゲートはプロジェクトルートのquality.yamlを読み、既存のversion 2スキーマと既定値を適用する SHALL。YAML構文・型・対応版・対象外理由の不正はconfigのaborted、完了ゲートで必要なquality.yamlの不在や権限などの読取不能はruntime/permissionのabortedとする MUST。spec-onlyではquality.yamlの不在を許し品質構造検査を対象外とする SHALL。存在するファイルの不正や読取不能はspec-onlyでも同じabortedとする MUST。設定ファイル内容の誤り2と読取不能3を区別する MUST。既存導入へ最小ファイルの手動作成を案内する SHALL。

Source: REQ-310

#### Scenario: 最小入力と未知キー
- **WHEN** versionとmodelを持つ最小quality.yaml、および未知キーを含む入力を読む
- **THEN** スキーマの既定値を補い、未知値を失わず、空の評価対象を完了ゲートのPASSにしない

#### Scenario: 不正・不在・権限エラー
- **WHEN** YAML構文不正・version不正、完了ゲートのファイル不在、読取権限不足をそれぞれ発生させる
- **THEN** 前2者は終了コード2、不在・権限不足は終了コード3のabortedで返し、nextに設定の修正・最小ファイル作成・権限確認を示す


#### Scenario: 仕様ゲートにquality.yamlがない
- **WHEN** quality.yamlのないプロジェクトで既存changeの --spec-only を実行する
- **THEN** 品質構造検査を対象外とし、quality不在だけではabortedや品質不足を作らない。ほかの仕様検査の合否を保持する

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
verifyはciとlocalを明示して実行できる SHALL。scope省略時、doneはci、spec-onlyはlocalを既定にする SHALL。ciの完了ゲートはCI必須項目を含む全条件で集約し、localはローカル実施項目の完了だけを返す MUST。既存の合意・仕様整合性・未完了タスク・成功したID付きテスト・品質コマンド・安全制約の検査を省略または弱化しない MUST。--skip-commandsを実施済みの証明にせず、証跡のない項目は不足とする MUST。spec-onlyは仕様/構造検査だけをchecks/summaryに数え、品質targetと品質対象guardを生成しない SHALL。

Source: REQ-312

#### Scenario: bare verifyの品質専用経路
- **WHEN** changeを指定せずbare verifyを実行する
- **THEN** 品質コマンド専用のlocal結果をchange:null・verdictなしで返し、quality.yamlを新たに必須にしない。change必須ゲートの欠落と同一視しない

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

### Requirement: C-001の成功経路と不足拒否
verifyのCLIと関数APIは、最小quality.yamlから適格な実証跡に基づく正常なPASS、不正入力のaborted、証跡不足のINSUFFICIENT_EVIDENCEを区別して返す MUST。未実施・古い・旧形式・全NAからPASSを返してはならない MUST NOT。

Source: REQ-319

#### Scenario: 正常・不正・不足の受入
- **WHEN** 最小の適格な実証跡がある正常入力、不正設定、未実施または古い証跡を使って同じCLI/APIを検査する
- **THEN** 正常はciのPASS/0、不正はaborted/2または3、不足はINSUFFICIENT_EVIDENCE/1となる。成功例に手書きのok:trueや未照合の適格フラグを使わない

#### Scenario: 置き残した成功結果を拒否する
- **WHEN** 正常実行後に対象SHAや必須仕様を変え、古い成功結果だけで完了ゲートを実行する
- **THEN** ciのPASSを返さず、不足または対象未確定時のabortedを返す
