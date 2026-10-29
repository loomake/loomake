# CLIリファレンス生成の実装

## 引き継ぎと依存受入

1. やったこと：旧planning担当を停止し、commit `9db6f64`の未push作業をmain `8d2d7ce`から作った`feat/cli-reference-generation`へcherry-pickした。残る未引継ぎ作業はない。change `add-cli-reference-generation`のタスク1.2として[PR142](https://github.com/loomake/loomake/pull/142)と[PR143](https://github.com/loomake/loomake/pull/143)の受入を記録した。
2. verify の結果：管理役がqualityのdone・全7tasks・REQ試験・CI40814920276、archiveの通常verify・CI40815827958成功を確認済み。reference-docsのPurpose・REQ-320〜322と9 Scenarioを内容不変で引き継いだ。
3. 残っている確認事項・仮定：人の未回答事項はない。C-001の未決仕様は対象外。
4. 次にやること：仕様ゲートを再実行し、変更前help/usageの原本を固定してからタスク2.1へ進む。

## 前作業の受入

1. やったこと：[PR143](https://github.com/loomake/loomake/pull/143)のhead `f0ccb67`をmain `8d2d7ce`へ受け入れ、quality生成の仕様同期・archiveを終えたことを引き継いだ。
2. verify の結果：[CI40815827958](https://github.com/loomake/loomake/actions/runs/40815827958)の通常verify・全必須CI・CodeQL成功、独立レビュー1回で指摘なしを管理役が確認済み。
3. 残っている確認事項・仮定：CLI生成の実装依存は解消した。
4. 次にやること：本changeの6タスクを順に進め、最終CIと独立レビューは管理役へ引き継ぐ。

## タスク2.1の共通記述と互換確認

1. やったこと：変更前のhelp・usage・診断46例を原本として固定し、args.tsの共通記述へ受理名・候補順・helpを接続した。handlerの検査・補完を維持し、REQ-323/324の新規50試験を追加した。
2. verify の結果：関連8ファイル125試験、runnerの権限条件に絞った既存4試験、typecheck・対象lint・buildは成功。既存の試験期待値・設定は変更していない。
3. 残っている確認事項・仮定：なし。全体品質と最終doneはnative CIで確認する。
4. 次にやること：タスク2.2のCLI専用renderer・生成/check・ページと回帰試験を追加する。

## タスク2.2の生成とcheck

1. やったこと：CLI専用の生成器と5.cli.mdを追加し、共通定義から全コマンド・共通操作・23オプションの条件と既定値を生成した。REQ-323/325の13試験を既存unit経路へ追加した。
2. verify の結果：生成/check、関連2ファイル63試験、typecheck・対象lint、生成ページのyomiyasu run/verifyは成功。通常/tmpでは容量不足でI/O試験9件が失敗し、TMPDIRを専有worktree内へ指定した同じ試験は全成功した。コード・期待値・設定は環境差のために変えていない。
3. 残っている確認事項・仮定：全体doneの環境依存の再試験は行わず、native CIへ残す。
4. 次にやること：タスク2.3の導線・手順・CLI patch changesetと配布試験経路での入口確認を行う。
