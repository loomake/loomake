# verification-policy Specification

## Purpose
要件と合意の内容をMarkdownやJSONの書式から分離し、要件IDと状態、ブロッキング質問、検証に必要なテストの対応を、ファイルや外部ツールを使わずに判定する契約を定める。

## Requirements

### Requirement: 要件と合意のモデルへの変換
coreは解析したtraceから、要件ID・出典・状態、質問のブロッキング判定と回答、仮定の承認を持つモデルを作るAPIを公開する SHALL。要件IDはREQと3桁以上の数字、状態は既存の4値を検証し、不正な場合はファイルと行を含むエラーを返す SHALL。入力を変更しない MUST。

Source: REQ-147

#### Scenario: 不正なIDや状態
- **WHEN** 要件IDか状態が不正なtraceを渡す
- **THEN** その行をエラーとして返す

### Requirement: 合意に基づく検証判定
kitはcoreの合意モデルから未回答のブロッキング質問、確認待ちの要件、未承認の仮定、出典のない要件のIDを返す純粋関数 `evaluateAgreement` と結果型 `AgreementDecision` を公開する SHALL。ファイル・環境・時計を読まず、入力を変更しない MUST。coreはこの判定関数と結果型を公開しない SHALL。モデル変換と入力モデルはcoreに残す SHALL。

Source: REQ-148

#### Scenario: 回答済みと非ブロッキング
- **WHEN** 回答済みのブロッキング質問と、未回答の非ブロッキング質問を渡す
- **THEN** 未回答のブロッキング質問には含めない

#### Scenario: 公開元の移管
- **WHEN** core と kit の公開 API を読む
- **THEN** 合意の判定関数と結果型は kit から利用でき、core からは公開されない

### Requirement: 成功したテストと要件の対応判定
kitは必要な要件IDと成功したテストのファイル別IDから、要件ごとのファイルとテストのない要件を返す純粋関数 `evaluateTestCoverage` と結果型 `TestCoverageDecision` を公開する SHALL。必要なIDとファイルは重複を除いて昇順にし、対応のない要件にも空の配列を返す SHALL。入力を変更しない MUST。coreはこの判定関数と結果型を公開しない SHALL。

Source: REQ-149

#### Scenario: 重複と不足
- **WHEN** 必要なIDとファイルの対応に重複と不足がある
- **THEN** 重複を除き、不足のあるIDを示す

#### Scenario: 公開元の移管
- **WHEN** core と kit の公開 API を読む
- **THEN** テスト対応の判定関数と結果型は kit から利用でき、core からは公開されない
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
