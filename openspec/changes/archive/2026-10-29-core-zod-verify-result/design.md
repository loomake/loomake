# Design: core-zod-verify-result

## Context

背景と対象範囲は proposal.md を参照する。この文書は archive に先立ち、受入済みの [PR #113](https://github.com/loomake/loomake/pull/113)、trace.md の承認済み A-01〜A-03、既存の実装に基づいて補完した。新しい設計判断は加えない。

## Goals / Non-Goals

verify 結果の構造を一つの Zod スキーマで定義し、公開型と配布する JSON Schema をそこから導出する。既存の JSON の必須項目と値を保ち、未知のフィールドを保持する。ほかの契約は proposal.md と trace.md に記した後続の change が扱う。

## Decisions

### 構造と型の定義

`verify-result-schema.ts` に `verifyModeSchema`・`verifyCheckResultSchema`・`verifyResultSchema` を置く。`verify-result.ts` はこれらを型だけの import で参照し、`VerifyMode`・`VerifyCheckResult`・`VerifyResult` を `z.infer` から導出する。手書きの型との二重管理をなくす。

`schemaVersion` は `1.0.0`、mode と status は既存の列挙値、coverage は任意の要件 ID ごとの配列を保つ。A-01 に従い、最上位と results の要素は `z.looseObject` で定義し、未知のフィールドと値を解析結果に残す。JSON Schema でも未知の項目を許し、この互換性の変更では版を上げない。

### 公開入口と起動時の読み込み

A-03 に従い、core の公開入口は Zod を静的に読まない。`loadVerifyResultSchemas()` がスキーマのモジュールを動的 import する。版の定数と型は、スキーマを実行時に読まないモジュールから公開する。スキーマは解析や検証で使うときに読み、CLI の起動性能の試験と上限を維持する。

### JSON Schema と配布の検証

`json-schema.ts` が Zod の `z.toJSONSchema()` から JSON Schema を生成し、既存の公開パス `schema/verify-result.schema.json` へ書き出す。A-02 に従い、生成結果と管理するファイルの一致を core のテストで検査し、新しい CI の手順は追加しない。

core の外部の実行時依存として採用済みの `zod` を追加する。ソースを複製する検査では依存を読めるようにし、配布物の検査では実行時依存を npm の cache に用意してからオフラインでインストールする。公開される型と JSON Schema を、配布されたパッケージでも確認する。

## Risks / Trade-offs

スキーマを静的に import すると CLI の起動に影響するため、型だけの import と遅延 loader を使い、入口から静的にたどれる範囲の試験で確認する。JSON Schema の手編集によるずれは、生成した内容との一致試験で検出する。未知のフィールドを許す変更は A-01 の承認範囲とし、既存の必須項目や列挙値を弱めない。
