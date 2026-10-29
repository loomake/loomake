# add-quality-verdict-aggregation

## Why

要件定義 7.3 は品質の判定を4値で扱い、CI の verdict を優先順位に従って集約すると定める。WBS C-001 の「条件と集約の先行実装」のうち、[Issue #63](https://github.com/loomake/loomake/issues/63) の集約だけを独立して実装する。

## What Changes

- core に4値の共有 Zod enum・導出型 `QualityResult`・遅延 loader を追加する。
- kit に評価済みの4値配列から CI verdict だけを返す純関数 `aggregateCiVerdict` を追加する。
- 版・適格性・条件の判定は集約前の責務とし、この関数だけで完了ゲート全体を判定しないことを明記する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: 共有する4値のスキーマと導出型を追加する。
- `verification-policy`: 評価済み結果を集約する契約を追加する。

## Non-goals

summary・evaluated の意味と件数集計、版・証跡適格性・条件の評価、NOT_APPLICABLE の理由と確認者の検証、I/O・時計、既存 verify JSON の版切替と出力・CLI への接続、quality.yaml の読み取り、source と metric の接続は対象外とする。後続の C-001・C-003 などで扱う。共有 enum 単独の JSON ファイルは作らず、既存8本の JSON を変えない。Issue #63 全体は完了扱いにしない。

## Impact

core の共有スキーマ・型・公開入口、kit の判定関数・公開入口、ID 付き試験、配布物確認、changeset を追加する。既存の同期 API・VerifyResult 1.0.0・外部 JSON 形式を変えない。
