# Tasks

## 1. スキーマと公開型

- [ ] 1.1 trace・spec・tasks の Zod スキーマと導出型を追加し、既存の解析結果・境界値・未知フィールドを要件 ID 付きテストと型チェックで確認する（REQ-298）

## 2. バージョンと公開入口

- [ ] 2.1 初版のバージョン定数と遅延ロード関数、core の利用案内を追加し、返却形式と静的 import の検査を要件 ID 付きテストで確認する（REQ-299）

## 3. JSON Schema と配布

- [ ] 3.1 JSON Schema の生成・公開 exports・配布物 smoke を拡張し、生成差分・JSON による解析結果の検証・配布物の読込を要件 ID 付きテストで確認する（REQ-300）

## 4. 統合検証

- [ ] 4.1 lint・型チェック・全体テストと `pnpm -s verify --change core-parser-schemas --done` を通し、全 Requirement の対応テストを確認する（REQ-298・REQ-299・REQ-300） <!-- loomake:gate=done -->

## Workflow follow-up

- 独立レビューと同じ head の必須 CI を確認する。Issue #60 全体は後続の作業があるため close しない。
- 受入後の仕様反映と archive は対応スキルの手順で行う。
