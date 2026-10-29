# Proposal

## Why

公開スキーマは未知のフィールドを保持する契約だが、JSON の own property として渡された `__proto__` が解析結果から失われる。PR #132 の最終レビューで再現し、利用者は2026-10-29に仕様どおり安全に保持する修正を承認した。

## What Changes

- verify 結果、Markdown 解析結果、quality.yaml、quality-report の未知キーを、`__proto__` を含めて保持する。
- 解析結果の own property として値を保持し、入力・出力・共有プロトタイプを書き換えないことを回帰試験で確認する。
- 既知フィールドの検証、既定値、導出型、遅延ロードと配布 JSON Schema の契約を維持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: 未知キーの保持とプロトタイプを変更しない解析を明記する。

## Impact

`packages/core/src/` の対象スキーマと関連試験、changesetを更新する。Issue #60 の受入に関係する。未マージの trace スキーマは、その担当の作業を保持し、統合時に同じ保持契約を確認する。
