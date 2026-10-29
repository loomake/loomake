# 2026-10-29 fix/reference-entrypoint-paths

1. やったこと：change `fix-reference-entrypoint-paths` の1.1・1.2を完了。main `03ff6057845e6e5bcb1bb1d2ba086db9def83126` から計画専用worktreeを作成し、REQ-321の全文と既存3 Scenarioを保持した差分仕様・設計・タスク・traceを用意した。PRは未作成。失敗元は[CI40844515674のmacOS job](https://github.com/loomake/loomake/actions/runs/40844515674/job/123348619751)。
2. verifyの結果：OpenSpec strictとspec-onlyはexit 0。Linux Node24の無変更コードで、親symlink経由の欠落check・不明引数・生成が全て0かつ無出力となり、物理パスでは1・2・0となることを確認した。再現ログは専有領域の `node_modules/.cache/reference-entrypoint-paths/reproduction.json` に保持した。
3. 残る確認事項：未回答の製品仕様はない。実装・追加試験・done・修正後のmacOS/Windows CI・独立レビューは未実施。未マージCLI生成器と公開・リリースを含めない。
4. 次にやること：管理役へ計画を引き継ぐ。この提案のターンでは実装せず、別ターンのapplyで2.1の失敗する回帰試験から進める。全変更はローカルのみで、push・PR作成は行っていない。


## 2.1 回帰試験の追加

1. やったこと：POSIX親symlink/Windows junctionを使うREQ-321の5試験を追加し、既存13試験の本文と期待値を保持した。未修正の生成器で欠落check・不明引数・生成の新規3試験が失敗し、既存13件とimportの新規2件は成功した。
2. verifyの結果：実装前のspec-onlyはexit 0。関連試験は期待どおり3 failed・15 passed。失敗は終了1/2が0になることと生成物の欠落で、環境エラーではない。
3. 残る確認事項：Windowsのjunction実行はnative CI待ち。製品修正・done・全OS CI・独立レビューは未実施。
4. 次にやること：2.2の入口判定を局所修正し、同じ18試験とlint/typecheck等を確認する。push・PR作成はまだ行わない。
