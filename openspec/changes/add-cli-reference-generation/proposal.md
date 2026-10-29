# Proposal

## Why

WBS W6-8・Issue #104は、CLIのコマンドとオプションからリファレンスを生成し、実装とのずれをCIで検出することを求める。現在はargs.tsが汎用パーサだけを持ち、受理名・ヘルプ・usageがmain.tsへ分散しているため、quality側とは別changeでCLIの生成元を揃える。

## What Changes

- 現在の5コマンドとtraceの4操作、各オプション・共通操作・必須条件・既定値を静的な共通記述へ集約する。
- 共通記述からCLIの受理名・候補と既存ヘルプ、`docs/guide/3.reference/5.cli.md`を導出する。現在のusage・ヘルプ文字列・表示順・候補順・構文・診断を保つ。
- 決定的な生成と読み取り専用checkを用意し、既存のテスト経路でページの欠落・改変・定義との不一致を失敗にする。
- quality側の受入後にguideの導線と開発手順を追記し、CLI内部の整理をpatch changesetへ記録する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `reference-docs`: `add-quality-reference-generation`で新設された同名capabilityへ、CLIの生成内容・既存動作の保持・生成一致の要件を追加する。REQ-320〜322とPurposeは複製しない。

## Impact

後続実装の対象はpackages/cli/src/args.ts・main.ts、専用の生成スクリプト・ページ・ID付き試験・changeset、guideの入口とdocs/devの手順である。CLIの新しい引数や製品exports・実行時依存・既存8 JSONの変更は含めない。C-001のv2出力・scope・証拠採否を先取りしない。

## Planning Boundary / Dependencies

計画の基準mainは`684abf0`。計画commit `9db6f64`を、quality生成PR #142と仕様反映PR #143を受入済みのmain `8d2d7ce`へ引き継いだ。`reference-docs`のPurpose・REQ-320〜322と全7タスク完了を確認し、実装開始の依存を解消した。既存delivery指示による別のapply作業で実装し、guide入口・共通手順への追記は受入済みの内容を保って行う。
