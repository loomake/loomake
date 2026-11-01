# archive metadata の限定分類（[Draft PR #295](https://github.com/loomake/loomake/pull/295)）

1. やったこと：[Draft PR #295](https://github.com/loomake/loomake/pull/295)の `classify-unchanged-archive-metadata` の1.1〜5.2で利用者の具体承認を記録し、完全blob一致など全条件を満たすmetadata移動だけを3つの呼出側でL1とする共有判定と追加試験、承認済みAGENTS最小追記を実装した。独立確認の文書2指摘は、提案時点の記録と現在の状態を分けて修正した。
2. verify：strict・仕様ゲート・lint・型検査・対象183件と、通常のローカル完了ゲート21項目が成功した。全件レポートは2260件中2252 PASS・0 FAIL・既存Windows 8 pendingで、snapshotの更新はない。
3. 残っている確認事項・仮定：承認待ちはない。新しい独立Opusレビュー、3 OSと必須CI、CIの完了ゲート、main採用は未完了で、#238への適用はmain採用後からとする。
4. 次にやること：ローカル完了ゲートの元レポートと原文保持資料を管理役へ渡す。管理役が正規依頼で独立保全とOpusレビュー、CIを確認し、全条件を満たしてからmainへ採用する。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [Draft PR #295](https://github.com/loomake/loomake/pull/295) | 未測定 | 未測定（着手時刻未記録） | 進行中 | 未実施 | 未実施 |
