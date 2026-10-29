# 2026-10-29 archive/reference-entrypoint-paths

1. やったこと：完了したchange `fix-reference-entrypoint-paths`（全5タスク）のREQ-321へ、リンク経由起動とimportの2 Scenarioを同期し、6成果物を内容不変でarchiveした。主仕様のPurpose・REQ-320/322・REQ-321の原文と既存3 Scenarioを保持した。リンク補正は不要だった。
2. verifyの結果：受入元[PR #147](https://github.com/loomake/loomake/pull/147)の最終head `4aa71c5980c429b86755923039f31019490acdde` は、[CI40852181609](https://github.com/loomake/loomake/actions/runs/40852181609)のdone・Ubuntu・macOS両シャード・Windows両シャード・Node20/22と[CodeQL40852181572](https://github.com/loomake/loomake/actions/runs/40852181572)が成功。実装head426bdcbの独立レビューは1回で指摘なし、その後はtasks/worklogのみ変更し、main `d96197ae07e1e0b515dbd44cb6279629889ba8d6` へ取り込み済み。archive担当のstrictは主仕様29/29・全体34/34でexit 0。原文/差分・受入済みmainの6成果物とarchiveのbyte一致を照合した。全体試験はこのbranchのnative CIで確認する。
3. 残る確認事項：新たな製品仕様の判断はない。このarchive branchのCI・独立レビュー・マージは未実施。製品・試験・設定と、CLIの未マージbranchは変更していない。
4. 次にやること：ローカル検証済みheadを管理役へ引き継ぎ、archive PRの受入後にCLI側のmain依存を取り込む。push・PR作成・公開・リリースは行っていない。
