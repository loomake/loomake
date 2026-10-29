# Design: add-quality-verdict-aggregation

## Context

要件定義 7.3 と WBS C-001 の集約規則を、Issue #63 の部分実装として切り出す。既存 verify は 1.0.0 のまま保ち、新しい品質結果の API だけを追加する。

## Decisions

core の `quality-result-schema.ts` に `qualityResultSchema` を定義する。`quality-result.ts` は type-only import で `QualityResult` を導出し、`loadQualityResultSchema()` だけでスキーマを読む。定義元を共有することで kit に独自の4値型を重複させず、既存の入口の遅延ロードを維持する。共有 enum は独立したファイル形式ではないため、JSON Schema の生成対象には加えない。

kit の `verify/policy` に `aggregateCiVerdict(results: readonly QualityResult[]): QualityResult` を追加する。型は core から type-only import する。FAIL、INSUFFICIENT_EVIDENCE、PASS の存在を順に確認し、どれもなければ INSUFFICIENT_EVIDENCE を返す。件数や現在時刻、入力の並び替えは必要ない。

入力は個別評価済みの値である。NOT_APPLICABLE の理由・確認者、版・対象コミット・環境・手順・鮮度などの証跡適格性、個別条件の判定は集約前の責務である。この関数の PASS は集約値だけを示し、これだけで証跡適格性や完了ゲート全体の最終合格を判断しない。型で受け取る配列の構造検証や未知値の解析は、この純関数に重ねず共有スキーマを使う呼び出し側に置く。

## Validation

4値の受理と未知値の拒否、型の導出、優先順位・空配列・全件対象外・順序と重複・入力不変を ID 付きで検証する。配布された core と kit の公開入口から新 API を使えること、既存8本の JSON と VerifyResult 1.0.0、入口の zod 遅延ロードを維持することを確認する。

## Non-goals

summary.evaluated と件数、条件・適格性の判定、既存 verify・CLI・JSON 版・quality.yaml・source/metric への接続は行わない。Issue #63 全体の受入は後続へ残す。
