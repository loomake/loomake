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


## 2.2 直接起動の判定の修正

1. やったこと：起動引数とモジュールの両パスをrealpathで比較し、import時の引数なし・解決不能では生成・照合を開始しないようにした。生成root・関数本体・引数処理と既存13試験がbyte一致することを照合した。2.1・2.2を完了、全体は4/5タスクである。
2. verifyの結果：関連18試験・生成物check・lint・typecheck・OpenSpec strictは成功。関連試験では専有workspaceのTMPDIRを使った。実装開始前と最終資料のspec-onlyもexit 0。
3. 残る確認事項：3.1の全体done・全OS CI・独立レビューは管理役へ残す。macOS/Windowsでの修正後の成功は未確認。品質設定や既存期待値を変えず、CLI未マージコードも変更していない。
4. 次にやること：固定実装headを管理役へ引き継ぎ、native CIと独立レビューで3.1を確認する。この担当からpush・PR作成は行わない。


## 3.1 初回全OS CIと最終記録

1. やったこと：[PR #147](https://github.com/loomake/loomake/pull/147)の実装head `426bdcb`を固定し、独立レビュー1回目の指摘なしと全OSの品質確認を根拠に、最後のタスク記録を反映する。製品・試験コードはレビュー後に変更していない。
2. verifyの結果：[CI40850304458](https://github.com/loomake/loomake/actions/runs/40850304458)でUbuntu・macOS両シャード・Windows両シャード、Node20/22が成功。CodeQL40850297052も成功した。Ubuntuは1,319件成功・既存8件skip。対象doneは3.1未チェックだけでexit 1、他の全項目とREQ-321の対応試験は合格した。
3. 残る確認事項：新たな製品判断はない。記録反映後の最終headのdone・全OS CIはまだ未確認なので、最終受入は保留する。CLIの旧headは別途修正中で、M144-01は未承認のまま。
4. 次にやること：記録だけのコミットをpushし、最終headのdone・全必須CIが成功したら受け入れる。期待値・skip・設定は変更せず、公開・リリースも行わない。

## 前作業のマージ後記録

1. やったこと：[PR #145](https://github.com/loomake/loomake/pull/145)の節リンク修理をmain `03ff605`へ受け入れ、#99のA23依存を省略しないことをIssueへ記録した。
2. verifyの結果：PRの通常verify・必須CIが成功。固定siteとCLI未マージ候補の14ページ複合buildは成功し、全6節参照の解決と既存29見出しの保持を確認した。
3. 残る確認事項：mainの3OS CIで本changeの起点となる起動判定不具合を見つけたため、初回配布や#104全体は未完了。siteにはパス・編集先・旧ブランドと公開確認の未達が残る。
4. 次にやること：本changeを全OSで受け入れ、CLIの修正後headを再検証して人の最終判断へ提示する。詳細は#100・#103・#121に記録した。
