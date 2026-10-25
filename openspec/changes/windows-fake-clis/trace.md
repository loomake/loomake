# Trace: windows-fake-clis

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-240 | [Issue #5](https://github.com/loomake/loomake/issues/5) の 2026-10-25T21:16 の調査結果の ④⑤ と「進め方」の change B、21:43 のレビュー（④⑤ の待ち時間・予算の調整を認めた範囲）、21:44 の返信 | 非機能 | Windows でも動く偽の CLI を作る。偽の CLI が狙った段階に届いた印を先に確かめてから、期限・終了コード・後続の処理を確かめる。予算を延ばすところは延ばすだけで終えず、1 操作の期限より長く待ったことと、予算に猶予を足した時間のうちに止まったことを検査する | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-240 | 要件 ID を REQ-240 にした。main と開いている PR のブランチの最大は REQ-235（PR #10）で、それに 5 を足した。並行して作っている change A（fix-windows-test-assumptions）が同じ決め方で同じ番号を使うと重なる。どう振り分けるか | A: 先にマージした方が残し、あとの方が番号を振り直す / B: change A は REQ-240 から、change B は REQ-245 からのように前もって分ける | A。どちらが先にマージするか分からず、archive のときに重なりを検査できる | no | | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-240 | テストだけを直す change でも、差分仕様が要る。製品の振る舞いの要件（REQ-182・REQ-183・REQ-192）は変えず、試験の基盤への要件を monorepo の capability に足す | verify は差分仕様のない change を不合格にする。試験の基盤への要件は、3 つの OS の CI（REQ-049）と同じ monorepo に置くのが近い。製品の要件を MODIFIED にすると、振る舞いを変えたように見える | | | |
| A-02 | REQ-240 | Windows の偽の git は、`process.execPath` をハードリンクした `bin/git.exe` と、`NODE_OPTIONS=--require` で読み込む本体で作る | shell なしの起動では `.exe` しか見つからない。使い捨ての PR #17（run 40237254267）で、Windows の CI で動くことを確かめた。SEA やコンパイルは道具が増える | | | |
| A-03 | REQ-240 | 期限から止まるまでの猶予を 3 秒とみなす | 監視役の SIGTERM から SIGKILL までの 250ms、子の終了を待つ最大 1 秒、Windows の taskkill の最大 1 秒を足し、プロセスの終了と親への戻りの分を見込んだ | | | |

## 調査の出典

- 失敗の run：main f535fd2 の [run 40230837026](https://github.com/loomake/loomake/actions/runs/40230837026)（quality (windows-latest)）。ロック取得と push の試験にはログに `shim-start` がなく、`"stalled":false` だった。auth・list・create の試験では、`forward-end` が `"error":"ENOENT"` だった。
- 対象の試験：`external-budget.test.ts` の `[REQ-182] auth / create / list / push の期限後に先へ進まず、再実行で重複させない`、`[REQ-182] ロック取得のGitが止まったら変更と記録を作らない`、`[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する`、`[REQ-183] traceのGitも共有予算で止める`。見かけの合格は `[REQ-183] OpenSpec検証の時間切れをCLI不存在と区別する` と `[REQ-192][REQ-182] run の準備中に git が時間の上限で止まると…終了コード 3`。
- 対象外：`[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない` と `packages/kit/test/process.test.ts` の 2 件（change C）。`run.test.ts` の REQ-158、`scripts/` の配布物、`release-security`、`guards`（change A）。
