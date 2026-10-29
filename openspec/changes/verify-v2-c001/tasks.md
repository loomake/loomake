# Tasks

本PRは計画のみ。未回答のR-C001-01〜03と#60の受入依存を解消するまで、2以降の実装へ進まない。以下は回答後に更新して実行する作業案であり、A案の採用や実装開始の承認を表さない。

## 1. 仕様と依存の確定

- [x] 1.1 proposal・差分仕様・design・tasks・traceを準備し、出典・公開側/利用側・未回答の停止範囲をレビューできる資料にする。OpenSpec strictの成功と、仕様ゲートが未回答で失敗することを記録する
- [ ] 1.2 R-C001-01〜03の人の回答と#60（REQ-307）の受入を確認し、質問行に回答者・回答日を記録する。採用案の具体的source/metric・適格性・正常PASS受入例と既存REQ-042の扱いを差分仕様へ反映し、strictと仕様ゲートexit 0を確認する

## 2. 公開形式と履歴の分離

- [ ] 2.1 coreのv2スキーマ・導出型・遅延loader、終了エラー型を追加し、ci/local completedとabortedの構造・0〜3・最低限の禁止キー・未知値保持をID付き試験で確かめる。partial構造を定義し、取得経路と網羅試験の残りをC-003へ記す（REQ-308・309・274）
- [ ] 2.2 Evidence 2と履歴Evidence 1/verify 1.0.0のschema・型・loaderを分離し、旧fixtureを改変しない閲覧試験と埋め込みの生成JSON一致、Report 2と無関係6 JSONの不変を確認する。同期APIと既存exportsの追従を試験し、型移行の説明を更新する（REQ-302・303・304・318）

## 3. 最小入力と限定した判定

- [ ] 3.1 quality.yamlの予算付き読取と既定値を接続し、最小入力・YAML不正・型/版不正・不在・権限をID付き試験で区別する。手動配置の最小例と構文2/読取3の移行説明を追加する（REQ-310）
- [ ] 3.2 適格性と実施確認を含む観測入力の限定条件判定を追加し、5比較演算子の境界、min_samples、NA、参考指標、未実施/古い/未照合の不足、入力不変をID付き試験で確かめる（REQ-313）
- [ ] 3.3 R-C001-03で決めた最小実証跡取得またはC-003依存を満たし、実コマンド・レポート・版/SHA/環境/手順/鮮度・基準と証拠hashの照合を正常PASS受入例で検証する。未実施・古い結果・exit 0だけの偽陽性が拒否されることを試験する（REQ-313・319）
- [ ] 3.4 既存集約と回答済みevaluatedの定義でsummaryを作り、件数とchecks一致、空/all NAの不足、local pending、decisionとの独立性をID付き試験で確かめる（REQ-314）

## 4. CLIと既存利用側の一体移行

- [ ] 4.1 runVerifyとformatter・CLIをv2へ移し、scope既定値、JSON引数エラー、stderr、CI=1非対話、API/CLIの0〜3一致をID付き試験で確認する。R-C001-01の回答に合わせてbare verify/品質経路の回帰とヘルプを更新する（REQ-040・041・311・312）
- [ ] 4.2 trace recordをEvidence 2へ移し、scopeと終了コード、aborted、文書snapshot・未コミット・検査前後変化・追記専用・同期性を既存回帰とID付き試験で確認する（REQ-066・315）
- [ ] 4.3 trace reportでv2を既存Report 2へ投影し、旧版の閲覧、local/旧版の非最終合格、証拠のないテスト対応を作らないことをID付き試験で確認する。既存の日本語行結果とJSON外形を維持する（REQ-316・302・303）
- [ ] 4.4 runnerの準備・local完了・decision停止・記録をv2へ追従し、RunSummary外形・中断/予算/変更保持の既存回帰と、要判断+FAILで修正を続けないID付き試験を確認する（REQ-205・317）
- [ ] 4.5 ci-gateと関連workflowの利用経路をv2/ciへ移し、local・旧形式・skip/neutral・全NAを合格にしない統合試験と、採用したbare verify品質経路の回帰を確認する（REQ-312・318）

## 5. 配布・受入

- [ ] 5.1 core/kit/trace/CLIのminorとrunnerのpatch changeset、形式版と利用側の移行案内を追加し、実tarball・公開型・JSON・CLI/API・旧fixture閲覧を検証する。既存試験・設定を緩めずlint・typecheckと全体試験を通す（REQ-308〜319）
- [ ] 5.2 正常PASS・abortedの2/3・不足1のCLI/API統合、全要件のID付きテストと独立レビューを確認し、最終headで通常の `pnpm -s verify --change verify-v2-c001 --done` と必須CIが成功することを記録する。C-003へ残るpartial/適格性全体と#61/63/64全体の未完了を明記する（REQ-319） <!-- loomake:gate=done -->
