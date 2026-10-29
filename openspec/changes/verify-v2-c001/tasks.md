# Tasks

本PRは計画のみ。#60/REQ-307はPR #140・#141で受入済み。保留のR-C001-05/06/08と仕様ゲートが実装停止の理由である。以下は回答後に更新して実行する作業案であり、[部分承認と残るA案の具体化](design-candidate-a.md)を無条件に実装しない。

## 1. 仕様と依存の確定

- [x] 1.1 proposal・差分仕様・design・tasks・traceを準備し、出典・公開側/利用側・未回答の停止範囲をレビューできる資料にする。OpenSpec strictの成功と、仕様ゲートが未回答で失敗することを記録する
- [ ] 1.2 承認済みR01/02/03/04/07/09/10のAを保持し、保留のR05/06/08の採否と承認元を記録する。#60受入済みの事実を踏まえ、採用するsource/metric・plan・最小適格性・正常PASS例・REQ-036/037/038/039/040/042/050/055/073/093/114/115/135/136/164/183/191/203/275/276/305/307/322とC1〜C5の具体的assertion差分を整理する。R05/R06の回答後、このタスクでREQ-093・135・136のMODIFIEDを確定する。R05 Aなら093はspec-only不合格1とusage/config aborted 2・その他aborted 3を分け、実装ブランチ作成/エンジン呼出しを止める。135もR05 Aなら全オプション説明義務の本文を保持し、既存verify/trace recordヘルプScenarioへscopeを加える。136はR06 Aなら完了ゲート本文を明示localへ変更し、最終ci確認と区別して印と既存Scenarioを保持する。Bなら136本文と雛形の既定ciコマンドを保持する。全回答後、規範文から候補・質問ID・未決選択肢を除いて採用した振る舞いだけへ確定し、台帳を更新する。PR #155でCLI/URL両changeが同期/archiveされ、main d5aa30dのREQ-323〜325とREQ-322のURL/4 Scenarioへ入ったことを確認する。REQ-323/324のMUSTを生成/集約単独へ限定する差分、REQ-100の明示local、REQ-306の非接続範囲もR05の採否へ含め、全既存Scenario/Sourceを保持する。最新mainは通常merge済みであり、採否確定後のstrictと仕様ゲートexit 0を確認する。全C-001差分を一時コピーでarchiveして全capabilityの主仕様strictを通し、全MODIFIEDの本文字数をOpenSpecのパーサで測って500以内と確認する。上限に近いREQ-322・114と短縮した306は文言確定後に再計測する。本番archiveは製品DoD達成後とし、保護された期待値変更は具体差分の個別承認を得る
- [ ] 1.3 1.2後、承認済みR-C001-04 Aに従い、R05/06/08の採否後にS1内部基準準備を具体化する。承認済みanchor/spec/必須REQ集合・quality/plan/method/tool/version/hashを固定し、private handoff・base-built判定module・S2自己ゲートとの一致検査を準備する。先行受入するS1は独立change・その範囲のDoD/REQ対応試験/通常done 0で受け入れ同期archive後にS2へ進む候補とし、新change/IDは採否後の担当・既用ID・枠確認まで作らない。親doneを緩めず、S1をC-001完了とせず、設定・公開操作は別途の具体的承認まで行わない（REQ-313・319）

## 2. 公開形式と履歴の分離

- [ ] 2.1 coreのv2スキーマ・導出型・遅延loader、終了エラー型を追加し、ci/local completedとabortedの構造・0〜3・最低限の禁止キー・未知値保持をID付き試験で確かめる。partial構造を定義し、取得経路と網羅試験の残りをC-003へ記す（REQ-308・309・274）
- [ ] 2.2 Evidence 2と履歴Evidence 1/verify 1.0.0のschema・型・loaderを分離し、旧fixtureを改変しない閲覧試験と埋め込みの生成JSON一致、Report 2と無関係6 JSONの不変を確認する。R-C001-09の回答に従い旧JSON Schemaの版付きパス/exportsと履歴validatorを配布試験で確かめる。scripts/schema-contract-check.mjsの旧mode/ok/results固定mutationも版別へ移し、必須項目削除・改名と版変更の検出を保持する。同期APIと既存exportsの追従を試験し、型移行の説明を更新する（REQ-302・303・304・318）

## 3. 最小入力と限定した判定

- [ ] 3.1 quality.yamlの予算付き読取と既定値を接続し、最小入力・YAML不正・型/版不正・不在・権限をID付き試験で区別する。承認済みR-C001-07 Aに従いv2切替前にroot quality.yamlを配置し、詳細候補のci.test_report 1必須項目と各changeの承認済みREQ集合へのplanを準備し、進行中changeのspec-onlyとdone/ciを確認する。切替当日の全open PRを棚卸し、実装済みPRはmain取込・対象headの新鮮な証拠・新ゲート成功を確認する。計画Draftは仕様待ち失敗を維持し、未移行/証拠未取得のPRはマージを止める。手動配置の最小例と構文2/読取3の移行説明を追加する（REQ-310）
- [ ] 3.2 適格性と実施確認を含む観測入力の限定条件判定を追加し、5比較演算子の境界、min_samples、NA、参考指標、未実施/古い/未照合の不足、未完の集計値で暫定FAIL/PASSにしないこと、入力不変をID付き試験で確かめる（REQ-313）
- [ ] 3.3 R-C001-03と04で決めた範囲の最小接続を満たし、producer/version・実効script/config/lock/tool・承認済みspec/REQ集合・対象SHA・環境・同一invocation鮮度・基準と証拠hashを正常PASS例で照合する。failedとmissing/skip/todoを分け、古い結果・PRのREQ削除・exit 0だけの偽陽性と最小接続のpartial/abortedを試験する（REQ-313・319）
- [ ] 3.4 既存集約と回答済みevaluatedの定義でsummaryを作り、件数とchecks一致、品質対象0/全NA/証拠空をgateのPASSで相殺しないquality:subjects guard、local pending、decisionとの独立性をID付き試験で確かめる。承認済みR-C001-02 Aに従いguardもevaluatedへ数える。R-C001-08のゲート別warn対応・localのOpenSpec不在PASS/NA・ci不足と、REQ-191のskip-commands不足1、10のspec-only品質計数を回答どおりに確認する（REQ-314）

## 4. CLIと既存利用側の一体移行

- [ ] 4.1 runVerify・formatter・CLIをv2へ移し、scope既定値、JSON引数エラー、stderr、CI=1非対話、API/CLIの0〜3一致をID付き試験で確認する。承認済みR01 Aのbare verify品質専用経路を保持する。REQ-323〜325に従いargs.tsの共通定義・help/usage・docs/guide/3.reference/5.cli.mdを同じ改版で更新し、生成器 --checkを通す。reference-cli-baseline.jsonの旧46例は原本を残し、新契約で変わる出力/追加scope例を具体差分としてR05方針承認とは別の個別承認へ出す。1.2で確定したREQ-135に従い、verify/trace recordヘルプの --scope local|ci・受理値/既定値とskip不足/coverage省略の説明を実装し、helpでは検査せずstdout/0を保つことと全既存Scenarioを試験する。REQ-050のCLI呼出し/不足1とレポート抽出の処理量保持、REQ-040の正常coverageとskip省略を承認後に試験する（REQ-040・041・050・135・311・312・323〜325）
- [ ] 4.2 trace recordをEvidence 2へ移し、scopeと終了コード、aborted、文書snapshot・未コミット・検査前後変化・追記専用・同期性とserializationのJSON前後検査・publicationの上書き禁止を既存回帰とID付き試験で確認する（REQ-066・315）
- [ ] 4.3 trace reportでv2を既存Report 2へ投影し、旧版の閲覧、local/旧版の非最終合格、証拠のないテスト対応を作らないことをID付き試験で確認する。既存の日本語行結果とJSON外形を維持する（REQ-316・302・303）
- [ ] 4.4 runnerの準備・local完了・decision停止・記録をv2へ追従し、reuse/pr/prompt/recorderも含む型・表示・再利用を追従し、RunSummary外形・中断/予算/変更保持と要判断+FAILで止まる試験を確認する。REQ-100の既存5 Scenarioを保持してverify --done --scope localと同じ検査へ追従し、REQ-205の判断順を保つ。1.2で確定したREQ-093に従いspec-only不合格1とaborted 2/3の停止を実装・試験し、実装ブランチを作らずエンジンを呼ばないことと全既存Scenarioを確認する。REQ-114/115のPR本文はlocal完了0とCI最終未確認を分け、REQ-164/315はEvidence 2/localの同一状態再試行と旧版非再利用を同じ試験で確認する。REQ-203の未承認警告用語もv2の案内/不足へ合わせる。agreement/doctorへverify限定のエラー分類を漏らさない（REQ-205・317）
- [ ] 4.5 ci-gateと関連workflowの利用経路をv2/ciへ移し、local・旧形式・skip/neutral・全NAを合格にしない統合試験、R-C001-04がAの場合だけnormal self-ciがS1判定moduleを直接使うことと、fresh Tを基準としたexact 2.0.0解析・S/T一致を確認し、採用したbare verify品質経路を確認する（REQ-312・318）

## 5. 配布・受入

- [ ] 5.1 core/kit/trace/CLIのminorとrunnerのpatch changeset、形式版と利用側の移行案内を追加し、実tarball・公開型・JSON・CLI/API・旧fixture閲覧を検証する。1.2で採用したR-C001-06に従いAGENTS.md・packages/kit/templates/AGENTS.md・guide・PRテンプレートのローカルDoD/CI合格のコマンドと説明を同時に更新する。CONTRIBUTING.md、README.md、README.en.md、packages/cli/README.md、docs/flow.md、.agents/skills/delivery/SKILL.mdと、雛形文面を固定しているtests/kit-assets.test.ts:251も移行対象とする。kit-assetsの期待値は具体差分の個別承認を得てから変更し、R06の方針承認だけで変更しない。req-to-openspecのtasks雛形2箇所（packages/kit/templates/skills/req-to-openspec/references/openspec-format.md、.agents/skills/req-to-openspec/references/openspec-format.md）も対象にする。1.2で確定したREQ-136と採用コマンドを両雛形へ反映し、印を付ける既存Scenarioと完了ゲートの印を保持する試験を行う。Scenario変更後にREQ-190の監査をやり直し、docs/quality/scenarios.jsonのScenario hash・対応テスト・理由を実際の最新試験へ照合して更新する。旧レビューのhashだけを書き換えて済ませず、不足/無効の残りも記録する。CLI共通定義・生成ページ・新旧基準fixtureが同じ受理/出力を表すことを検査し、基準差分の個別承認を照合する。既存試験・設定を緩めずlint・typecheckと全体試験を通す（REQ-308〜319）
- [ ] 5.2 正常PASS・abortedの2/3・不足1のCLI/API統合、全要件のID付きテストと独立レビューを確認し、R-C001-06の回答に従い最終headのローカルDoDとci完了ゲート・必須CI成功を記録する。Aならローカルは `--done --scope local` の0、最終CIは `--done --scope ci` のreal v2/PASS・要判断なし・0を両方必要とする。R-C001-04がAなら独立trusted checkも追加条件として確認し、Bなら採用した信頼基準を検証する。C-003へ残る全provider/host隔離/広い取得経路と#61/63/64全体の未完了を明記する（REQ-319） <!-- loomake:gate=done -->
