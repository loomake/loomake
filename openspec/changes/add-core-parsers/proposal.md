# add-core-parsers

## Why
kit・trace・runner は、trace.md・spec.md・tasks.md・テストファイルから同じ情報を読み取る。試作の verify.mjs に埋まっている解析処理を `@loomake/core` に切り出し、契約（verify 結果の JSON スキーマ）を先に固めれば、後続のツールが同じ読み方を共有できる。出典：要件定義書 v0.1 §4・§6・§7

## What Changes
- trace.md の 3 つの表（要件台帳・確認事項・仮定）を型付きで読む処理を追加する
- spec.md の Requirement、tasks.md のタスク、テストファイルの `[REQ-xxx]` を取り出す処理を追加する
- verify 結果の JSON スキーマ（`schemaVersion` 付き）を公開する
- trace.md の空テンプレートを生成する関数を追加する
- 解析エラーにファイル名と行番号を含める
- core の実行時依存をゼロに保ち、OpenSpec 1.14 以上の書式を読めるようにする

## Non-goals
- CLI（core は CLI を持たない。要件定義書 §4 冒頭）
- `verify` の実行ロジックと CLI（add-verify-cli）
- 範囲外とされた `@loomake/trace`・`@loomake/runner` は setup-monorepo の Non-goals を参照

## Impact
- 影響する capability：core-parsers（新規）
- 影響するコード：`packages/core/`
- 前提：setup-monorepo が完了していること
