# Design: verify-v2-c001

## Context

基準はmain `f397109`。動機と能力の範囲はproposalを参照する。`runVerify` は同期のI/O統合であり、現在はquality.yamlを読まず1.0.0の `ok/results/coverage` を返す。CLIは設定の読取不能もUsageErrorへまとめ、`--json` の引数エラーを結果JSONにできない。ci-gateは終了コード、runnerは `ok/results`、traceは埋め込まれた同じ型とcoverageに依存する。

共有品質4値と純粋集約はPR #138で受入済み。#60の未知フィールド保持修正（REQ-307）は未受入の依存で、スキーマ利用を増やす実装はその受入後とする。既存の事前工数推定は `docs/effort/c-001.md` に固定されており書き換えない。

## Goals / Non-Goals

C-001の正常・不正・不足の区別と自己完了ゲートを維持したまま、公開側・利用側を一体で移す。既存の合意・タスク・要件ID対応・入力予算・コマンド実行予算・中断・文書hash・追記保存を保持する。

C-003で完成する全providerの実レポート取得、版/SHA/環境/時刻の適格性と実施確認、partial経路と禁止フィールドの網羅試験を、この計画だけで完成扱いにしない。成功経路のためC-001へ先行させる最小取得範囲はR-C001-03で決める。未接続のsource/metric、参考指標、古い結果はPASSへ上げない。31副特性init、eval・telemetry・履歴の長期保管、runnerのCI取得とready化全体は範囲外。

## Decisions

### 1. 公開APIとscopeの具体案

kitの `runVerify(options)` の名前と同期実行は維持し、戻り値を2.0.0へ切り替える。`VerifyOptions` に `scope?: 'local' | 'ci'` を追加する。CLIは `--scope local|ci` を追加し、doneはci、spec-onlyはlocalを既定にする。bare verifyはR-C001-01がAならlocalの品質コマンド専用として維持し、quality.yamlを新たに要求しない。Bなら品質専用代替（案：`verify --quality-only`）も同じ差分仕様で定義してから実装する。

実行環境のCI変数からscopeを推測する案は使わない。利用側がscopeを明示でき、runnerのローカル完了とci-gateの最終合格を取り違えにくいため。APIの不正な引数・設定・読取失敗もv2のabortedを返し、CLIと同じ純関数 `verifyExitCode(result)` で0〜3を選ぶ。progressと人向けformatterはstderrへ送り、JSON出力へ混ぜない。verify以外のUsageError/RuntimeFailure契約は変えない。

`--spec-only` は現在の仕様検査を維持し、quality.yamlの構造と既定値も確認する。target充足や品質成果物の実施を仕様ゲートで要求せず、構造検査が通ったことを品質PASSとして保存しない。localの検査完了を返す。`--skip-commands` は既存の呼出し方を残すが、未実施や古い証跡を成功へ昇格させない。

### 2. quality入力と限定条件

kitの既存yaml依存でrootのquality.yamlを読み、coreのloaderとversion 2を使う。入力予算・リンク制約は既存InputReaderを使う。キーの既定値はcoreだけで補い、環境変数やAGENTSから拾わない。必要ファイルの不在は読取不能のruntime/3、権限不足はpermission/3、構文・型・未対応版・NA必須値の不正はconfig/2とする。既存loomake.config.json省略時の既定値は維持するが、存在する設定の読取不能は3へ分ける。

新規導入・既存導入に最小例（version、model、品質項目と証拠条件）と手動配置の案内を用意する。空の最小例も構造としては読めるが、空や全NAでdoneのPASSにしない。#66の全面init生成を待たず、既存ファイルを自動上書きする方法も採らない。

純粋判定 `evaluateQualityConditions` の入力はqualityと、別段階で適格性/実施を照合した観測結果。比較値は有限数値、比較演算子は既存5種とし、min_samplesを満たす必要証拠を全件照合する。証拠ごとに未定義・未取得・未実施・未照合・不足を区別し、適格な証拠で確認できた必須条件の違反が1件でもあればFAILを優先する。FAILがなければ不足を優先する。NA理由と確認者はスキーマと判定境界で確認する。集約は既存 `aggregateCiVerdict` を使う。自動実行条件・版・適格性の確認を飛ばして最終合格を作らない。

### 3. 実証跡と正常PASSの停止点

実装範囲を勝手に不足拒否だけへ狭めない。R-C001-03のA案は、現在の品質コマンドとVitest/Jestの成功ID抽出を使う最小adapterを先行させる案である。古いレポートを実行前に除き、その実行で取得したレポートを読む。対象SHAを前後で照合し、実コマンド・ツール版・環境・時刻・レポートhash・基準と検証方法のhashを観測事実として記録する。skip/todo/失敗を成功に数えず、要求REQとの対応がある成功だけを限定条件へ渡す。全成功であっても版・SHA・環境・手順・鮮度を照合できない入力は不足にする。コマンドexit 0だけを証拠にせず、手書きのeligible:trueも受け付けない。

この先行adapterが担うsource/metricはO01の一般名前空間全体の確定と分け、対象となる指標・対応するquality項目・期待targetをR-C001-03回答時に差分仕様へ追記する。例示の `ci.test_report` を無条件に実装済みの接続とは扱わない。鮮度条件と信頼する基準の取得元も受入例に必要な範囲を固定する。

B案はC-003との循環依存を避けるため、取得/適格性とC-001の公開側/利用側を並行準備し、必要範囲を合同受入する計画へ変える。どちらも正常PASSの統合試験と通常の自己完了ゲートを必須とする。いまはA/Bと必要条件が未確定なので、実装禁止。C-001のDoDを満たせない範囲を完了として受け入れない。

### 4. JSON・型・埋め込みの移行

verifyは2.0.0、Evidenceは2へ上げる。Evidence 1の必須verifyが旧構造であり、型とJSON Schemaをそのまま変えると旧データを読めなくするため、Evidenceにも形式変更を明示する。履歴用 `LegacyVerifyResult`・`LegacyEvidence` と各schema/loaderを別名で残し、旧verify fixture、旧Evidence、documents省略を改変しない。現行の書き出しへ旧版を混ぜない。VerifyModeは既存のモード入力型として維持する。REQ-040が要求する要件→成功テストファイル一覧は、completed/partialの任意coverageとして保持しReportの既存行へ投影する。abortedへ一覧を補わない。これは将来の追加フィールドではなく現行公開契約の維持である。新チェック型・実行エラー型・scope型はスキーマから導出する。

ci/localのcompleted/partialとabortedの5形をスキーマで区別する。abortedはschemaVersion/change/runだけ、localにはverdictがない。未知キーの許容と既知禁止キーの拒否を区別し、REQ-307の安全な保持経路を使う。C-001ではcompletedとabortedと最低限の禁止キーを試験し、partial取得経路と全禁止キーの網羅をC-003へ残す。新しい2.0.0だけをスキーマに置いて実出力を1.0.0に据え置く移行はしない。

Reportは既存の2を維持する。新しい実行状態フィールドは追加しない。checkのID・理由と、その実行の成功テスト対応を既存ReportRow・failedChecksへ投影する。証拠にないテスト対応は作らず「合格したテストなし」とする。evidence.okはその記録の実施結果を投影した表示値で、現在の再利用可否を表さない。local/旧形式は既存warningsで最終CI合格ではないこと・履歴閲覧専用を説明し、どの自動ゲートもReport.evidence.okを合格APIとして使わない。abortedはok:falseと理由を投影する。Reportの日時・文書snapshot・既存日本語結果は保持する。

### 5. 利用側を同じchangeで追従

| 利用側 | 変更案 | 保持する制約 |
|---|---|---|
| CLI | scope・JSONのaborted・verifyExitCodeを使う | stdout JSONのみ、stderr日本語診断、非対話 |
| ci-gate | --scope ci --done --jsonを実行しv2の構造・decision/verdictを確認 | 対象change選択、全タスク、全必須テスト。local・旧ok・skip/neutralで合格にしない |
| runner | spec-only/local、done/localを明示しdecision.requiredで停止 | HEAD変更・中断・予算の順序、Draft PRまで。RunSummary外形は維持 |
| trace record | RecordOptions.scopeとCLI --scopeを追加（既定ci）、runnerはlocalを渡す | snapshot・検査前後照合・未コミット拒否・追記専用・同じ0〜3 |
| trace report | 旧/newを版別に読み既存Report 2へ投影 | 同期・オフライン・保存済み文書・既存行結果 |

runのlastVerify.okはlocal項目の完了を表す既存表示へ投影し、CI最終合格と呼ばない。decision.requiredとFAILが同時なら両方を記録し、自動修正に進まない。ci-gateで通常の終了コード0だけを見てローカル結果を合格にする互換処理は置かない。

### 6. 形式版とパッケージ版

| 対象 | 版変更案 | 根拠 |
|---|---|---|
| verify JSON | 1.0.0 → 2.0.0 | mode/ok/resultsからrun/scope/checks/summary/decision/verdictへの非互換変更 |
| Evidence | 1 → 2 | 必須verifyの埋め込み型が変わる |
| Report | 2維持 | 既存フィールドへの投影で外形を維持できる |
| core | minor | VerifyResult・VerifyCheckResult・Evidenceと定数の公開契約変更 |
| kit | minor | runVerifyの戻り値と設定読取失敗の意味が変わる |
| trace | minor | 再exportのEvidence・RecordOptions callbackの結果型と記録形式が変わる |
| loomake | minor | verifyのJSONと設定読取失敗の終了コード変更 |
| runner | patch | 公開RunSummary・RunOptionsを変えず内部の利用側を追従する |

古いJSONの `.ok` を読む利用者は版分岐と `verifyExitCode` またはv2のscope/decision/verdictへ移す。設定構文2・読取不能3の前後例をchangesetと互換性文書へ書く。履歴閲覧と新しい自動判定を分け、旧fixtureを新形式へ書き換えて試験を通さない。

## Risks / Trade-offs

- 正常PASSの取得範囲がC-003と重なる → R-C001-03の回答とID付き受入例を先に固定する。C-001の成功経路とDoDを削らない。
- bare verifyの既存契約と7.3のchange未指定が衝突する → R-C001-01未回答のため実装全体を止める。
- summary.evaluatedの分母が不明 → R-C001-02で外部意味を決め、集約値とは別に検査する。
- 新旧証拠の型を混ぜると旧PASSを再利用する → 履歴専用型・loaderを分離し、gate/runnerで旧版とlocalを拒否する。
- v2移行で既存検査が抜ける → 既存期待値・skip・lint/型/テスト設定を緩めず、既存回帰と配布試験を通す。

## Migration Plan

#60受入と質問3件の回答を確認し、差分仕様・trace・tasksを更新してstrictと仕様ゲートを通す。回答を反映し依存受入と仕様ゲート成功を確認したら、既存のdelivery指示に基づきapplyへ進み、型と履歴fixture、純粋判定、最小の適格な取得、CLI、全利用側の順で実装し、同じPRで切り替える。公開前に通常の完了ゲートと最終headのCI・配布検証を確認する。

戻す場合は公開側・利用側を同じ単位で戻し、既に追加したv2証拠や旧fixtureを消さない。旧版へ戻した環境で新証拠を1.0.0に読み替えず、未対応版として止める。計画だけのPRではchangesetの実バージョン切替や製品コードを変更しない。

## Blocking Questions

未回答のR-C001-01〜03はtraceに選択肢・おすすめ・止まる範囲を記した。いずれも採用済みの技術判断ではない。scopeの明示方法、同期APIの維持、Report投影、初期qualityの手動配置、内部の責務分離はレビュー可能な技術案であり、人に追加の仕様決定を求める項目とは区別する。
