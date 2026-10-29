# Design

## Context

J04 とアーキテクチャ 0.2・3 が移管先を確定している。既存の関数は通常の純粋関数で、kit の verify が core から利用する。domain-mutations は core の関数とテストの配置を前提としている。

## Goals / Non-Goals

公開元を移し、判定の結果と既存の検出力を保つ。C-001 の新しい集約と JSON 契約はここで実装しない。

## Decisions

判定は `packages/kit/src/verify/policy/` に置く。verify の既存の層制限の中で利用でき、設定や実行の基盤に判定を混ぜずに済む。kit の公開入口から関数と結果型を出し、core には Agreement・RequirementId と createAgreement を残す。core に再エクスポートを残す案は、J04 の公開 API 削除と互換期間なしの決定に合わないため採らない。

既存の REQ-148 の2テストと REQ-149 の3テストは期待値を保って移す。REQ-147 のモデル変換テストは core に残す。公開元の検査を追加し、型のコンパイルと配布物の検査でも境界を確かめる。

mutation の複製環境は移管後の core と kit の配置へ追従する。既存の13条件、テストエラーと検出の分類、対象ファイルの保護を変えない。過去の試験証跡を新しい成功証跡として書き換えない。

## Risks / Trade-offs

公開 API の削除で利用側の import が壊れるため、リポジトリ全体を検索して追従し、core・kit の minor changeset と移行説明を付ける。品質スキーマ担当とは core の公開入口の異なる行で競合する可能性があるため、統合時に両方の公開 API を照合する。
