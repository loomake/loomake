# make-ci-change-selection-explicit

## Why
CI の完了ゲートは、PR のブランチ名が change-id と一致するときだけ、要件とタスクを確かめる `verify --change <id> --done` を実行する。名前を付け間違えると、品質コマンドだけが実行され、検査が抜けたことに気づけない。docs/evaluation.md の 2026-10-24 の追加評価で指摘された。

## What Changes
- PR 本文の `loomake-change: <id>` の行で、対象の change を明示できるようにする。`none` で change のない PR だと明示できる（REQ-132）
- 明示がなければ、PR で変えたファイル（`openspec/changes/<id>/` の下）とブランチ名から対象を決める（REQ-132）
- 対象が複数あれば、それぞれに完了ゲートを実行する（REQ-132）
- コードを変えていて対象を特定できない PR は、明示を促して失敗にする。文書だけの PR と archive の PR は、品質コマンドだけを実行する（REQ-132）

## Non-goals
- 利用者のプロジェクトに配る CI の雛形（いまの init は CI を配らない）
- PR のラベルで change を明示すること
- ブランチ保護の設定

## Impact
- 影響する capability：monorepo（Requirement の変更）
- 影響するコード：`scripts/ci-gate.mjs`、`.github/workflows/ci.yml`、`tests/monorepo.test.ts`
