# Trace: gate-base-remote-ref

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #42](https://github.com/loomake/loomake/issues/42) の 3「gate のベースを `refs/remotes/origin/${base}` にそろえる」 | - | 2026-10-28 |
| 依頼者の指示（作業中の担当とのチャット）：Issue #42 の 3 を直す。1・2・4 は範囲外 | - | 2026-10-28 |
| openspec/changes/shorten-ci-wall-clock/ のタスク 4.8（`scripts/ci-docs-only.mjs` のベースを `refs/remotes/origin/<base>` に直した） | - | 2026-10-28 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-272 | Issue #42 の 3、依頼者の指示（2026-10-28） | 非機能 | gate のベースを `refs/remotes/origin/${base}` にそろえる。同じ名前のタグやブランチがあっても、リモートの追跡ブランチとの差分で change を選ぶ。`tests/ci-docs-only.test.ts` と同じ形の試験（同じ名前のタグやブランチがあるリポジトリ）を足す | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-272 | 要件 ID を REQ-272 にした。main と開いている PR で最大の番号は REQ-271（change shorten-ci-wall-clock が案 B のために取ってある）なので、その次にした。並行して作っている change が同じ決め方をすると、番号が重なる。どう振り分けるか | A: 先にマージした方が残し、あとの方が番号を振り直す / B: 前もって番号を分ける | A。どちらが先にマージするか分からず、archive のときに重なりを検査できる | no |  |  |  |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-272 | change の選び方の要件（REQ-132）は MODIFIED にしない。差分のベースの要件を、monorepo の capability に足す | REQ-132 の Requirement を書き換えると、既存の Scenario のレビューを読み直すことになる。ベースの書き方は、選び方の順番とは別の決まりとして書ける |  |  |  |
