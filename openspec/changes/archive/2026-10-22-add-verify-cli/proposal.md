# add-verify-cli

## Why
仕様ゲートと完了ゲートは、未確定の要件が残る間は実装させず、全要件にテストがあることを機械的に確かめるための中核である。試作の `scripts/verify.mjs` を `@loomake/kit` の verify と CLI `loomake verify` に置き換え、CI・AI・将来の trace／runner が同じ結果（JSON）を使えるようにする。出典：要件定義書 v0.1 §5.3・§6

## What Changes
- `loomake verify --change <id> --spec-only`（仕様ゲート）と `--done`（完了ゲート）を追加する
- テストの有無は、test コマンドが書き出したテストランナーの JSON レポートで判定する（Q-11）
- `--json` で core のスキーマに沿った結果と、要件ごとのテストファイル一覧を出力する
- 終了コード（合格 0・不合格 1・使い方の誤り 2）を定める
- `--change` を省略したときは commands（lint・typecheck・test）だけを実行する
- kit の実行時依存を core のみ、`loomake` の実行時依存を core と kit のみに保つ
- 1,000 ファイル・500 要件で 3 秒以内（暫定）の性能を確かめる
- エラーメッセージを日本語で提供する
- 完成後、試作の `scripts/verify.mjs` を置き換える（タスク 3.2）

## Non-goals
- `loomake init`（add-init-cli）
- `trace`・`run` サブコマンド（setup-monorepo の Non-goals を参照）

## Impact
- 影響する capability：verify（新規）
- 影響するコード：`packages/kit/`、`packages/cli/`（`loomake`）、`scripts/verify.mjs`、`.github/workflows/ci.yml`
- 前提：setup-monorepo・add-core-parsers が完了していること
- 要件書 v0.5：Q-08 の回答に合わせて §6 N-02 を直した（REQ-047）
