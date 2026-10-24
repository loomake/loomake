## ADDED Requirements

### Requirement: 証拠の実行時検証
証拠を読むときは必須値・対応するschemaVersion・有効な日時・対象changeと検証結果の対応を検証する SHALL。documentsがある場合はパスの重複と内容のSHA-256の不一致を拒否する SHALL。不正な証拠はファイル名と理由を日本語で示し、UsageErrorとして返す SHALL。documentsのない既存の証拠も読む SHALL。

Source: REQ-142

#### Scenario: 構文が正しい不正データ
- **WHEN** 証拠がnull・空のオブジェクト・不正な検証結果・不正な日時のどれかである
- **THEN** TypeErrorを出さず、ファイル名と理由を示して終了コード2で返す

#### Scenario: 対象が違う
- **WHEN** 証拠か検証結果のchangeが指定したchangeと違う
- **THEN** 証拠を採用せずエラーとして返す

#### Scenario: 内容の不一致
- **WHEN** 保存した文書のcontentとsha256が一致しない
- **THEN** レポートを作らずエラーとして返す

#### Scenario: 古い証拠
- **WHEN** documentsのない既存の正しい証拠を読む
- **THEN** 従来どおり仕様との対応は未確認と表示する

