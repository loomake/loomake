## ADDED Requirements

### Requirement: 評価済み品質結果のCI集約

kit は評価済みの `readonly QualityResult[]` から CI verdict だけを返す named export `aggregateCiVerdict` を公開する SHALL。FAIL があれば FAIL、次に INSUFFICIENT_EVIDENCE があれば同値、PASS があり残りが PASS/NOT_APPLICABLE なら PASS、空配列と全件 NOT_APPLICABLE は INSUFFICIENT_EVIDENCE を返す MUST。順序と重複で結果を変えず、入力を変更せず、I/O・環境・時計を参照しない MUST。

API の説明には、評価済み入力の集約専用で、NA の理由・確認者と証跡適格性・個別条件は集約前の責務であり、証跡適格性や完了ゲート全体の最終合格を判定しないことを明記する SHALL。件数・summary・既存 verify への接続は行わない。

Source: REQ-306

#### Scenario: FAILが優先する
- **WHEN** PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE を含む評価済み結果を渡す
- **THEN** FAIL を返す

#### Scenario: 証跡不足が優先する
- **WHEN** FAIL がなく INSUFFICIENT_EVIDENCE を含む結果を渡す
- **THEN** INSUFFICIENT_EVIDENCE を返す

#### Scenario: PASSがある
- **WHEN** PASS が1件以上あり、残りが PASS または NOT_APPLICABLE の結果を渡す
- **THEN** PASS を返す

#### Scenario: 対象がない
- **WHEN** 空配列または全件 NOT_APPLICABLE の結果を渡す
- **THEN** INSUFFICIENT_EVIDENCE を返す

#### Scenario: 順序・重複・入力保持
- **WHEN** 同じ種類の結果を順序と重複を変えて、読み取り専用の配列として渡す
- **THEN** 同じ verdict を返し、元の配列を変更しない
