# 2026-10-28 作業記録

## change shorten-ci-wall-clock のレビューへの対応（06:10）

- やったこと：change shorten-ci-wall-clock のタスク 4.1〜4.7。実装に関わっていない担当による PR #31 のレビューに対応した。利用者は 2026-10-27 に、作業中の担当とのチャットで「おすすめで」と承認した。レビューでは、文書でない変更があるのに docs_only=true になる経路は、判定のロジックには見つからなかった。対応は次の 4 点で、4 点目の指摘（シンボリックリンク経由で実行すると出力しない）には対応していない。trace.md には、レビューの指摘と承認を Q-09 として記録した。
  - 1 点目：マージ先を変えても CI は再実行されないので、PR のマージ先が main でないときは文書だけと判定しないようにした
  - 2 点目：判定のスクリプトと ci.yml は許可リストの外なので、変えた PR は文書だけにならない。判定のロジックは足さず、Scenario とテストで明示した
  - 3 点目：文書だけの PR では、文書を読むテストが macOS・Windows で動かなくなることを、proposal.md の Impact に書いた
  - 5 点目：main が進んだあとのマージコミットと、コードのファイルの削除のテストを足した

  差分仕様の Scenario は 4 件増えて 18 件になり、`docs/quality/scenarios.json` のレビューも合わせた。作業の前に origin/main（fe94cf4。PR #19・#20・#26 のマージを含む）を取り込んだ（9a26e6b）。作業記録の競合は両方の節を時刻の順に並べ、`docs/quality/scenarios.json` の競合は main の版にこの change のレビューを足し直して解いた。既存のテストは変えていない。変えたのは、この change で足したテスト（差分を取れないときの試験を、マージ先の判定に当たらないよう、origin/main を消す形にした）だけである。
- verify の結果：`openspec validate shorten-ci-wall-clock --strict` は合格した。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（74 ファイル 1053 件）は通過した。`node scripts/scenario-audit.mjs` では、この change の 18 件がすべて reviewed になった。`pnpm -s verify --change shorten-ci-wall-clock --done` は合格した（exit 0）。PR #31 の CI の run 40584544479（092688d）では、gate・ubuntu・macOS の両シャード・Windows の 2/2・node20・node22 が成功した。5 つの quality ジョブの判定は、どれも「文書ではないファイルを変えているので、すべてのステップを実行します」だった。Windows の 1/2 は 3 件が失敗した（process.test.ts の `[REQ-181] 監視役へのSIGINTを中断として返し、子を止める` と `[REQ-181][REQ-182] 中断後に同じ共有予算で別の操作を始めない`、external-budget.test.ts の `[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない`）。3 件とも、main の run 40583220629（fe94cf4）の Windows でも失敗している（PR #22 が扱う範囲）。main ではもう 1 件、`[REQ-173]` も失敗しているが、この run では通った。この change で足した試験は Windows でも失敗していない。
- 残っている確認事項・仮定：なし。
- 次にやること：ドラフトの解除とマージは利用者に委ねる。
