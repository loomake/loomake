## MODIFIED Requirements

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
