# TDD実行記録

## 1.1 信号

配布物に実際に信号を送る smoke 検査（scripts/run-sigint-smoke.mjs）を、SIGINT・SIGTERM・SIGHUP を選べる形にした。SIGINT 以外は、準備した利用側のプロジェクトを複製し、準備した直後のコミットに戻してから動かす。SIGTERM・SIGHUP の検査を 2 件足し、現行の実装では CLI が SIGTERM の既定の動作で終わる（終了コードなし・信号 SIGTERM）ことを確かめた。CLI で SIGTERM・SIGHUP も中断として扱うようにして、3 つの信号とも、中断の記録・先行のコミット・途中の変更を残し、エンジンのプロセスも残さないことを確かめた。package-artifacts の 7 件が成功した。

## 2.1 文書

testing.md と run-recovery.md に、SIGTERM・SIGHUP の扱いと検査の動かし方を書いた。changeset を足した。

## 完了ゲート

最初の実行は、changeset をコミットしていなかったことによる REQ-056 の失敗と、負荷平均 22 のときの時間切れ 10 件で不合格だった。changeset をコミットして再実行し、`pnpm -s verify --change stop-engine-on-termination --done` は exit 0（891 件）だった。

## レビューの指摘への対応

品質コマンドは同期的に動くので、そのあいだに届いた SIGTERM の処理は、イベントループに戻るまで実行されない。完了ゲートのあとは await がないまま証拠の記録・push・PR の作成まで進むので、中断されずに PR を作って終了コード 0 になることが指摘された。進捗の表示から setImmediate で中断を予約して、この遅れをまねるテストを 2 件（完了ゲートの品質コマンドのあいだ、証拠の記録の品質コマンドのあいだ）足し、直す前は 2 件とも終了コード 0 で PR を作ることを確かめた。完了ゲートの直後、証拠の記録の前、push の前、PR の作成の前に、イベントループにいったん戻って中断を確かめる形にして、runner の 299 件が成功した。ビルドした CLI を実際に起動し、品質コマンドの中から CLI に SIGTERM を送っても、中断として止まり、push と PR の作成をしないことも確かめた。

レビュー対応のあとの `pnpm -s verify --change stop-engine-on-termination --done` は exit 0（893 件）だった。

## 2 回目のレビューの指摘への対応

既存の PR の検索（findOpenPr）も同期的に動くのに、そのあとに中断を確かめていなかったので、検索中の SIGTERM で PR を作って終了コード 0 になることが指摘された。偽の gh が PR を検索した記録を、確認点でイベントループに戻ったときに見て中断を予約するテストを足し、直す前は PR を作ることを確かめた。検索のあと、PR を作る前にも確認点を足して、3 件が成功した。

2 回目のレビュー対応のあとの `pnpm -s verify --change stop-engine-on-termination --done` は exit 0（894 件）だった。ビルドした CLI に、既存の PR の検索中に SIGTERM を送っても、PR を作らずに中断として止まることも確かめた。
