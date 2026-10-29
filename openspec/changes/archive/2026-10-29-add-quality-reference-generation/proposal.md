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

## Planning History / Dependencies

計画作成時の基準mainは `8426d8c`。計画ターンではコードを変更せず、#60の仕様反映・archive受入を依存に残した。その後、Issue #60のcompletedとPR #141の受入を照合し、仕様ゲート成功を確認して、既存delivery指示に基づくapplyへ進んだ。#102も受入済みである。
