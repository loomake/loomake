# 2026-10-28 の作業記録（run-other-os-after-merge）

## PR の CI を ubuntu だけにし、macOS と Windows はマージのあとで確かめる（19:25）

- やったこと：change run-other-os-after-merge のタスク 1.1〜3.2。利用者の指示（開発速度のボトルネック対策 A）に従い、quality ジョブの OS のマトリクスを式で切り替えた。PR では ubuntu-latest だけで動く。main への push、毎日 1 回の定期実行（18:00 UTC、日本時間の 3:00）、`ci:all-os` ラベルの付いた PR では 3 つの OS で動く。ラベルを付けたときにも起動するよう、pull_request の種類に labeled を足した。node20・node22・gate のジョブは変えていない。差分仕様では REQ-049 を MODIFIED にし、ラベルの要件に REQ-273 を振った。試験は `tests/monorepo.test.ts` に足した。GitHub Actions の式を評価してマトリクスを展開し、3 つの条件（ラベルのない PR、main への push と定期実行、ラベルのある PR）で、どの OS のジョブができるかをそれぞれ確かめる。`on:` の labeled と schedule、node20・node22・gate が OS の切り替えの影響を受けないことも確かめる。既存の `[REQ-214]`・`[REQ-270]`・`[REQ-144]` は、マトリクスの OS の行と `on:` の行を読む部分だけを、新しい ci.yml に合わせた。シャード・カバレッジ・文書だけの PR の検査は弱めていない。README.md の CI の説明も直した。
- archive：この PR で、main に入っていてまだ archive していなかった change shorten-ci-wall-clock を先に archive し、そのあとでこの change を archive した（仮定 A-04）。どちらの差分仕様も REQ-049 を MODIFIED にしているので、この change を先に反映すると、あとで shorten-ci-wall-clock を archive したときに REQ-049 が古い文に戻るためである。
- verify の結果：`pnpm -s verify --change run-other-os-after-merge --spec-only` と `--done` は合格（exit 0）。どちらも「仮定の承認」の警告だけが出た（A-01〜A-04 が未承認）。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（1087 件が成功、8 件を skip）も通った。archive のあとの `openspec validate --specs --strict` も合格した。
- 残っている確認事項・仮定：Q-01（REQ-273 の番号が並行する change と重なったときの振り分け。ブロッキングではない）。仮定 A-01〜A-04 は未承認。shorten-ci-wall-clock の proposal.md が archive する PR に求めている `docs/quality/scenarios.json` のレビューの付け替え（change 側の ID から仕様側の ID へ）は、この PR ではしていない。
- 次にやること：PR の CI で、quality ジョブが ubuntu-latest の 1 つだけになることと、所要時間を確かめる。

## 対策 C の決定の記録（19:25）

- 利用者は 2026-10-28 に、Issue #5（Windows の quality ジョブの失敗）の作業を、W3-5（実行環境、#83）まで止めると決めた。PR #40 で止めた Windows の既知の失敗は、止めたままにする。新しく出た Windows だけの失敗は、#5 に追記するだけにする。
- #5 へのコメントは、作業中の担当には権限で拒否されたので、利用者が自分で書く。この作業では記録に書くだけにし、Issue には触れていない。

## PR #108 の CI の結果（19:32）

- やったこと：PR #108 を作った。CI の run 40672116635 では、quality ジョブは `quality (ubuntu-latest)` の 1 つだけになり、macOS と Windows のジョブはできなかった。シャードの組み合わせがすべて exclude で除かれても、include の ubuntu が残ることを、GitHub の上でも確かめた。所要時間は、run の作成から終わりまでが 4 分 17 秒（19:26〜19:30）。内訳は quality (ubuntu-latest) が 4 分 13 秒、gate が 4 分 6 秒、node20 が 40 秒、node22 が 43 秒で、すべて成功した。リポジトリに `ci:all-os` ラベルを作った。ラベルを付けて 3 つの OS で動かす経路は、この PR では試していない（式のその側は、今までと同じ 3 つの OS の一覧になる）。
- 残っている確認事項・仮定：上の節と同じ。
- 次にやること：利用者のマージを待つ。マージのあとの main への push で、3 つの OS の quality ジョブが動くことを確かめる。
- 仮定 A-01〜A-04 を、利用者が 2026-10-28 の会話で「おすすめで承認」したので、archive した trace.md に記録した。`verify --done` は警告なしで合格した。
