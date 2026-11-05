# Spec Delta

## ADDED Requirements

### Requirement: 手動の品質評価の実行
`loomake trace eval` は quality.yaml と設定済みの品質コマンドを読み、前回のテストレポートと `.loomake/coverage/coverage-summary.json` を消してからコマンドを一度実行する SHALL。REQ-442で許可する帳簿とロック以外に未コミットの変更があるとき、実行中に HEAD・基準・作業ツリーが変わるときは保存せず1を返す MUST。時間切れ・中断・実行不能は3、品質ファイルの誤りは2を返す MUST。履歴には保存せず、開始済みの失敗試行はREQ-441で記録する SHALL。

Source: REQ-429

#### Scenario: 実行した品質コマンドから評価する
- **WHEN** 作業ツリーがきれいで設定済みの品質コマンドを実行する
- **THEN** その実行の出力だけを評価し、品質判定が FAIL や証拠不足でも保存成功なら0を返す

#### Scenario: 未コミットの変更または実行中の変化がある
- **WHEN** REQ-442で許可する帳簿とロック以外に未コミットのファイルがある、または品質コマンドが HEAD・quality.yaml・作業ツリーを変える
- **THEN** 1を返し履歴と最新索引を変えない

#### Scenario: 品質ファイルがないか形が不正である
- **WHEN** quality.yaml がない、または版・構文・内容が不正である
- **THEN** 日本語の診断を出して2を返し、品質コマンドを実行せず保存しない

#### Scenario: コマンドを実行しきれない
- **WHEN** 品質コマンドが時間切れ・中断・起動失敗になる
- **THEN** 3を返しhistoryと索引を変えず、開始済みの試行をattemptsへ失敗の分類とともに残す。未実施を成功した測定にしない

### Requirement: 品質判定と利用時品質の分離
評価は kit の既存の四値判定と集約を使い、合格に必要な証拠と参考指標を分ける SHALL。製品品質から利用時品質の観測や PASS を推論せず、両者を別々に集計する MUST。blocking が true で PASS・NOT_APPLICABLE でない項目は blockingUnmet に残し、ほかの合格で相殺しない SHALL。

Source: REQ-431

#### Scenario: 製品品質が合格しても利用時品質は未評価である
- **WHEN** テスト結果を証拠にした製品品質と利用時品質があり、製品品質の証拠が満たされる
- **THEN** 製品品質は PASS になり、利用時品質には観測を作らず INSUFFICIENT_EVIDENCE と表示する

#### Scenario: エラー数の未評価をほかの合格で相殺しない
- **WHEN** blocking の error_count == 0 があり、lint は成功するが件数は取得できない
- **THEN** その項目は INSUFFICIENT_EVIDENCE で blockingUnmet に残り、参考指標や別項目の PASS で相殺しない

### Requirement: 品質評価の最新索引
`reports/quality/quality-report.json` は version:1、runId、attempt、evaluatedAt、evaluator、target、basis、commands、observations、subjects、summary、request（id・requestedAt・source）、period（kind・start・end）を持つ SHALL。periodは観測時刻のUTC暦日とする SHALL。各観測に source・evidence・observedAt を残す SHALL。履歴の追記確定後に最新索引を一時ファイルから置き換え、索引は履歴末尾の内容全体と一致する MUST。既存の quality-report JSON Schema を変更しない MUST。

Source: REQ-432

#### Scenario: 評価の出典と判定を保存する
- **WHEN** 評価結果を保存する
- **THEN** 対象コミット・品質基準のhash・コマンドの成否・観測時刻・品質別の判定をversion:1で保存し、既存coreスキーマに適合する

#### Scenario: 索引だけを保存できない
- **WHEN** 履歴への追記は成功するが最新索引の置き換えに失敗する
- **THEN** 履歴と古い索引を保持して2を返し、再実行による索引の復旧を案内する

### Requirement: 追記専用の品質履歴と回復
`reports/quality/history.jsonl` に評価を1行ずつ追記し、既存の行を変えない SHALL。同じ runId・attempt の組の重複だけを拒否し、同じコミット・同期間の別試行と翌期間の記録を保持する MUST。新実行は新runIdと同コミットのhistoryとattemptsを合わせた行数+1の単調増加するattemptを持つ SHALL。履歴の改行・JSON・構造・重複を先に検査し、不正なら2で止める MUST。索引が欠けるか履歴内の古い実行を指すときは、末尾から索引を復旧したあと、当該要求の評価を続ける SHALL。

Source: REQ-433

#### Scenario: 同じコミットで異なる試行を保持する
- **WHEN** 同じコミットを二度評価する
- **THEN** 別runId・attempt 1と2の2行を保持し、前の行を変更しない

#### Scenario: 二重の組と壊れた履歴を拒否する
- **WHEN** 同じrunId・attemptが二度ある、JSONや構造が不正、または末尾が改行で終わらない
- **THEN** 2を返し履歴と索引を変えない。同runIdでも別attemptの記録は重複扱いしない

#### Scenario: 追記途中の失敗では既存の行を保持する
- **WHEN** 追記または同期に失敗する
- **THEN** 自分が足した部分だけを元の長さへ戻して2を返す。戻せなければ不完全な末尾の可能性と手動復旧を案内し、以前の行を書き換えない

#### Scenario: 履歴から索引を復旧して評価を続ける
- **WHEN** 有効な履歴があり、索引がないか履歴中の古いrunId・attemptを指す
- **THEN** 末尾の評価から索引を復旧し、その要求の品質コマンドを実行して新たな評価を追記する

#### Scenario: 出どころが不明な索引は上書きしない
- **WHEN** 索引が読めないか、そのrunId・attemptが履歴にない
- **THEN** 2を返して索引と履歴を保持し、黙って評価を続けない

### Requirement: 評価の直列化とロック所有権
評価は `.loomake/quality/eval.lock` を排他的に作って直列化する SHALL。既存ロックがあればREQ-439の待機に入り、既存ロックを変更・削除しない MUST。保存前に自tokenを確認し、他tokenならhistory・attempts・索引へ書かず3を返し、開始済みの試行を次の正当な実行者の回収対象として保持する MUST。成功・失敗のどの経路でも自分が作った同じtokenのロックだけを片付け、他tokenへの置き換えや古いロックを自動で削除しない MUST。保存先とロックのパスに通常のディレクトリ・ファイル以外があれば2を返す SHALL。

Source: REQ-434

#### Scenario: 他実行のロックを保つ
- **WHEN** ロックがすでにある
- **THEN** REQ-439の待機に入り、既存ロックの内容と更新時刻を変えない

#### Scenario: 自分のロックを片付ける
- **WHEN** 自分の評価が成功、汚れによる1、入力不正による2、実行不能による3のいずれかで終わる
- **THEN** 自tokenのロックを削除し、置き換わった他tokenは残す

#### Scenario: 保存先がリンクである
- **WHEN** ロックまたは出力先の途中にシンボリックリンクがある
- **THEN** 2を返し、リンク先のデータを変更しない

### Requirement: 手動品質評価のCLI
CLIは `trace eval` とそのhelpを受け付ける SHALL。evalは固有オプションを取らず、不明なオプションは2で拒否する MUST。操作一覧の既存順を保ってevalを最後に追加し、打ち間違いの候補と生成CLIリファレンスへ反映する SHALL。

Source: REQ-437

#### Scenario: ヘルプと打ち間違い
- **WHEN** trace eval --help または trace evl を実行する
- **THEN** evalの説明を表示し、evlにはevalの候補を示す

#### Scenario: 併用できないオプション
- **WHEN** trace eval --xを実行する
- **THEN** 日本語で使い方の誤りを示して2を返す

### Requirement: 従来のレポートと公開契約の保持
`trace report --change` の入力・出力・終了コードと、change必須の条件を維持する MUST。既存の公開8種類のJSON Schemaと品質リファレンスの生成物を変えず、既存依存の範囲を維持する MUST。

Source: REQ-438

#### Scenario: 従来のリリースレポートを生成する
- **WHEN** trace report --changeを実行する
- **THEN** 従来と同じ引数でリリースレポートを生成する。evalではリリースレポートを呼ばない

#### Scenario: JSON契約と依存を保持する
- **WHEN** 公開JSONのhash・生成一致・依存範囲を検査する
- **THEN** 既存の検査が成功し、リリースレポートのschemaVersion:2を維持する

### Requirement: 手動評価要求の受付と順番待ち
`loomake trace eval` は評価前に要求ID・対象コミット・品質基準のhash・要求時刻・起動元を `reports/quality/requests.jsonl` へ受付として追記し、`.loomake/quality/queue/<要求ID>.json` の待機票を保つ SHALL。実行中の評価があれば、台帳の受付順に1件ずつ `.loomake/quality/eval.lock` を得るまで待ち、常駐プロセスと新しいCLIオプションを加えない MUST。台帳の読取と追記は自tokenを持つ `.loomake/quality/ledger.lock` で直列化する SHALL。待機中にHEADまたは基準が受付時と変われば、回収不能を記録して1を返す MUST。ledger.lockが10秒取得できなければ自動削除せず3を返し、手動確認を案内する MUST。受付前なら台帳に要求を登録せず、受付後なら既存の受付とstartedを残して次の実行者による回収対象とし、未記録や消失を正常完了としない MUST。

Source: REQ-439

#### Scenario: 実行中1件と待機2件を受付順に実行する
- **WHEN** 同じリポジトリで評価の実行中に、さらに2つのtrace evalを順に起動する
- **THEN** 3件の受付が台帳に記録され、待機2件は受付順に実行され、各要求に評価済みの記録が1つずつ残る

#### Scenario: 待機中に対象が変わる
- **WHEN** 待機中にHEADまたは品質基準のhashが変わる
- **THEN** その要求を理由head-changedまたはbasis-changedの回収不能として記録し1を返し、品質コマンドを実行しない

#### Scenario: 台帳が不正である
- **WHEN** requests.jsonlの末尾に改行がない、JSONが不正、または同じ要求IDの受付や終端が重複する
- **THEN** 2を返し、受付を追記せず台帳を変更しない

#### Scenario: 短時間ロックが取得できない
- **WHEN** ledger.lockを10秒取得できない
- **THEN** 3を返して他tokenのロックを保持する。受付前なら未受付、受付後なら台帳の要求を消さず回収待ちとして保持する

### Requirement: 評価要求の取消・回収と状態の追跡
すべての受付済み要求は、評価済み・再評価待ち・取消・回収不能のいずれかへ追記専用のイベントで到達する SHALL。待機中または実行中の最初の中断では取消を記録して3を返し、手動の取消は終端とする MUST。待機票は1秒ごとに更新し、15秒以上更新のない待機要求とロックのない実行中の要求を、実行権を持つ次の評価だけが放棄として再評価待ちへ記録する SHALL。他の要求のロック・待機票・行を削除しない MUST。再評価待ちの要求は同じコミットと基準の後の成功評価を参照して解消し、元の要求時刻を履歴の評価時刻や観測時刻にしない MUST。対象が現在のHEADまたは基準と異なれば回収不能を記録する SHALL。取消や回収の追記がロック取得不能で書けなかった場合も、既存の受付またはstartedを正本として残し、次の実行者が放棄を記録する MUST。

Source: REQ-440

#### Scenario: 待機中に取り消す
- **WHEN** 待機中のtrace evalに中断を1回送る
- **THEN** cancelled（phase waiting・合図名）を記録して3を返し、自分の待機票を消し、ほかの待機者の順番を保つ

#### Scenario: 待機者が強制終了される
- **WHEN** 待機中のプロセスが後片付けなしに終わる
- **THEN** 後続は待ち続けず、次の実行者がabandonedと再評価待ちを記録し、同条件で成功したらreevaluatedで今回のrunIdとattemptを参照する

#### Scenario: 実行者の強制終了とロックの手動削除
- **WHEN** 実行中のプロセスが強制終了され、残ったロックを利用者が消してから次の評価が実行される
- **THEN** 失敗試行crashedを記録し、元の要求を再評価待ちまたは回収不能にし、履歴へ重複行を書かない

### Requirement: 失敗試行の追記
実行IDと試行番号を得たあとに履歴へ記録できなかった試行は、実行権を持つ者が `reports/quality/attempts.jsonl` に実行ID・試行番号・要求ID・対象・基準・結果・失敗の分類・要約への参照を1行ずつ追記する SHALL。分類はdirty・changed・timeout・interrupted・launch・save・crashedとする SHALL。後の成功で失敗行を消さず、同じ対象コミットと基準の後の成功の有無で未解決と解決済みを区別し、失敗の存在だけで判定を変えない MUST。同じrunIdとattemptの組はattempts内とhistoryとの間で一意にする MUST。実行権のtokenを失った試行は自分で追記せず、残ったstartedから次の正当な実行者が回収する MUST。

Source: REQ-441

#### Scenario: 失敗後に成功する
- **WHEN** 時間切れで失敗したあと、同じコミットと品質基準で評価が成功する
- **THEN** attemptsの失敗行は残って解決済みに区別され、新しい評価は別の試行番号で履歴に入る

#### Scenario: 二重の取り込みを防ぐ
- **WHEN** 履歴追記後、評価済みのイベントの前に実行者が止まる
- **THEN** 次の評価は既存の履歴行から評価済みを補い、historyとattemptsに同じ組を追加しない

#### Scenario: 同期間と翌期間の評価を保持する
- **WHEN** 同じコミットと基準を同じUTC暦日に二度、その翌日にもう一度評価する
- **THEN** 3試行と2つの観測期間を保持し、索引だけを最後の評価へ更新する

### Requirement: 評価の帳簿と作業ツリーの検査
作業ツリー検査では、`.loomake/quality/` の決まったロックとUUID名の待機票の未追跡ファイル、およびHEAD版を先頭にそのまま含む `reports/quality/` のrequests・attempts・historyの3つのjsonlと、構造検査済みでステージしていない最新索引だけを許可する SHALL。ほかの変更、ステージ済み、削除、名前の変更は汚れとして1を返す MUST。品質コマンド前後でhistory・attempts・最新索引のバイト列を同一に保ち、requestsは他要求の正しいイベントの追記だけを許す MUST。評価のためにコミットやステージを作らない MUST。

Source: REQ-442

#### Scenario: 前の評価の未コミットの帳簿がある
- **WHEN** 前の評価が帳簿を追記または索引を置換し、まだコミットしていない
- **THEN** 次の評価は有効な追記と索引を汚れとみなさず実行する

#### Scenario: 帳簿の既存の行が書き換えられている
- **WHEN** historyのHEAD版の行が作業ツリーで変更されている、または品質コマンドが帳簿を変える
- **THEN** 1を返して履歴へ保存せず、自tokenの実行権があれば失敗試行dirtyまたはchangedを記録する
