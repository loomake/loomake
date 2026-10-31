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

## ADDED Requirements

### Requirement: C-001の成功経路と不足拒否
verifyのCLIと関数APIは、最小quality.yamlから適格な実証跡に基づく正常なPASS、不正入力のaborted、証跡不足のINSUFFICIENT_EVIDENCEを区別して返す MUST。未実施・古い・旧形式・全NAからPASSを返してはならない MUST NOT。

Source: REQ-319

#### Scenario: 正常・不正・不足の受入
- **WHEN** 最小の適格な実証跡がある正常入力、不正設定、未実施または古い証跡を使って同じCLI/APIを検査する
- **THEN** 正常はciのPASS/0、不正はaborted/2または3、不足はINSUFFICIENT_EVIDENCE/1となる。成功例に手書きのok:trueや未照合の適格フラグを使わない

#### Scenario: 置き残した成功結果を拒否する
- **WHEN** 正常実行後に対象SHAや必須仕様を変え、古い成功結果だけで完了ゲートを実行する
- **THEN** ciのPASSを返さず、不足または対象未確定時のabortedを返す
