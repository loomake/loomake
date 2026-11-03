## ADDED Requirements

### Requirement: 品質 YAML の反映案を作る
Skill は、受け入れ条件と計測方法を定義できた要件について、objectives の UQ または product の PQ の具体案を作り、linked_requirements に要件 ID を入れるよう定める SHALL。特性・副特性・metric・source・target・min_samples・model は入力・人の回答・既存 YAML に根拠のある値を使い、不足値は関連 REQ つき Q にする。合格に必要な target が未定なら blocking とし、参考計測は indicators への案にできるが既存の必須 evidence を移して条件を弱めない。context は利用状況の実際の定義への参照とする。作った案は既存の分割案と一緒に人に示し、同じ合意の中で確かめる。

Source: REQ-408

#### Scenario: 値の出どころと不足を示す
- **WHEN** 品質 YAML の案を作る手順を読む
- **THEN** 入力・回答・既存 YAML の値を使い、不足値は推測せず関連 REQ つき Q にし、別案件のモデル選定に init 雛形の回答を流用しない指示と、作った案を既存の分割案と一緒に示して同じ合意で確かめる指示がある

#### Scenario: target のない計測を合格証拠にしない
- **WHEN** 合格に必要な target が未定、または参考計測に target がない
- **THEN** 前者は blocking Q に残し、後者は indicators の案にできるが、既存 evidence の移動や参考値だけで合格条件を弱めない指示がある

#### Scenario: context は実際の定義を参照する
- **WHEN** 利用状況を品質 YAML の案に結び付ける
- **THEN** 定義のある入力文書・Issue 等の出典を参照し、単なる短文や要件 ID だけで足りるとせず、不足は関連 Q にする。既存 trace のパスを機械的に足して定義参照の代用にしない。新しい Context 表・未知の root key は追加しない

#### Scenario: 例が既存のスキーマに合う
- **WHEN** 書式の参照ファイルの品質 YAML 例を、既存の完了ゲートの読取処理で読む
- **THEN** loaded となり、linked_requirements に関連 REQ があり、必須 evidence の各項目に target がある

#### Scenario: 観測がなければ合格しない
- **WHEN** 同じ品質 YAML 例を観測零件で既存の品質判定に渡す
- **THEN** 対象の判定があり、PASS は一件もない

