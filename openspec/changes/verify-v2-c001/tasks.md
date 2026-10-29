# Tasks

本PRは計画のみ。#60/REQ-307はPR #140・#141で受入済み。未回答のR-C001-01〜10と仕様ゲートが実装停止の理由である。以下は回答後に更新して実行する作業案であり、[全Aの場合の未承認候補](design-candidate-a.md)を無条件に実装しない。

## 1. 仕様と依存の確定

- [x] 1.1 proposal・差分仕様・design・tasks・traceを準備し、出典・公開側/利用側・未回答の停止範囲をレビューできる資料にする。OpenSpec strictの成功と、仕様ゲートが未回答で失敗することを記録する
- [ ] 1.2 R-C001-01〜10の人の回答・追加具体案の採否と承認元を記録する。#60受入済みの事実を踏まえ、採用するsource/metric・plan・最小適格性・正常PASS例・REQ-036/037/039/042/055/073/191/275/276/305/307とC1〜C5の具体的assertion差分を整理する。全回答を記録したあと、差分仕様の規範文から候補・質問ID・未決選択肢の文言を除き、採用した振る舞いだけへ確定し、台帳の確認待ち状態を照合して更新する。受入済みREQ-305/307を含む最新mainを通常mergeしてからstrictと仕様ゲートexit 0を確認する。保護された期待値変更は具体差分の個別承認を得る
- [ ] 1.3 1.2後、R-C001-04のAを採用する場合だけS1内部基準準備を具体化する。承認済みanchor/spec/必須REQ集合・quality/plan/method/tool/version/hashを固定し、private handoff・base-built判定module・S2自己ゲートとの一致検査を準備する。先行受入するS1は独立change・その範囲のDoD/REQ対応試験/通常done 0で受け入れ同期archive後にS2へ進む候補とし、新change/IDは採否後の担当・既用ID・枠確認まで作らない。親doneを緩めず、S1をC-001完了とせず、設定・公開操作は別途の具体的承認まで行わない（REQ-313・319）

## 2. 公開形式と履歴の分離

- [ ] 2.1 coreのv2スキーマ・導出型・遅延loader、終了エラー型を追加し、ci/local completedとabortedの構造・0〜3・最低限の禁止キー・未知値保持をID付き試験で確かめる。partial構造を定義し、取得経路と網羅試験の残りをC-003へ記す（REQ-308・309・274）
- [ ] 2.2 Evidence 2と履歴Evidence 1/verify 1.0.0のschema・型・loaderを分離し、旧fixtureを改変しない閲覧試験と埋め込みの生成JSON一致、Report 2と無関係6 JSONの不変を確認する。R-C001-09の回答に従い旧JSON Schemaの版付きパス/exportsと履歴validatorを配布試験で確かめる。scripts/schema-contract-check.mjsの旧mode/ok/results固定mutationも版別へ移し、必須項目削除・改名と版変更の検出を保持する。同期APIと既存exportsの追従を試験し、型移行の説明を更新する（REQ-302・303・304・318）

## 3. 最小入力と限定した判定

- [ ] 3.1 quality.yamlの予算付き読取と既定値を接続し、最小入力・YAML不正・型/版不正・不在・権限をID付き試験で区別する。R-C001-07の回答に従いv2切替前にroot quality.yamlを配置し、詳細候補のci.test_report 1必須項目と各changeの承認済みREQ集合へのplanを準備し、進行中changeのspec-onlyとdone/ciを確認する。切替当日の全open PRを棚卸し、実装済みPRはmain取込・対象headの新鮮な証拠・新ゲート成功を確認する。計画Draftは仕様待ち失敗を維持し、未移行/証拠未取得のPRはマージを止める。手動配置の最小例と構文2/読取3の移行説明を追加する（REQ-310）
- [ ] 3.2 適格性と実施確認を含む観測入力の限定条件判定を追加し、5比較演算子の境界、min_samples、NA、参考指標、未実施/古い/未照合の不足、未完の集計値で暫定FAIL/PASSにしないこと、入力不変をID付き試験で確かめる（REQ-313）
- [ ] 3.3 R-C001-03と04で決めた範囲の最小接続を満たし、producer/version・実効script/config/lock/tool・承認済みspec/REQ集合・対象SHA・環境・同一invocation鮮度・基準と証拠hashを正常PASS例で照合する。failedとmissing/skip/todoを分け、古い結果・PRのREQ削除・exit 0だけの偽陽性と最小接続のpartial/abortedを試験する（REQ-313・319）
- [ ] 3.4 既存集約と回答済みevaluatedの定義でsummaryを作り、件数とchecks一致、品質対象0/全NA/証拠空をgateのPASSで相殺しないquality:subjects guard、local pending、decisionとの独立性をID付き試験で確かめる。R-C001-02がAならguardもevaluatedへ数える。R-C001-08のゲート別warn対応・localのOpenSpec不在PASS/NA・ci不足と、REQ-191のskip-commands不足1、10のspec-only品質計数を回答どおりに確認する（REQ-314）

## 4. CLIと既存利用側の一体移行

- [ ] 4.1 runVerifyとformatter・CLIをv2へ移し、scope既定値、JSON引数エラー、stderr、CI=1非対話、API/CLIの0〜3一致をID付き試験で確認する。R-C001-01の回答に合わせてbare verify/品質経路の回帰とヘルプを更新する（REQ-040・041・311・312）
- [ ] 4.2 trace recordをEvidence 2へ移し、scopeと終了コード、aborted、文書snapshot・未コミット・検査前後変化・追記専用・同期性とserializationのJSON前後検査・publicationの上書き禁止を既存回帰とID付き試験で確認する（REQ-066・315）
- [ ] 4.3 trace reportでv2を既存Report 2へ投影し、旧版の閲覧、local/旧版の非最終合格、証拠のないテスト対応を作らないことをID付き試験で確認する。既存の日本語行結果とJSON外形を維持する（REQ-316・302・303）
- [ ] 4.4 runnerの準備・local完了・decision停止・記録をv2へ追従し、reuse/pr/prompt/recorderも含む型・表示・再利用を追従し、RunSummary外形・中断/予算/変更保持と要判断+FAILで止まる試験を確認する。agreement/doctorへverify限定のエラー分類を漏らさない（REQ-205・317）
- [ ] 4.5 ci-gateと関連workflowの利用経路をv2/ciへ移し、local・旧形式・skip/neutral・全NAを合格にしない統合試験、R-C001-04がAの場合だけnormal self-ciがS1判定moduleを直接使うことと、fresh Tを基準としたexact 2.0.0解析・S/T一致を確認し、採用したbare verify品質経路を確認する（REQ-312・318）

## 5. 配布・受入

- [ ] 5.1 core/kit/trace/CLIのminorとrunnerのpatch changeset、形式版と利用側の移行案内を追加し、実tarball・公開型・JSON・CLI/API・旧fixture閲覧を検証する。R-C001-06に従いAGENTS.md・packages/kit/templates/AGENTS.md・guide・PRテンプレートのローカルDoD/CI合格のコマンドと説明を同時に更新する。既存試験・設定を緩めずlint・typecheckと全体試験を通す（REQ-308〜319）
- [ ] 5.2 正常PASS・abortedの2/3・不足1のCLI/API統合、全要件のID付きテストと独立レビューを確認し、R-C001-06の回答に従い最終headのローカルDoDとci完了ゲート・必須CI成功を記録する。Aならローカルは `--done --scope local` の0、最終CIは `--done --scope ci` のreal v2/PASS・要判断なし・0を両方必要とする。R-C001-04がAなら独立trusted checkも追加条件として確認し、Bなら採用した信頼基準を検証する。C-003へ残る全provider/host隔離/広い取得経路と#61/63/64全体の未完了を明記する（REQ-319） <!-- loomake:gate=done -->
