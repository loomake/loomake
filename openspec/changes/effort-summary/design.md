# 設計

確定設計は Opus 536f301e-d036-48d4-b48d-cea30184a5de（claude-opus-5-5、対象 42c8b2da、設計工程）の §1〜§6。管理役が Q-P2-01〜06 の A を ADR 0006 に基づいて採用済み（PR #462 の trace.md に記録）。

## 公開 API（追加のみ）

- core：`readTable`、`Table`、`TableRow`（`size` を追加）。I/O と zod の静的な読み込みは足さない。
- kit：`createByteInputReader(overrides?)`。既存の `InputReader` 型・`createInputReader`・`readInputBytes` は変えない。
- trace：`readEffortInputs`（唯一の I/O）、`parseManualEffort`、`buildEfficiencyTable`、`formatEfficiencySection`と、その入出力の型。

## 読取り

1 つの bytes reader（1MiB／16MiB／4096 項目）を共有する。`docs/effort/` 直下の `.md`（`template.md` を除く）と、`.loomake/evidence/<change-id>/effort/` の正規名の JSON だけを読む。change の所在は archive を 1 回だけ列挙して解決する。decode は fatal な UTF-8、SHA-256 は原本の bytes から計算する。

## 集計と整形

純関数。欠測は値・部分計・不明の 3 状態で持ち、0 と区別する。削減率は BigInt の床除算で千分率にする。9 列と見出しは 7.8 と同じ文字にし、日時を入れない。セルは `\`・`|`・制御文字をエスケープし、共通の秘密置換を適用する。

## 関数の大きさ

利用者の指示により、関数の本体は基本 5 行以内にする。越える場合は理由をコミットメッセージに残す。
