## ADDED Requirements

### Requirement: 未知キーをプロトタイプを変えずに保持する

core の verify 結果、Markdown 解析結果、quality.yaml、quality-report、証拠とリリースレポートの公開スキーマは、未知の own property `__proto__`・`constructor`・`prototype` を通常の未知キーと同じく値を変えず解析結果に保持する SHALL。最上位とスキーマが検証する入れ子・配列要素に同じ規則を適用する MUST。入力と共有プロトタイプを変更せず、`__proto__` を出力のプロトタイプ変更として解釈しない MUST。既知項目の検証・既定値、既存の導出型・遅延ロードと8種類の配布 JSON Schema の内容を維持する MUST。

Source: REQ-307

#### Scenario: 最上位の未知キーを保持する
- **WHEN** 必須項目に加え、JSON の own property として `__proto__`・`constructor`・`prototype` を持つ値を公開スキーマで解析する
- **THEN** parse と safeParse は成功し、各キーが同じ値の own property として解析結果に残る

#### Scenario: 検証する入れ子と配列要素のキーを保持する
- **WHEN** verify の results、Markdown の各解析行、quality.yaml の検証対象の入れ子、証拠内の verify・results・documents、レポート内の evidence・attention・rows・questions・assumptions に未知の `__proto__` を持つ値を解析する
- **THEN** 各階層の同じキーと値が解析結果に残り、未知キーの値の入れ子も変わらない

#### Scenario: 入力とプロトタイプを変更しない
- **WHEN** `__proto__` の値にオブジェクト・配列・null・プリミティブを指定して解析する
- **THEN** 入力は変わらず、解析結果はそのキーを own property として持ち、共有プロトタイプと解析結果の通常のプロトタイプは変更されない

#### Scenario: 既知項目の検証と既定値を保つ
- **WHEN** 未知キーを含む正常入力、必須項目の欠落、不正な版、省略可能な既定値を持つ入力を解析する
- **THEN** 従来と同じ受理・拒否と既定値が得られ、非同期の解析でも未知キーが保持される

#### Scenario: 配布スキーマと遅延ロードを保つ
- **WHEN** 対象スキーマから JSON Schema を生成し、公開 loader と core・CLI の入口を検査する
- **THEN** 配布 JSON の内容と公開する導出型が維持され、core・CLI の静的な入口から zod が読み込まれない
