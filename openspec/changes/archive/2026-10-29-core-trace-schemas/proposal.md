# Proposal: core-trace-schemas

## Why

[Issue #60](https://github.com/loomake/loomake/issues/60) の W1-1 に残る、既存の証拠・リリースレポートの型の Zod 移行を行う。出典は change core-zod-verify-result の REQ-280 と現在の trace-record・trace-report の仕様である。

## What Changes

`Evidence`・`EvidenceDocument`・`Report`・`ReportRow` のデータ構造を core の Zod スキーマで定義し、型を導出する。trace の従来の公開元では再エクスポートする。Evidence と Report の JSON Schema を生成・公開し、既存 5 種類の JSON Schema の内容を保持する。

## Non-goals

証拠の整合性検査、I/O、同期 API、出力の整形は変えない。quality-report は別の change が担当する。日時・SHA・パスの新しい制約、版の改名、documents の既定値は追加しない。

## Capabilities

### Modified Capabilities

- `core-parsers`: 証拠とリリースレポートの構造スキーマ・導出型・JSON Schema を追加する。

## Impact

core のスキーマ・型・JSON 生成と公開入口、trace の型と定数の再エクスポート、対応試験と配布確認を変更する。実行時依存の範囲は変えない。
