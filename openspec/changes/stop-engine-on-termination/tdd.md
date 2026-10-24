# TDD実行記録

## 1.1 信号

配布物に実際に信号を送る smoke 検査（scripts/run-sigint-smoke.mjs）を、SIGINT・SIGTERM・SIGHUP を選べる形にした。SIGINT 以外は、準備した利用側のプロジェクトを複製し、準備した直後のコミットに戻してから動かす。SIGTERM・SIGHUP の検査を 2 件足し、現行の実装では CLI が SIGTERM の既定の動作で終わる（終了コードなし・信号 SIGTERM）ことを確かめた。CLI で SIGTERM・SIGHUP も中断として扱うようにして、3 つの信号とも、中断の記録・先行のコミット・途中の変更を残し、エンジンのプロセスも残さないことを確かめた。package-artifacts の 9 件が成功した。
