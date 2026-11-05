# Trace: verify-config-read-failure

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-395 | #61作業欄、verify-v2-c001/design.md:27,33,86、R-C001-07=A | 機能 | 既存設定の読取不能3と構文・内容不正2を分け、不在既定値・他コマンド・入力制約を保つ | 反映済 | specs/verify/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## 出典と判断
採否は既存C001と#61で確定済み。REQ395は[#61の予約](https://github.com/loomake/loomake/issues/61#issuecomment-6593491749)。技術方式と試験境界はOpus設計で定め、新しい人判断や設定緩和を追加しない。

OS失敗3と安全な入力拒否2の区別、他利用側のUsageError保持はOpus設計に基づき管理役が2026-11-03に技術判断として確認した。入力拒否を3へ広げる初期案と新runIf案は採らない。

自己レビューC2・親アクセスprobeにより、存在照会のOS失敗もREQ395の対象とする。管理役が2026-11-03に技術判断で原設計A02の除外を撤回し、補足Opus設計で修理する。新しい人判断はない。

## 再開と分割の記録（2026-11-05）
管理役が本会話で、REQ-395の独立製品修理とREQ-360の同期・archiveの2件に分ける案を採用した。根拠は[ADR 0006のレビュー規則](../../../docs/adr/0006-standing-approval-for-autonomous-delivery.md#レビュー規則2026-10-31-改訂)。[旧PR #378](https://github.com/loomake/loomake/pull/378)のレビュー3回と未レビューheadの履歴を引き継ぎ、同PRへの4回目として実行しない。

[REQ-360の同期・archiveは#366](https://github.com/loomake/loomake/issues/366)、[closeSync等の軽微は#377](https://github.com/loomake/loomake/issues/377)に残す。分割を完成範囲の削除や旧PRの受入とは扱わない。mainのREQ-360とactive changeの原本はこの製品修理では変更しない。
