# Trace: windows-fake-clis

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-240 | [Issue #5](https://github.com/loomake/loomake/issues/5) の 2026-10-25T21:16 の調査結果の ④⑤ と「進め方」の change B、21:43 のレビュー（④⑤ の待ち時間・予算の調整を認めた範囲）、21:44 の返信 | 非機能 | Windows でも動く偽の CLI を作る。偽の CLI が狙った段階に届いた印を先に確かめてから、期限・終了コード・後続の処理を確かめる。予算を延ばすところは延ばすだけで終えず、1 操作の期限より長く待ったことと、予算に猶予を足した時間のうちに止まったことを検査する | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-240 | 要件 ID を REQ-240 にした。main と開いている PR のブランチの最大は REQ-235（PR #10）で、それに 5 を足した。並行して作っている change A（fix-windows-test-assumptions）が同じ決め方で同じ番号を使うと重なる。どう振り分けるか | A: 先にマージした方が残し、あとの方が番号を振り直す / B: change A は REQ-240 から、change B は REQ-245 からのように前もって分ける | A。どちらが先にマージするか分からず、archive のときに重なりを検査できる | no | B。番号は前もって分け、change A（PR #19）は REQ-236、change B（PR #20）は REQ-240、change C（PR #22）は REQ-250・REQ-251 のまま保つ | 依頼者 | 2026-10-26 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-240 | テストだけを直す change でも、差分仕様が要る。製品の振る舞いの要件（REQ-182・REQ-183・REQ-192）は変えず、試験の基盤への要件を monorepo の capability に足す | verify は差分仕様のない change を不合格にする。試験の基盤への要件は、3 つの OS の CI（REQ-049）と同じ monorepo に置くのが近い。製品の要件を MODIFIED にすると、振る舞いを変えたように見える | 承認。条件は、変更をテストの中に限ることと、既存の停止と重複防止の検査を保つこと | 依頼者 | 2026-10-26 |
| A-02 | REQ-240 | Windows の偽の git は、`process.execPath` をハードリンクした `bin/git.exe` と、`NODE_OPTIONS=--require` で読み込む本体で作る | shell なしの起動では `.exe` しか見つからない。使い捨ての PR #17（run 40237254267）で、Windows の CI で動くことを確かめた。SEA やコンパイルは道具が増える | 承認。条件は、変更をテストの中に限ることと、既存の停止と重複防止の検査を保つこと | 依頼者 | 2026-10-26 |
| A-03 | REQ-240 | 期限から止まるまでの猶予を 3 秒とみなす | 監視役の SIGTERM から SIGKILL までの 250ms、子の終了を待つ最大 1 秒、Windows の taskkill の最大 1 秒を足し、プロセスの終了と親への戻りの分を見込んだ | 承認。条件は、変更をテストの中に限ることと、既存の停止と重複防止の検査を保つこと | 依頼者 | 2026-10-26 |

## 調査の出典

- 失敗の run：main f535fd2 の [run 40230837026](https://github.com/loomake/loomake/actions/runs/40230837026)（quality (windows-latest)）。ロック取得と push の試験にはログに `shim-start` がなく、`"stalled":false` だった。auth・list・create の試験では、`forward-end` が `"error":"ENOENT"` だった。
- 対象の試験：`external-budget.test.ts` の `[REQ-182] auth / create / list / push の期限後に先へ進まず、再実行で重複させない`、`[REQ-182] ロック取得のGitが止まったら変更と記録を作らない`、`[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する`、`[REQ-183] traceのGitも共有予算で止める`。見かけの合格は `[REQ-183] OpenSpec検証の時間切れをCLI不存在と区別する` と `[REQ-192][REQ-182] run の準備中に git が時間の上限で止まると…終了コード 3`。
- 対象外：`[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない` と `packages/kit/test/process.test.ts` の 2 件（change C）。`run.test.ts` の REQ-158、`scripts/` の配布物、`release-security`、`guards`（change A）。

## Windows の CI での確認（tasks 3.1）

origin/main（e26bf94）をマージした 9df179b で、ci の run 40450183461 を 2 回流した（1 回目は 2026-10-27 13:31 JST、2 回目は 13:39 JST に `gh run rerun --failed` で開始）。照合には、マージ元と同じ e26bf94 の main の run 40449196243 を使った。

マージでは external-budget.test.ts が競合した。main の PR #23（`shim` と `expectStalledAt`）がこの change と同じ検査を別に実装していたため、`fakeCli` と `expectStalled` の側を残し、main の側にだけあった次の検査を移した。止まった操作を引数の先頭で照合する（auth は `auth status` まで）。止まる前の転送がシグナルで終わったときも失敗とする。auth・list は、止まった印から「1 操作の期限 - 1000ms」以上待ったことを確かめる。

### 対象の試験の結果（quality (windows-latest)）

| 試験 | 1 回目（job 122010823542） | 2 回目（job 122013273149） | main 40449196243 |
|---|---|---|---|
| ロック取得のGitが止まったら変更と記録を作らない | 通過 3586ms | 通過 1925ms | 失敗 |
| 準備で使った時間を含めてエンジンの期限を制限する | 通過 8471ms | 通過 8700ms | 通過 |
| 事前の認証確認が期限切れなら実装も記録も始めない | 通過 2434ms | 通過 2915ms | 通過 |
| pushの期限後に先へ進まず、再実行で重複させない | 通過 44855ms | 通過 45973ms | 失敗 |
| authの期限後に先へ進まず、再実行で重複させない | 通過 14767ms | 通過 18632ms | 失敗 |
| listの期限後に先へ進まず、再実行で重複させない | 通過 15777ms | 通過 20232ms | 失敗 |
| createの期限後に先へ進まず、再実行で重複させない | 通過 43882ms | 通過 45164ms | 失敗 |
| traceのGitも共有予算で止める | 通過 1307ms | 通過 1531ms | 失敗 |
| OpenSpec検証の時間切れをCLI不存在と区別する | 通過 1394ms | 通過 1443ms | 失敗 |
| run の準備中に git が時間の上限で止まると…終了コード 3 | 通過 2076ms | 通過 2201ms | 失敗 |

external-budget.test.ts のほかの 4 件のうち、対象外の `[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない` は 2 回とも失敗した（change C の範囲）。残りの 3 件は 2 回とも通った。

### 残った失敗の照合

Windows の失敗は 1 回目が 16 件、2 回目が 15 件で、main の run 40449196243 は 23 件だった。main にない新しい失敗はなかった。試験ごとに、失敗箇所とエラーを main と照合した。

| 試験 | 1 回目 | 2 回目 | main との照合 |
|---|---|---|---|
| process.test.ts の REQ-181・REQ-181/182 の 2 件 | 失敗 | 失敗 | 箇所（:92:35、:74:89）とエラーが一致。対象外（change C） |
| external-budget.test.ts の REQ-183（中断後に次のコマンドを実行しない） | 失敗 | 失敗 | エラーが一致。箇所はマージで行がずれただけで、同じ検査（main :235:71、この PR :263:71）。対象外（change C） |
| guards.test.ts の REQ-204 | 失敗 | 失敗 | 箇所（:17:12）とエラーが一致（change A） |
| run.test.ts の REQ-158 | 失敗 | 失敗 | 箇所（:794:53）とエラーが一致（change A） |
| ai-journeys.test.ts の 2 件 | 失敗 | 失敗 | 箇所（:14:60）とエラーが一致（change A） |
| package-artifacts.test.ts の 3 件 | 失敗 | 失敗 | 箇所とエラーが一致（change A） |
| release-security.test.ts の 5 件 | 失敗 | 失敗 | 箇所とエラーが一致（change A） |
| input-boundaries.test.ts の `[REQ-173] 通常runで巨大な検証失敗を指示へ加える前に止まり、エンジンを起動しない` | 失敗 5013ms | 通過 4698ms | main 40449196243 では通過。試験名・失敗箇所（`tests/input-boundaries.test.ts:167:3`）・エラー（`Test timed out in 5000ms.`）が、main の run 40315486399 の失敗と一致するので、確認済みの既存の失敗に分類した。期待値と上限は変えていない |

ubuntu・macOS の quality と node20・node22 は 2 回とも成功した。gate は、tasks.md の 3.1・3.2 が未完了だったことだけで失敗した。

3.1 を完了にした 6bde26a の run 40452030727（3 回目）でも、対象の試験は Windows ですべて通った。残った失敗は 2 回目と同じ 15 件で、REQ-173 は通った。gate は 3.2 が未完了だったことだけで失敗した。
