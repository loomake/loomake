# warn-unknown-config-keys

## Why
実装全体の評価（作業記録 2026-10-23 の 42 節）で、loomake.config.json の知らないキーが黙って無視されることが分かった。たとえば `commands` を `comands` と書き損じると、品質コマンドが 1 つも実行されないまま verify が合格する。

## What Changes
- verify は、loomake.config.json に知らないキーがあれば、そのキーを警告として表示する（REQ-039）
- doctor は、loomake.config.json に知らないキーがあれば、そのキーを注意として表示する（REQ-134）

## Non-goals
- 知らないキーを使い方の誤りにすること（新しい版の設定を古い版の loomake で読むと止まってしまう）
- 設定の JSON スキーマを配ること
- `commands` の下のキーを確かめること（品質コマンドの名前は利用者が決める）

## Impact
- 影響する capability：verify・doctor（Requirement の変更）
- 影響するコード：`packages/kit/src/verify/config.ts`・`run.ts`、`packages/kit/src/doctor/doctor.ts`
