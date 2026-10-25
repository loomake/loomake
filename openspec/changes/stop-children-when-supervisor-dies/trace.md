# Trace: stop-children-when-supervisor-dies

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| GitHub Issue #5「Windows の quality ジョブで失敗する既存テストを直す」の本文とコメント 1〜4 | コメント 4 まで | 2026-10-26 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-181 | openspec/specs/external-process-budget/spec.md の「監視対象の子プロセスの停止」 | 非機能 | 期限・出力超過・SIGINT・SIGTERM で子孫ごと止め、監視役は中断を区別する | 反映済 | specs/external-process-budget/spec.md |
| REQ-250 | Issue #5 コメント 2「原因」⑥と「進め方」3、コメント 3 の 2、コメント 4 の C の箇条 | 非機能 | 監視役が結果を書かずに終わっても、親が子孫を特定して止める。結果がない理由を失わずに返し、利用者の中断と区別する。その状態で同じ予算の後続の操作を始めない | 反映済 | specs/external-process-budget/spec.md |
| REQ-251 | Issue #5 コメント 2「進め方」3（監視役で SIGBREAK も扱う）、コメント 3 の 2（強制終了と SIGBREAK を別々に検証する） | 非機能 | コンソールの Ctrl+Break（SIGBREAK）を監視役で扱い、強制終了への対策とは別に検証する | 範囲外 | proposal.md Non-goals、Q-01 |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-251 | Ctrl+Break（SIGBREAK）のハンドラを、この change から外してよいか。Windows の CI で、本物の Ctrl+Break を監視役だけに送る方法がまだない。同じコンソールの全プロセスに送ると、テストの実行役も止まる | A: 外して、別の Issue で検証の方法から決める / B: ハンドラだけを足し、検証は後に回す / C: この change で検証の方法まで作る | A。検証できないハンドラを足すと、レビューの「別々に検証する」に合わない。Windows の CI を通すことには関係しない | no | | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-250 | 監視役が結果を書かずに終わったときは、kind を `interrupted` にし、理由を `reason` とメッセージに入れる。新しい kind は足さない | 外からの強制終了（Windows の `process.kill(pid, 'SIGINT')`）は、利用者や上位の処理による中断と同じに扱い、後続の操作を止めるのが安全。既存の呼び出し元（verify・run）は kind で分岐しているので、新しい kind を足すと分岐の漏れが起きる。利用者の中断とは `reason` の有無とメッセージで区別できる | | | |
| A-02 | REQ-250 | Windows で親が `taskkill /pid <PID> /T /F` を送るとき、PID が別のプロセスに再利用されている可能性は扱わない | 監視役が終わってから親が taskkill を送るまでは、ふつう数十ミリ秒で、その間に対象が終わり PID が再利用される見込みは小さい。POSIX はプロセスグループへ送るので、グループに生きたメンバーがいる限り再利用されない | | | |
| A-03 | REQ-181, REQ-250 | この change は REQ-181 だけを MODIFIED にし、PR #13 が archive する count-supervisor-startup-budget（REQ-180 を MODIFIED）とは別の Requirement を変える。PR #13 のマージを待たずに進める | Issue #5 コメント 2 では、同じファイルを変えるので PR #13 のマージのあとに始めるとしていた。count-supervisor-startup-budget のコードはすでに main にあり、差分仕様も別の Requirement なので、archive の順番によらず重ならない | | | |
