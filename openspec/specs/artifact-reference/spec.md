# artifact-reference Specification

## Purpose

取得済みの本体と保存参照の同一性を検査し、実際の保持期間が方針を満たしたかという過去の情報と、現在取得を再確認できる状態かを混同せず利用側へ返す。

## Requirements

### Requirement: 本体の照合と保存期限の判定
kitは取得済み本体のraw SHA-256とbytesを参照に照合する純粋関数と、実createdAt/expiresAtの保持期間と明示したnowによる現在状態を分ける純粋関数を公開する SHALL。I/O・環境・時計を読まず、方針から事実の保存期限を作らない MUST。期間はd/wを日数、yをUTC暦年とし、閏日の加算は移動先月末へ丸める SHALL。参照不正・不足・未確認を合格にせず、期限切れで当時の判定を変えない MUST。

Source: REQ-463

#### Scenario: 本文を参照へ照合する
- **WHEN** checkArtifactBody(ref, bytes:Uint8Array)へ取得済みraw本体と、そのraw SHA-256・bytesを持つ参照を渡す
- **THEN** 両方が一致したときだけ一致を返し、本文1文字・bytes1バイト・ハッシュ・参照型が違えば不一致を日本語の理由付きで返し、入力を変更しない
- **AND** BufferもUint8Arrayとして受け、viewのoffsetとlengthの範囲だけを照合し、型が違えば不一致を返す。textへ再encodeして元bytesと呼ばない

#### Scenario: 実保持期間が方針を満たす
- **WHEN** artifactRetentionへ実createdAtとexpiresAt、方針期間、明示したnowを渡す
- **THEN** 当時の保持期間が方針以上ならsatisfied、短ければinsufficient、実期限等が不明・不正ならunverifiedを返す
- **AND** desiredな90dと実際の7dを混同せず、設定を書き換えない

#### Scenario: 現在の期限切れ
- **WHEN** nowが実expiresAtと等しいか後である
- **THEN** 現在状態はexpiredとし、前ならavailable、期限やnowが不明・不正ならunverifiedとする
- **AND** 過去のsatisfied・insufficientは現在の失効で変えず、availableだけで取得権限や本体の実在・真正性を証明しない

#### Scenario: 暦年と日週の境界
- **WHEN** 閏日のcreatedAtへyの期間を加算するか、dまたはwの期間を比較する
- **THEN** UTCの移動先月末へ丸め、日週は24時間と7日を使い、境界ちょうどで当時の充足と現在の失効をそれぞれ評価する

#### Scenario: Unicode表現とbyte view
- **WHEN** BOM・U+FFFD・不正な継続byte・途中のマルチbyte、またはoffset/lengthの違うUint8Array viewを照合する
- **THEN** 元raw bytesの範囲とSHA-256で同一性を判定し、strict decodeと件数の解釈は本体照合の一致と別に扱い、入力bytesを変更しない
