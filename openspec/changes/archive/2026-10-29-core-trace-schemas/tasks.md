# Tasks

## 1. 仕様

- [x] 1.1 出典つき proposal・specs・design・trace を準備し、仕様ゲートを通す

## 2. 実装

- [x] 2.1 core の 4 構造スキーマ・導出型・遅延 loader を追加し、trace の従来の型と定数を再エクスポートする。同期実行コードを保持する（REQ-302・REQ-303）
- [x] 2.2 Evidence/Report の JSON Schema を生成し、通常・publish の公開入口と配布確認を追加する。既存 JSON を保持する（REQ-304）
- [x] 2.3 ID 付き試験・changeset を追加し、focused tests・lint・型チェックを通す（REQ-302〜REQ-304）

## 3. 確認

- [x] 3.1 CI の同じ完了ゲートで全体を検証し、全タスクを完了した最終 head で `pnpm -s verify --change core-trace-schemas --done` を通す <!-- loomake:gate=done -->
