# archive metadata の限定分類（[Draft PR #295](https://github.com/loomake/loomake/pull/295)）

1. やったこと：[Draft PR #295](https://github.com/loomake/loomake/pull/295)の `classify-unchanged-archive-metadata` の1.1〜5.2で利用者の具体承認を記録し、完全blob一致など全条件を満たすmetadata移動だけを3つの呼出側でL1とする共有判定と追加試験、承認済みAGENTS最小追記を実装した。独立確認の文書2指摘は提案時点の記録と現在の状態を分けて修正した。採用済みの設計とQ295-TREE-01=A・02=Bに従ってtask 2〜5を再開し、HEAD tree証明をquality・gate・純粋判定で共有する修理と、二重日付・移動先階層・移動元階層の独立した負例3件を追加した。
2. verify：【旧headの記録】strict・仕様ゲート・lint・型検査・対象183件と、通常のローカル完了ゲート21項目が成功した。全件レポートは2260件中2252 PASS・0 FAIL・既存Windows 8 pendingで、snapshotの更新はない。今回の修理では新回帰が旧実装で10 FAIL、修理後の対象3ファイルが164 PASSとなり、lint・型検査・通常localdoneも成功した。正常doneは21項目すべてPASS、全件2284件中2276 PASS・0 FAIL・既存Windows 8 pending・snapshot更新0である。準備誤起動のdone 1回は143で中断し、全件レポート未生成を保存した。管理役の再実行承認後に正常doneを1回実行した。
3. 残っている確認事項・仮定：承認待ちはない。移動先の存在はREQにない追加条件なので課さず、成功した空treeは既存と同じ[]、読取・形式失敗と証明未指定は例外不成立とする。修理後headの新CI・3 OS・独立レビュー・main採用は未完了で、#238への適用はmain採用後からとする。
4. 次にやること：正常localdoneの元レポート、dirty入力、全23 Scenario対応、原文保持と誤起動・プロセス確認の記録を管理役へ渡す。実装者の保全照合を独立レビューの代用にせず、管理役が別担当の保全と新しいOpus、最新mainとのCIを確認してからmainへ採用する。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [Draft PR #295](https://github.com/loomake/loomake/pull/295) | 未測定 | 未測定（着手時刻未記録） | 進行中 | 未実施 | 未実施 |
