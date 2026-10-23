# add-run-pr

## Why
完了ゲートが通った change を、人がレビューできる形にして渡す。trace の証拠を記録してから PR を作り、本文に「どの要件を、どのテストで確かめたか」を載せる。出典：run 要件定義書 v0.1 §1、§3.5

## What Changes
- 完了ゲートに合格したら、`loomake trace record` で証拠を記録してコミットし、ブランチを送って PR を作る（REQ-114）
- PR の本文に、change の概要、完了ゲートの結果、要件ごとのテストの一覧を載せる（REQ-115）
- PR は gh CLI で作る（REQ-116）

## Non-goals
- REQ-091：PR のマージ

## Impact
- 影響する capability：run-pr（新規）
- 影響するコード：run のパッケージ
