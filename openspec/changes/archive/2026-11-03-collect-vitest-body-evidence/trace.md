# Trace
## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [Issue278](https://github.com/loomake/loomake/issues/278)・[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)・Opus3182cf02・[393予約](https://github.com/loomake/loomake/issues/62#issuecomment-6592346706)・後発52ケース | kit先行子の範囲 | 2026-11-03 |
## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-393 | Issue278・本人Q01〜03=A | 機能 | 明示bodyのmatcherと試行原情報を収集する | 反映済 | specs/test-body-evidence/spec.md |
## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-278-01 | REQ-393 | 実行証拠のないレポートと既存利用者の移行をどう扱うか | A: 完了ゲートでは合格に数えず、取得器と移行手順を提供 / B: 実行数が全件欠落なら従来pass | A。Bは空の標準JSONを引き続き通し、Issueの目的を満たさない。正常fixtureは実expect/証拠追加で期待を保持できる | yes | A（[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)） | 利用者rrr-www（Claude転記） | 2026-11-03 |
| Q-278-02 | REQ-393 | hookのexpectだけがありbodyが空の場合を数えるか | A: body内の実行だけを対象 / B: hookを含むテスト全体を対象 | A。空bodyを拒否する目的に沿う。ただし単純なafterEach取得器では実現できず、取得境界の設計を変える | yes | A（[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)） | 利用者rrr-www（Claude転記） | 2026-11-03 |
| Q-278-03 | REQ-393 | 取得器の導入と対応するassertionの範囲をどうするか | A: 検証したランナー/版/書式を明示し、未対応とnode:assert等を合格証拠に数えない / B: 対応未確認も従来pass | A。証拠のない合格を作らない。global/context/concurrent/retryは取得方式を実測後に確定し、Jestは実測が必要 | yes | A（[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)） | 利用者rrr-www（Claude転記） | 2026-11-03 |
## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
今回の子でgate受入政策や新しい仮定を採っていない。
