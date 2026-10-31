## S4 の push 停止までの操作順序の診断

1. 既存の push 期限試験から、content diff の完了が push の停止より先だったことを調べる Windows 用 workflow・集計 script・新しい正負試験を追加した。ADR 0005 の開発診断のため change とタスク番号は対象外で、[PR #271](https://github.com/loomake/loomake/pull/271) を起票した。
2. 未実装時の新40件は失敗し、実装後の新49件と既存32件の計81件が成功した。元の push 試験1件も Linux の捕捉・集計経路で成功し、context は21,749B、順序は確認済みとなった。lint・typecheck・build は成功し、change なしのため verify は対象外。
3. 元の試験・helper・予算・設定・製品コード・親の13済6未を保持した。Windows の診断、必須 CI・3 OS、独立レビュー、task 3.5、実 CLI の0/4件と P6 は未達のままである。
4. 管理役が PR を起票し、作者と別の自己レビュー、Opus 最終レビュー、必須 CI と3 OSを確認する。生データは集計後に削除し、検証済みの固定要約2ファイルだけを公開するが、cancel や runner の異常終了時の削除は保証しない。
