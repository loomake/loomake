# Design: verify-v2-c001

## Context

branch作成時の基準はmain `f397109`、製品調査の基準はmain `f4e3edb7145f35dac49fd139902ab17c5592a5d5`で、この計画branchの製品コードは更新していない。動機と能力の範囲はproposalを参照する。`runVerify` は同期のI/O統合であり、現在はquality.yamlを読まず1.0.0の `ok/results/coverage` を返す。CLIは設定の読取不能もUsageErrorへまとめ、`--json` の引数エラーを結果JSONにできない。ci-gateは終了コード、runnerは `ok/results`、traceは埋め込まれた同じ型とcoverageに依存する。

共有品質4値と純粋集約はPR #138で受入済み。#60の未知フィールド保持修正（REQ-307）はbranch作成時には未受入と記録したが、PR #140・#141で修正と仕様反映・archiveを受け入れ、現在はclose済みでmain `f4e3edb`に含まれる。実装停止はR-C001-01〜10の未回答と仕様ゲートによる。既存の事前工数推定 `docs/effort/c-001.md` は変更しない。

追加の全A案は[design-candidate-a.md](design-candidate-a.md)へ分離した。同文書は人の採否を得るための未承認候補であり、現行仕様や回答記録を採用済みに変えない。Bがあれば該当部分を再設計する。

## Goals / Non-Goals

C-001の正常・不正・不足の区別と自己完了ゲートを維持したまま、公開側・利用側を一体で移す。既存の合意・タスク・要件ID対応・入力予算・コマンド実行予算・中断・文書hash・追記保存を保持する。

C-003へ残る全providerの取得、完全なhost隔離、広いCI成果物・再利用連鎖、最小接続以外のpartial経路と禁止フィールドの網羅試験を、この計画だけで完成扱いにしない。A案の最小接続自体の適格性・実施確認と必要なpartial分類はC-001内で成立させる候補とする。成功経路のためC-001へ先行させる最小取得範囲はR-C001-03で決める。未接続のsource/metric、参考指標、古い結果はPASSへ上げない。31副特性init、eval・telemetry・履歴の長期保管、runnerのCI取得とready化全体は範囲外。

## Decisions

### 1. 公開APIとscopeの具体案

kitの `runVerify(options)` の名前と同期実行は維持し、戻り値を2.0.0へ切り替える。`VerifyOptions` に `scope?: 'local' | 'ci'` を追加する。CLIは `--scope local|ci` を追加し、doneはci、spec-onlyはlocalを既定にする候補とする。ローカルDoDはR-C001-06のAなら `--done --scope local`、最終受入は `--done --scope ci` と必須CIで分ける。Bならローカルでもci証拠取得を準備する。既存AGENTSの規定をこの計画だけで変更したとは扱わない。bare verifyはR-C001-01がAならlocalの品質コマンド専用として維持し、quality.yamlを新たに要求しない。Bなら品質専用代替（案：`verify --quality-only`）も同じ差分仕様で定義してから実装する。

実行環境のCI変数からscopeを推測する案は使わない。利用側がscopeを明示でき、runnerのローカル完了とci-gateの最終合格を取り違えにくいため。APIの不正な引数・設定・読取失敗もv2のabortedを返し、CLIと同じ純関数 `verifyExitCode(result)` で0〜3を選ぶ。progressと人向けformatterはstderrへ送り、JSON出力へ混ぜない。verify以外のUsageError/RuntimeFailure契約は変えない。

`--spec-only` は現在の仕様検査を維持し、R-C001-07のA候補では存在するquality.yamlの構造と既定値も確認し、不在だけは対象外とする。target充足や品質成果物の実施を仕様ゲートで要求せず、構造検査が通ったことを品質PASSとして保存しない。R-C001-10のA候補では品質targetやquality:subjectsを生成・計数せず、仕様/構造検査だけをchecks/summaryへ載せ、localの検査完了を返す。`--skip-commands` の呼出し方は残すが、R05/R08の候補では未実施を不足/1にする。これは旧REQ-191のskip単独成功からの非互換変更であり、採否前に実装しない。

### 2. quality入力と限定条件

現在のkitの実行時依存はcoreだけで、yamlは未追加である。REQ-047の許容範囲でyamlとlockfileの変更を提案し、rootのquality.yaml読取にcoreのversion 2スキーマを使う。入力予算・リンク制約は既存InputReaderを使う。キーの既定値はcoreだけで補い、環境変数やAGENTSから拾わない。R-C001-07のA候補ではspec-onlyのquality不在を除き、必要ファイルの不在は読取不能のruntime/3、権限不足はpermission/3、構文・型・未対応版・NA必須値の不正はconfig/2とする。既存loomake.config.json省略時の既定値は維持するが、存在する設定の読取不能は3へ分ける。

R-C001-07のA候補では、[初期品質と切替手順](design-candidate-a.md#初期品質と切替手順)のci.test_report 1必須項目をv2切替前に配置し、各changeの承認REQ集合とplanへ結び付ける。切替当日の全open PRを棚卸し、実装済みPRはmain取込・最新headの新鮮な実証跡・新ゲート成功を確認する。計画Draftや証拠未取得PRを一括合格にせず、未移行PRのマージを止める。新規導入・既存導入に最小例（version、model、品質項目と証拠条件）と手動配置の案内を用意する。空の最小例も構造としては読めるが、空や全NAでdoneのPASSにしない。#66の全面init生成を待たず、既存ファイルを自動上書きする方法も採らない。

純粋判定 `evaluateQualityConditions` の入力はqualityと、別段階で適格性/実施を照合した観測結果。比較値は有限数値、比較演算子は既存5種とし、min_samplesを満たす必要証拠を全件照合する。証拠ごとに未定義・未取得・未実施・未照合・不足を区別し、適格な証拠で確認できた必須条件の違反が1件でもあればFAILを優先する。FAILがなければ不足を優先する。NA理由と確認者はスキーマと判定境界で確認する。集約は既存 `aggregateCiVerdict` を使う。自動実行条件・版・適格性の確認を飛ばして最終合格を作らない。

### 3. 実証跡と正常PASSの停止点

実装範囲を不足拒否だけへ狭めない。全A案のsourceは `ci.test_report`、metricは `required_subjects_with_failed_tests`、例のtargetは `== 0`とする未承認候補である。source/metric、計画のversion・required_by・承認済みspec/REQ集合、producer/versionと実効method、対象SHA・環境・同一invocationの鮮度を[詳細候補](design-candidate-a.md)に示す。既存のqualityスキーマにrequired_byや適格性の意味が実装済みとは扱わない。

有効な実施failedと、missing・skip・todo・未取得・未照合を分ける。比較は既存5演算子を保ち、未完の集計値や暫定0からFAIL/PASSを作らない。適格な実施違反が確立したときだけFAILを優先する。gateのPASSで品質対象0・全NA・証拠空がPASSにならないよう、REQ-314の品質対象専用guardを全checksの件数に含める案を具体化する。

S1の信頼するbase-built checkerを準備し、S2のCLI/APIはその判定moduleを直接load/callする候補とする。locator/env・祖先関係・handoff内の自己申告hashでは信頼を与えない。独立したS1承認と基準側由来のexpected anchorを照合し、独立したfresh Tを権威としてtarget Sとの一致を検査する。S/Tはtrusted coreのexact `2.0.0`スキーマで解析する。R-C001-06のA候補ではローカルDoDの `pnpm -s verify --change verify-v2-c001 --done --scope local` と、最終CIの `--done --scope ci` によるPASS・要判断なし・exit 0を両方要求する。local 0や独立checkerだけでは最終CIを代替しない。Bなら既定doneで同じci条件をローカルにも要求する。

source/metric・verification.yaml・producer mappingはR-C001-03、S1準備・private handoffはR-C001-04のA候補であり、未承認である。10質問の回答・採用内容の差分仕様反映・仕様ゲートexit 0前は実装しない。B案では依存順と必要範囲を再設計し、正常PASS・元のDoDを削らない。required-checkや公開・権限設定の操作は、実装・検証後の具体対象について個別承認を得るまで行わない。

### 4. JSON・型・埋め込みの移行

verifyは2.0.0、Evidenceは2へ上げる。Evidence 1の必須verifyが旧構造であり、型とJSON Schemaをそのまま変えると旧データを読めなくするため、Evidenceにも形式変更を明示する。履歴用 `LegacyVerifyResult`・`LegacyEvidence` と各schema/loaderを別名で残し、旧verify fixture、旧Evidence、documents省略を改変しない。R-C001-09のA候補では旧verify/evidenceのJSON Schemaを版付きの追加パスとexportsで公開し、既存のunversionedパスは現行版へ移す。Bなら旧JSONを配布しない非互換性を説明する。現行の書き出しへ旧版を混ぜない。VerifyModeは既存のモード入力型として維持する。REQ-040が要求する要件→成功テストファイル一覧は、completed/partialの任意coverageとして保持しReportの既存行へ投影する。abortedへ一覧を補わない。これは将来の追加フィールドではなく現行公開契約の維持である。新チェック型・実行エラー型・scope型はスキーマから導出する。

ci/localのcompleted/partialとabortedの5形をスキーマで区別する。abortedはschemaVersion/change/runだけ、localにはverdictがない。未知キーの許容と既知禁止キーの拒否を区別し、REQ-307の安全な保持経路を使う。C-001ではcompleted・aborted・最低限の禁止キーと、採用した最小接続の部分取得失敗を試験する候補とする。その他のpartial取得経路と全禁止キーの網羅はC-003へ残す。新しい2.0.0だけをスキーマに置いて実出力を1.0.0に据え置く移行はしない。

Reportは既存の2を維持する。新しい実行状態フィールドは追加しない。checkのID・理由と、その実行の成功テスト対応を既存ReportRow・failedChecksへ投影する。証拠にないテスト対応は作らず「合格したテストなし」とする。evidence.okはその記録の実施結果を投影した表示値で、現在の再利用可否を表さない。local/旧形式は既存warningsで最終CI合格ではないこと・履歴閲覧専用を説明し、どの自動ゲートもReport.evidence.okを合格APIとして使わない。abortedはok:falseと理由を投影する。Reportの日時・文書snapshot・既存日本語結果は保持する。

### 5. 利用側を同じchangeで追従

| 利用側 | 変更案 | 保持する制約 |
|---|---|---|
| CLI | scope・JSONのaborted・verifyExitCodeを使う | stdout JSONのみ、stderr日本語診断、非対話 |
| ci-gate | --scope ci --done --jsonを実行しv2の構造・decision/verdictを確認 | 対象change選択、全タスク、全必須テスト。local・旧ok・skip/neutralで合格にしない |
| runner | spec-only/local、done/localを明示しdecision.requiredで停止 | HEAD変更・中断・予算の順序、Draft PRまで。RunSummary外形は維持 |
| trace record | RecordOptions.scopeとCLI --scopeを追加（既定ci）、runnerはlocalを渡す | snapshot・検査前後照合・未コミット拒否・追記専用・同じ0〜3 |
| trace report | 旧/newを版別に読み既存Report 2へ投影 | 同期・オフライン・保存済み文書・既存行結果 |
| runner reuse・pr・prompt・recorder | v1のok/results直読と型をv2へ追従 | 親SHA・文書snapshot・未コミット拒否、localの非最終合格 |
| trace serialization・publication | 版別validatorへ追従しJSON前後の検査とbyte予算を保持 | 同期・末尾改行・fsync・原子的な上書き禁止公開 |
| agreement・doctor | 共有configの影響を点検する | verify限定の2/3分類を既存の非verify契約へ漏らさず、doctorで品質コマンドを実行しない |
| smoke・runtime・公開型fixture | 現行v2と履歴v1の両経路を同じ変更で確認 | offline・SIGINT・strict型検査・既存の保護された期待値 |

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

現在の#60受入は確認済み。確認事項10件の回答と追加具体案の採否を記録し、必要な差分仕様・trace・tasksを更新し、受入済みREQ-305/307を含むmainを通常mergeしてからstrictと仕様ゲートexit 0を確認して、既存delivery指示のapplyへ進む。全A候補ではS1の内部基準準備とS2の公開側/全利用側のv2一体切替を分け得るが、S1やschema 2だけを置いた状態をC-001完了にしない。S1を先行受入する場合は、独立changeの限定したDoD・REQ対応試験・通常done 0と同期archiveを経てS2へ進む未承認候補とし、未完了の親C001 gateを緩めない。新change/IDは今回作成しない。S2の通常self-ci gateと独立trusted check、最終headの必須CI・配布検証と、R-C001-06で採用したローカル/CIのDoDをすべて満たす。

戻す場合は公開側・利用側を同じ単位で戻し、既に追加したv2証拠や旧fixtureを消さない。旧版へ戻した環境で新証拠を1.0.0に読み替えず、未対応版として止める。計画だけのPRではchangesetの実バージョン切替や製品コードを変更しない。

## Blocking Questions

未回答のR-C001-01〜10はtraceに選択肢・おすすめ・止まる範囲を記した。いずれも採用済みの技術判断ではない。同期/lazyの技術的実現性、Report投影、既存consumerの追従は技術資料で具体化する。取得範囲は03、判定器の構築は04、保護差分は05に分けた。DoD・quality配置・warn・旧Schema公開・spec-only計数も06〜10の回答前に決定しない。

## warnと省略コマンドの移行候補（R-C001-08）

R-C001-08のA/Bは未承認であり、下の比較を採用済みとは扱わない。追加レビュー末尾の推奨も回答ではない。REQ-036・037・039・191をMODIFIEDとし、R-C001-05の承認対象にも含める。

| 現行状態 | A候補 | B候補 |
|---|---|---|
| spec-onlyの未承認仮定/確認待ち要件 | PASSのreasonに案内を残す。その案内だけで要判断/pendingを立てず0を保つ | Aと同じ |
| doneの未承認仮定/確認待ち要件 | 該当IDを不足・要判断理由へ残し1にする | Aと同じ |
| auto時のOpenSpec CLI不在、local | 未実施をPASSのreasonと人向け案内へ残す。strict実施済みとは報告しない | 設定上任意の構造検証を理由付きNOT_APPLICABLEにし、summaryのNAへ数える |
| auto時のOpenSpec CLI不在、ci | 不足として1にする。任意設定を使って必要なci検証を実施済みにしない | Aと同じ |
| loomake.config.jsonの未知キー | 既知項目の検査が有効ならPASSのreasonへ案内を残す | Aと同じ |
| doneのskip-commands | 品質コマンドを不足としlocal/ciとも1。古いレポートを今回の成功根拠にしない | Aと同じ |

Aをおすすめとする。localでの任意CLI不在という案内を品質項目のNAと混ぜず、既存のspec-only 0を保ちやすいからである。BのNAは構造検証のgate項目だけに使う案であり、品質項目の対象外理由・人の確認を代替しない。いずれも明示trueでのCLI不在/実検証失敗とブロッキング質問の不合格は保持する。入力不正等のabortedがあれば、終了コード2/3の優先順は変えない。

spec-onlyの案内だけでdecision.requiredを立てるとREQ-036の0を失うため、この案内とdoneの判断待ちを分ける。R08採否後に採用分だけを規範仕様へ残し、候補・質問IDを規範文から除く。旧skipの単独成功から不足1への変更はREQ-191とR05/R08で明示承認する。
