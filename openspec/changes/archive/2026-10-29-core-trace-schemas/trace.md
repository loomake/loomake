# Trace: core-trace-schemas

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #60](https://github.com/loomake/loomake/issues/60) の作業・完了条件 | W1-1 | 2026-10-29 |
| openspec/changes/core-zod-verify-result/trace.md の REQ-280 | 現行 | 2026-10-29 |
| openspec/specs/trace-record/spec.md の証拠の記録・文書の保存、trace-report/spec.md の出力形式・古い形式・証拠の実行時検証 | 現行 | 2026-10-29 |
| 管理役からの担当指示：構造だけの移行、number の schemaVersion、任意の documents、同期実行と既存整合性検査の維持、未知保持・lazy・配布 | 実装範囲の指定 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-302 | Issue #60、既存 REQ-280、担当指示の型互換・未知保持 | 機能 | Evidence・EvidenceDocument・Report・ReportRow の既存構造を core の Zod スキーマへ移し、導出型と未知フィールドを保持する。number の版と任意の documents を保持する | 反映済 | specs/core-parsers/spec.md |
| REQ-303 | trace-record・trace-report の既存仕様、担当指示の同期境界 | 制約 | 従来の公開元と同期処理・意味検証・JSON 整形を保つ。core の層を守り、zod を遅延読み込みする | 反映済 | specs/core-parsers/spec.md |
| REQ-304 | Issue #60 の完了条件、担当指示の JSON 生成・配布 | 非機能 | Evidence/Report の JSON Schema を生成・公開し、差分を CI で検出する。既存 JSON は変更しない | 反映済 | specs/core-parsers/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
