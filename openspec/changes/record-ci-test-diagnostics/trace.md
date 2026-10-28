# Trace: record-ci-test-diagnostics

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 本会話の依頼「開発のボトルネックを解消したい。方法検討して」と、改善案への「進めて」 | - | 2026-10-29 |
| [Issue #5 とコメント](https://github.com/loomake/loomake/issues/5)、[PR #109](https://github.com/loomake/loomake/pull/109)、[PR #43](https://github.com/loomake/loomake/pull/43) | 調査時点 | 2026-10-29 |
| main 56bd425 の ci.yml・vitest.config.ts・docs/dev/ci.md・docs/dev/testing-across-os.md | 56bd425 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-283 | 本会話の改善案と着手指示、Issue #5 の実行と失敗の照合 | 非機能 | テスト結果と実行情報を結び付け、実行ごとに区別して保存する | 反映済 | specs/ci-test-diagnostics/spec.md |
| REQ-284 | 本会話のCI失敗対応と所要時間の調査案、Issue #5、PR #109 の実行比較 | 非機能 | 失敗と所要時間を要約し、レポートの欠損・不正・未実行を成功と区別する | 反映済 | specs/ci-test-diagnostics/spec.md |
| REQ-285 | 本会話の検証の保証を維持する改善案、AGENTS.md 4章、docs/dev/ci.md | 非機能 | 品質判定を変えず、失敗後にも診断を保存する。保存期間と対象を定める | 反映済 | specs/ci-test-diagnostics/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## 作業範囲

実装担当は record-ci-test-diagnostics の1担当とする。PR #109 の試験修正と PR #115 の archive は別担当で、今回のファイルと重ならない。開始時に open な PR と worktree を照合した。新しい要件 ID は REQ-283〜285 とし、実装前に重複を再確認する。

7日の保存期間と表示件数の上限は、この計画の提案値であり、既存の合意事項として扱わない。診断対象は quality だけで、既知の失敗を自動で許容する判定には使わない。PR #109 が残す時間依存の不安定さは、この change 自体では解消しない。
