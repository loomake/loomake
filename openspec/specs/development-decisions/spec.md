# development-decisions Specification

## Purpose
TBD - created by archiving change record-stack-and-versioning-decisions. Update Purpose after archive.

## Requirements

### Requirement: 版管理と互換性の方針の記載
CONTRIBUTING.md はパッケージの版管理の方式と、`0.x` の間の互換性の方針を書く SHALL。それぞれについて、決めた理由を残した ADR へのリンクを持つ MUST。

Source: REQ-227, REQ-228

#### Scenario: CONTRIBUTING.md に方針とリンクがある
- **WHEN** CONTRIBUTING.md を読む
- **THEN** 版管理の方式と `0.x` の互換性の方針が書かれ、それぞれに ADR へのリンクがある

#### Scenario: リンク先の ADR がある
- **WHEN** CONTRIBUTING.md から ADR へのリンクをたどる
- **THEN** リンク先のファイルがリポジトリにある

### Requirement: 設計判断の ADR
版管理の方式と `0.x` の互換性の方針、`@loomake/core` の実行時依存、開発の技術スタックの決定は、それぞれ ADR に残す SHALL。各 ADR は決定、検討した選択肢、理由、適用範囲、見直す条件を書く MUST。

Source: REQ-234

#### Scenario: 4 つの決定に ADR がある
- **WHEN** ADR の置き場を読む
- **THEN** 版管理の方式、`0.x` の互換性の方針、core の実行時依存、技術スタックのそれぞれについて ADR がある

#### Scenario: ADR に必要な項目がある
- **WHEN** それぞれの ADR を読む
- **THEN** 決定、検討した選択肢、理由、適用範囲、見直す条件の見出しがある

### Requirement: 開発効率の手書きの記録様式
リポジトリは開発効率を手書きで記録する様式を持つ SHALL。様式は比較の種類（推定との比較か、人力実測との比較か）、比較方式（AI なしの人力か、人が AI を操作する方式か）、作業範囲、事前の人力工数の推定（最小・最大・根拠）、指示・レビュー・手直し・実行・待機の時間の欄を持つ MUST。

Source: REQ-229

#### Scenario: 様式に必要な欄がある
- **WHEN** 開発効率の記録様式を読む
- **THEN** 比較の種類、比較方式、作業範囲、推定の最小・最大・根拠、指示・レビュー・手直し・実行・待機の時間の欄がある

### Requirement: C-001 の事前見積もり
C-001 の事前の人力工数の推定は、C-001 の実装を始める前に、記録様式に従って記録する SHALL。記録した推定は実装を始めたあとに書き換えない MUST。

Source: REQ-230

#### Scenario: 着手前に記録されている
- **WHEN** C-001 の推定を記録したコミットと、C-001 の最初の実装のコミットを比べる
- **THEN** 推定を記録したコミットが先にある

#### Scenario: 着手後に推定を書き換えない
- **WHEN** C-001 の最初の実装のコミットより後の履歴で、推定の記録を調べる
- **THEN** 推定の最小・最大・根拠の欄は変わっていない
