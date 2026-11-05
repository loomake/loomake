## ADDED Requirements

### Requirement: 証拠候補のファイル名
trace report はファイル名が `^\d{8}T\d{6}Z-[0-9a-f]+\.json$` に完全一致する通常ファイルだけを証拠候補にする SHALL。その他の名前は本文を読まず、警告を追加せず無視する SHALL。候補がなければ証拠なしとして扱い、候補があれば既存の日時選択・同秒比較・予算・検証を保つ MUST。最新候補が不正なら別の名前のファイルや古い候補へ戻らず、対象を示す既存の UsageError にする MUST。

Source: REQ-423

#### Scenario: メモが混在する
- **WHEN** 正規名の証拠と壊れた notes.json がある
- **THEN** notes.json を読まず正規名の最新証拠を使う

#### Scenario: 正規候補がない
- **WHEN** 非正規名の JSON だけがある
- **THEN** 証拠なしとなる

#### Scenario: 最新候補が壊れている
- **WHEN** 最新の正規候補が壊れ、メモや古い証拠もある
- **THEN** 最新候補を示す使い方エラーとなる
