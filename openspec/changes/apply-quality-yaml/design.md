# Design

## Context

main 7d7f69b5 から Y dda1ade7 を明示的なローカル親として取り込む。Issue→品質 A→X→Y を含み、先行子は未 main。元 B2 の checkpoint 13e9817e の適用・保持をこの子、Step 7 の結果報告を後続 report-quality-yaml-application へ配分する。既存 Opus e8d1395f の同一設計であり、意味論を変更しない。

## Goals / Non-Goals

REQ-410 本文・四 Scenario・台帳行を byte 移管する。元 B2 の履歴・全六試験を保持し、旧 branch で試験を削除・reset しない。新規採番、包括承認、追加必須人手、仮定承認、計測 framework、runtime の YAML 編集 API は作らない。

## Decisions

- 元 Step 5 の文面を両 Skill へそのまま追加する。合意した既存値・ID の更新を許し、対象外の保持、予期しない新 ID 衝突・読取不良の停止、不在時の合意全文と上書き init 禁止を一体で扱う。一律の既存更新禁止は復活させない。
- 両 format の保持例は元 checkpoint の全文・五十二行を移管する。既存の変更前後の YAML 抜粋を使い、合意した linked_requirements の更新と、対象外の値・コメント・未知キー・順序・ID を分ける。新しい未知 root key の提案と、既存未知キーの保持は区別する。
- Step 7 は変更せず、旧報告四項目と次の一手を保つ。元 REQ-411 の二 Scenario と root 二件は後続 Report へ同一 ID で移管し、旧 B2 の試験削除コミットで配分しない。

## Review and tests

実装前の独立レビュー観点は REQ-410 全四 Scenario と旧契約の保持に固定する。元 root 三ケースと kit 保持例一ケースの全文・全 assert を移管し、同じ最終試験で RED/GREEN を確かめる。root は合意前後と保持、停止条件、不在時を確認し、kit は合意更新と対象外の既存値・未知キー・コメント・行順を照合する。

kit の parseDocument による抜粋の解析を、完成ファイルの loaded・実 AI 生成・人の実案件確認の成功にしない。X の完成例の読取・観測零件の試験は維持する。旧字句・期待値・skip・期限と、target/context の実定義参照、旧 evidence・六分類・旧三表・非創作の条件を保持する。

## Risks / Trade-offs

固定 local 親と元 checkpoint を実装前に確認する。REQ-025〜033・055・059・136 と先行子の追加要件を保ち、runtime/API・parser/schema・依存・設定は変えない。自身の差分は固定親基準で完結し、親 main 受入後の再確定を後続手順へ残す。

| 対象 | 加算・削除の行数 | 区分 |
|---|---:|---|
| 六 artifact | 136 | 作成済み実数 |
| 主仕様同期 | 21 | delta から ADDED 見出しを除く実数 |
| 両 Skill Step 5 | 16 | 元文面の各八行 |
| 両 format | 52 | 元保持例の各二十六行 |
| root 試験 | 14 | 元三ケース全文と describe/const |
| kit 試験 | 21 | import と元保持例の全文 |
| guide | 1–2 | 適用・保持の案内予算 |
| 日誌・changeset | 19 | checkpoint 七行＋子の四項目七行＋kit patch 五行 |
| archive | 0 | 内容不変の R100 rename 時 |
| 合計 | 280–281 | 将来の実 diff で再確認 |

## Migration Plan

strict・spec-only・通常 local done を確認し、同期/archive と記録は同じ作業 PR に含める。実数が約三百行から大きく増えれば自然な境界を管理役へ示し、圧縮・仕様や試験の削減はしない。最終受入順は Issue→A→X→Y→Apply→Report、許可済み local 先行を維持する。
