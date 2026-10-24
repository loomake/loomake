# Trace: isolate-run-decisions

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-204 | 利用者の全観点90点への改善指示、docs/review.mdのDDD評価、現在のrunとrun-guardsの仕様 | 制約 | エンジン終了と変更検出の判断をI/Oから分離し、現在の優先順位を保つ | 反映済 | specs/run-decision-policy/spec.md |
| REQ-205 | 同改善指示、現在のrunの完了ゲート・上限・検証中の状態変更の規則 | 制約 | 完了ゲートの判断をI/Oから分離し、現在の合格・停止・修正条件を保つ | 反映済 | specs/run-decision-policy/spec.md |
| REQ-206 | docs/review.mdのドメインの整合性条件と直接テストの到達基準 | 非機能 | 純粋な判断の入力不変性と、重要な誤りの検出を確かめる | 反映済 | specs/run-decision-policy/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## PR #47のmain取り込みの出典

利用者の「解消して」に基づき、mainで完了したstop-gate-on-interrupt、fix-evaluation-findings、guard-test-weakening、validate-evidence-recordsなどの仕様と試験を統合する。REQ-205の観測値に品質コマンドの中断を含め、mainのREQ-124の停止状態を保持する。Node下限と公開準備はmainのrequire-node-22とprepare-npm-publishの変更を取り込み、古いNode20の実行記録は当時の結果として扱う。
