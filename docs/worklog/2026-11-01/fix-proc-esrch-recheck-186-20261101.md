## Linux の生存確認で ESRCH を再確認する修理

1. Issue #186 の追補として、`/proc/<pid>/stat` の読み取りが `ESRCH` になった場合だけ `kill(pid, 0)` で再確認する処理と8件の回帰試験を追加した。ADR 0005 の開発基盤修理のため change とタスク番号は対象外で、[PR #268](https://github.com/loomake/loomake/pull/268) を起票した。
2. 追加試験の修理前は5件失敗し、修理後は生存確認36件と診断1件が成功した。元の配布 SIGHUP 試験は分割 ready の false・true とも成功し、build・lint・typecheck も成功した。change なしのため verify は対象外。
3. 回収済みの実子 PID を使った試験では、`readStat` の `ESRCH` を注入し、再確認だけ実際の `kill(pid, 0)` を使用した。実際の `/proc` 読み取り失敗の再現や Issue #186 の元の PID の原因解明には至っておらず、3 OS の CI と独立レビューも未実施。
4. 管理役が PR を起票し、独立した自己レビューと Opus 最終レビュー、必須 CI と3 OS の検査結果を確認する。従来の試験全文・期待値・待ち時間・skip・設定・製品コードは保持した。
