# Design: verify-v2-quality

## 位置づけ

親changeの設計「2. quality入力と限定条件」「3. 実証跡と正常PASSの停止点」のうち、S1を除いた最小接続を作る。S1の判定moduleはこの子changeのadapterを再利用する（design-step8b、S1の位置の節）。そのためadapterはファイル・プロセス・時計を読まない純関数に分け、I/Oは `runVerify` が受け持つ。

## 1. レポートの読取（core）

`parseTestReport(file, text)` は、Vitest（Jestと同じ形式）のJSONレポートから、テストごとに `file`・`fullName`・`status`・要件IDを返し、最上位の `startTime` も返す。statusはpassed・failed・skipped・todo・pending・その他に分ける。形の検査は既存の `extractTestRequirements` と共通にし、既存関数の結果（passedだけを数えるcoverage）は変えない。

## 2. adapter（kit、純関数）

`observeTestReport(quality, receipt)` は、qualityの適用対象のうち、`source: ci.test_report` の必須証拠（evidence）ごとに `QualityObservation` を1つ返す。receiptは `runVerify` が集めた次の事実である。

| 項目 | 中身 | 照合 |
|---|---|---|
| producer | 解決できたテストランナーの名前と版 | vitestかjestで、版が `x.y.z` の形。解決できなければ適格性なし（ineligible） |
| target | 品質コマンドの前後の `git rev-parse HEAD` | 両方あり、同じ。取れなければ未照合、違えば古い |
| basis | 前後の基準のhash（quality.yaml・差分仕様・trace.md） | 同じ。違えば古い |
| invocation | 品質コマンドの開始と終了の時刻、レポートを事前に消したか | レポートの `startTime` が開始から終了の間にある。事前に消していない、`startTime` がない、範囲外は古いか未照合 |
| report | パス、本文、sha256 | 不在は未実施。本文から計算したsha256が渡されたsha256と違えば未照合。読めない・形が違う、テストが0件でファイル単位のstatusがfailedのファイル（読み込みの失敗）があるときも未照合 |
| required | 必須の要件ID（差分仕様のADDED・MODIFIEDのSource） | 空なら取得不能 |

metricは `required_subjects_with_failed_tests` だけを扱う。値は「必須の要件のうち、実施されたfailedのテストを持つものの数」。samplesは必須の要件を名前に持つpassedかfailedのテストの、重複のない数（観測の識別は report hash・ファイル・fullName）。skip・todo・pendingは実施に数えない。必須の要件のどれかに実施されたテストがなければ incomplete（不足）にする。ただし、すでに数えたfailedだけで目標の違反が確定するとき（`<=`・`==` で値が上限を超える、`<` で上限以上）は、その値で measured を返し、既存の判定がFAILを優先する。ほかのmetricと、quality.yamlにないsourceの観測は作らない（判定は「観測がありません」の不足になる）。

hash関数は呼び出し側が渡す（policyの純粋性規則のため）。`observeTestReport(quality, receipt, { sha256Hex })` の第3引数は省略できない。kitは `node:crypto` を使う `sha256Hex` を `verify/hash.ts` に置き、2本目の接続で `runVerify` が渡す。

観測のevidenceには `report:sha256:…`・`basis:sha256:…`・`target:<SHA>`・`producer:<名前>@<版>` を入れる。適格でない理由は `detail` に書き、checkのreasonに出す。

## 3. runVerifyへの接続

| ゲート | quality.yamlがない | 不正・読取不能 | 品質のcheck |
|---|---|---|---|
| spec-only（local） | 何もしない | aborted（config 2、runtime・permission 3） | 足さない（R-C001-10 A） |
| done・local | 何もしない | 同上 | 足さない（確認事項 Q-01） |
| done・ci | aborted（runtime 3） | 同上 | `quality:subjects` と `quality:<ID>` を足す |
| changeなし | 読まない（R-C001-01 A） | ― | 足さない |

quality.yamlは、changeのディレクトリがあるときだけ、品質コマンドやopenspec validateより前に読む。changeがないときは既存の「change の存在」の不合格（1）を保つ。abortedは例外にせず、`run.status: aborted` の結果を返す。

doneのciでは品質コマンドの前にHEADと基準のhashを取り、レポートを消してから実行し、あとでHEAD・hash・レポートを読み直してreceiptを作る。`--skip-commands` のときはreceiptを作らず、観測は未実施（not_run）になる。

kitはzodを読まない（REQ-284・REQ-047）。`runVerify` は同期のままにし、呼び出し側が `await loadVerifyQualitySchema()` で読んだスキーマを `qualitySchema` に渡す。quality.yamlを解析する必要があるのに渡されていなければ、使い方の誤り（UsageError）にする。CLI・runner・trace recordは常に渡す。

## 4. 試験

- adapter：正常・producer不明・SHA不一致・SHAなし・基準の変化・置き残し（事前に消していない、`startTime` が範囲外）・skip/todo・failed・min_samples・違反の確定・純粋性
- API/CLI統合：gitの一時リポジトリで実際のVitestを動かし、正常PASS/0、quality.yamlの不正2・不在3・権限3、不足1、置き残した古い結果の拒否（SHAと必須仕様を変えたあと）
- 既存試験：期待値は変えない。doneのciを使う試験の準備に、quality.yaml・git・producerを足す
