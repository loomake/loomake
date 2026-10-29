# Design: core-trace-schemas

## Context

現行の型は trace の record.ts・documents.ts・report.ts にあり、証拠の整合性は evidenceProblem と既存の読み書き処理が検査する。REQ-280 の後続作業として構造の定義だけを core に集める。

## Goals / Non-Goals

スキーマから型と JSON Schema を導き、trace の従来の公開元と同期実行を保つ。quality-report、証拠の意味検証、I/O の変更は扱わない。

## Decisions

`trace-schemas.ts` に全 object を looseObject で定義し、既存 VerifyResult の構造スキーマを再利用する。schemaVersion は Evidence・Report とも number とし、版の適合性は従来の関数が判定する。documents は optional のままとし、ReportRow の日本語の列挙値と null を保持する。日時・SHA・パスには文字列という既存型以上の制約を足さない。

`trace-contracts.ts` はスキーマを import type で参照して 4 型を導出する。版の定数もここに置き、`loadTraceSchemas()` がスキーマを動的に読む。core は kit・trace を参照しない。trace の元のモジュールは型と定数を再エクスポートし、実行コードは変更しない。

新スキーマが検査するのはデータ構造である。Evidence の版の適合性、対象 change、日時、SHA、文書 hash、パスの重複などの証拠の正しさは、既存の evidenceProblem・読み取り・serializeEvidence が引き続き検査する。Zod を同期 validator に機械的に置き換えない。新スキーマの parse に成功しても、証拠として利用できるとは限らない。

CONTRACT_SCHEMAS に 2 形式を登録し、既存の生成コマンドを使う。埋め込む VerifyResult は構造と型を再利用し、単独公開スキーマの `$id` だけを外して、同じ検証器への登録時に識別子が衝突しないようにする。通常と publishConfig の exports に公開先を追加する。子の EvidenceDocument・ReportRow は loader 内でスキーマを公開し、JSON では親の構造に含める。既存 5 ファイルの不変も照合する。

## Risks / Trade-offs

構造スキーマと意味検証を混同すると、同期処理の拒否条件が変わる。既存実行コードを保持し、構造としては受理する不適合な版や日時を従来の意味検証が拒否する試験で境界を確認する。公開型は schemaVersion が number のままであることと、documents が任意のままであることを型検査でも確認する。
