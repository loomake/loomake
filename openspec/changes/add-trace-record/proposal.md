# add-trace-record

## Why
「どの要件を、どのテストで、いつ確かめたか」を顧客に示すには、verify の結果を、検査したコミットと日時つきで、あとから書き換えられない形で残す必要がある。この記録が、検収レポート（add-trace-report）の証拠になる。出典：trace 要件定義書 v0.1 §1、§3.1

## What Changes
- `loomake trace record --change <id>` を追加する。`verify --done` を実行し、結果をコミットの SHA・日時と合わせて `.loomake/evidence/<change-id>/` に保存する（REQ-066）
- 作業ツリーに未コミットの変更があるときは記録しない（REQ-067）
- 既存の記録を書き換えず、記録のたびに新しいファイルを足す（REQ-068）
- パッケージ `@loomake/trace` を足す（REQ-083）。CLI 本体 `loomake` の依存に `@loomake/trace` を足す（REQ-047）

## Non-goals
- REQ-063：テストの実行（kit の verify が受け持つ）
- 後のフェーズ：REQ-069（記録ごとの中身のハッシュ）

## Impact
- 影響する capability：trace-record（新規）、verify（「実行時依存の範囲」の変更）
- 影響するコード：`packages/trace/`（新規）、CLI の trace サブコマンド
