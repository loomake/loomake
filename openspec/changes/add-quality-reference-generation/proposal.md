# Proposal: add-quality-reference-generation

## Why

WBS W6-8とIssue #104は、コードに一致するCLI・quality.yamlリファレンスと再生成差分の検出を求めている。先行範囲としてquality.yamlの現行全構造を生成し、手書きの項目一覧がスキーマからずれることを防ぐ。

## What Changes

- coreの現行quality.yamlスキーマから生成したJSON Schemaを元に、`docs/guide/3.reference/4.quality-yaml.md` を生成する。
- 全階層の項目・型・入力時の必須/任意・条件付き必須・既定値・制約・既存descriptionを表示する。対象外（NA）の分岐と、入力省略時の補完を区別する。
- 同じ入力から同じ内容を生成し、checkモードで生成物の欠落・改変を検出する。既存のテスト実行経路で再生成一致を確かめる。
- `docs/guide/index.md` から生成ページへリンクし、生成と検査の開発手順を `docs/dev/` へ記す。

## Capabilities

### New Capabilities

- `reference-docs`: quality.yamlの現行構造を、スキーマと一致する利用者向けリファレンスとして提供する。

### Modified Capabilities

なし。既存のqualityスキーマ・判定・CLIの契約は変更しない。

## Impact

後続実装の対象は生成スクリプト、生成ページ、guideの導線、ID付き試験と開発手順。既存のJSON Schema生成と一致試験を利用し、公開8 JSON・型・exports・実行時依存・CLIを変えない。配布パッケージの版変更は不要で、文書と開発用の道具の変更として空のchangesetを計画する。

Issue #104のCLI共通定義・CLIリファレンス生成は後続へ残し、この先行範囲だけではIssueをcloseしない。未確定のmetric/sourceの名前空間、C-001のv2出力・scope・証拠の採否などを説明へ先取りしない。

## Planning Boundary / Dependencies

このターンは計画成果物だけを作る。基準mainは `8426d8c`。#102は受入済み、#60は保持修正の実装を受入済みだが仕様反映・archiveの最終受入待ちであり、実装開始前に確認する。#60受入と仕様ゲート成功を確認した後の実装は、既存delivery指示の範囲で別のapply作業として進める。
