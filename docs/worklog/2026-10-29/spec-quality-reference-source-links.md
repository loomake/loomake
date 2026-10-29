# 2026-10-29 spec/quality-reference-source-links

1. やったこと：main `f4e3edb7145f35dac49fd139902ab17c5592a5d5` から専有worktreeを作り、change `fix-quality-reference-source-links` の6成果物と1.1を用意した。REQ-322全文・既存3 Scenarioを保持し、生成元2 URL、保護対象1 assertionの正確な変更前後、追加する確認とT-URL-01を記した。PRは未作成。
2. verifyの結果：OpenSpec strictはexit 0、spec-onlyは未回答T-URL-01の1検査だけでexit 1。URL解決と通常ファイルの存在は読取確認した。修正後の試験・site build・公開HTTP・done・全体試験は未実施。
3. 残る確認事項：T-URL-01の回答・回答者・回答日は空。通常開発の調査・設計に相当する作業だが、Opus利用不可のため、AGENTS.md 2章5に従う管理役の計画と配下への資料作成の割当でCodexを代替にした。実行ツールCodex、実際のモデル識別子は不明、共通原則1。Opusの設計・独立した設計レビュー・最終レビューは未実施、AI評価依頼は0回で、異なるモデルのレビューを実施したとは扱わない。
4. 次にやること：計画headを管理役へ引き継ぐ。proposeの終端で停止し、人のT-URL-01承認と別のapply指示、仕様ゲート成功の前に実装しない。renderer・生成ページ・試験・設定・主仕様は不変、push・PR・remote更新は行わない。

## Draft PR作成後の引き継ぎ

1. やったこと：管理役が計画head `f7092d6` をpushし、[Draft PR #149](https://github.com/loomake/loomake/pull/149)を作成した。この追記は作業記録だけを変更する。
2. verifyの結果：計画のstrictはexit 0、spec-onlyはT-URL-01だけでexit 1を維持。管理役からの引継ぎでは、PR148は[CI40855069293](https://github.com/loomake/loomake/actions/runs/40855069293)の通常verifyとCodeQL成功を確認してmain `f4e3edb`へ受入済み。CLI head `8cdff12` の[CI40856322770](https://github.com/loomake/loomake/actions/runs/40856322770)はUbuntu1,391件成功・既存8件skip、macOS両シャード成功、Windows進行中。gateは3.1未チェックだけでexit 1、他20項目は合格しており、最終DoDは未達である。
3. 残る確認事項：T-URL-01とPR144のM144-01は未回答。モデル識別子は不明、Opusの設計・独立した設計レビュー・最終レビューは未実施のままで、今回の記録をレビューや承認と扱わない。
4. 次にやること：記録コミットを管理役へ引き継ぎ、pushは管理役が行う。T-URL-01の人の承認・別のapply指示・仕様ゲート成功まで実装を始めない。

## CLI修正の全OS検証と判断待ち

1. やったこと：[PR144](https://github.com/loomake/loomake/pull/144)の修正・統合head `8cdff12`について、全OSの実行結果を収集した。ソースリンク計画は[PR149](https://github.com/loomake/loomake/pull/149)のT-URL-01待ちを維持する。
2. verifyの結果：[CI40856322770](https://github.com/loomake/loomake/actions/runs/40856322770)の品質5ジョブとNode20/22、CodeQL40856322777が成功。Ubuntu1,391件・macOS1,389件・Windows1,360件成功、CLI生成器19件・品質生成器18件は各OS成功。gateは3.1未チェックだけでexit 1、他20検査は合格。PR148取り込み後mainのCI40855861762・CodeQL40855861861も成功した。
3. 残る確認事項：CLIのM144-01、ソースリンクのT-URL-01、C-001の3項目とsite担当S103-01は未回答。CLIの最終done・全タスク完了・マージは未達で、人の承認や追加AIレビューを記録していない。
4. 次にやること：各PRの具体案と証拠をIssue121へまとめる。M144-01の承認後は記録を整え、コード不変の最終headでdone・必須CI成功を確認してからマージする。T-URL-01の承認と仕様ゲート成功前にはソースリンクを実装しない。初回配布全体は未完了。


## Opus新規設計の反映と実行可否の訂正

1. やったこと：[PR #149](https://github.com/loomake/loomake/pull/149)の対象64e5c45に対する英語の新規Opus設計を日本語designへ反映し、traceの「Opus利用不可」を当初未確認だったと訂正した。2 literal href・生成ページ差分1行、旧href排除、slash両形、固定SHAのHTML確認を明記し、renderer/保存ページ双方とisFileの強い検査を保持した。
2. verifyの結果：既存認証有効を安全な要約で確認後、新規設計を1回生成。actual modelUsageはclaude-opus-5-5のみ、session4190d7a2-20b1-42f3-8320-c16eded842bd、exit 0・is_error=false・denialsなし。今回の整合後もstrictはexit 0、spec-onlyはT-URL-01だけでexit 1。全体試験や追加モデル呼出しは行わない。
3. 残る確認事項：T-URL-01は未回答、1.1完了の1/5タスクを維持。設計生成はAI評価へ数えず0回で、設計レビュー・最終レビューは未実施。最終レビューは後日の新しいOpus session、自動bot予定1枠を残す。Codex編集担当のモデル識別子は不明。
4. 次にやること：計画整合コミットを管理役へ引き継ぐ。T-URL-01のA承認・別apply指示・仕様ゲート0がそろうまで製品を実装せず、B/空欄なら停止する。proposal・差分仕様・T-URL-01の問いと承認案、製品・試験・設定・主仕様は変更しない。push・remote更新は管理役が行う。
