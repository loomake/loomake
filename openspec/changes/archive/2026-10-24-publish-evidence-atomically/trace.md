# Trace: publish-evidence-atomically

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-174 | docs/review.mdの生成する証拠と読み取り上限の整合性、利用者の継続改善指示 | 制約 | 形式と完成JSONのバイト数を保存前に検証する | 反映済 | specs/evidence-publication/spec.md |
| REQ-175 | docs/review.mdの証拠保存失敗と復旧の到達基準、利用者の継続改善指示 | 制約 | 不完全な最終JSONを残さず既存の証拠を保護する | 反映済 | specs/evidence-publication/spec.md |
| REQ-176 | docs/review.mdの障害後の再実行の到達基準、利用者の継続改善指示 | 機能 | 保存失敗の停止記録と復旧後の再実行を維持する | 反映済 | specs/evidence-publication/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
