## ADDED Requirements

### Requirement: 読める要件書の形式
Skill は、.docx・.xlsx・.pdf・.md の要件書について、形式ごとにテキストの取り出し方を定める SHALL。取り出しに使うツールは devcontainer に入っているもの（pandoc・pdftotext・xlsx2csv）とする MUST。

Source: REQ-025

#### Scenario: 4 つの形式の取り出し方がある
- **WHEN** Skill テンプレート（SKILL.md）を読む
- **THEN** .docx・.xlsx・.pdf・.md のそれぞれに取り出し方が書かれ、.docx に pandoc、.pdf に pdftotext、.xlsx に xlsx2csv が指定されている

#### Scenario: 出典に必要な構造を残す
- **WHEN** Skill テンプレートの .xlsx の取り出し方を読む
- **THEN** シート名と行番号を出典として控えるよう指示されている

### Requirement: 台帳づくりの手順
Skill は要件書の要求文を 1 文ずつ REQ-001 から採番し、出典（文書名・章またはシートと行）つきで要件台帳に載せる手順を定める SHALL。

Source: REQ-026

#### Scenario: 採番と出典の指示がある
- **WHEN** kit の Skill テンプレート（SKILL.md）を読む
- **THEN** `REQ-001` からの採番、1 文ずつ載せること、出典に文書名・章またはシートと行を書くことが指示されている

### Requirement: 曖昧さチェックリストの適用
Skill は曖昧さチェックリストを全要件にあて、確認事項（Q）または仮定（A）として記録する手順を定め、チェックリスト自体を同梱する SHALL。

Source: REQ-027

#### Scenario: チェックリストが同梱されている
- **WHEN** Skill テンプレートのディレクトリを読む
- **THEN** 曖昧さチェックリストのファイルがあり、SKILL.md が全要件に適用して Q または A に記録するよう指示している

### Requirement: 必ずブロッキングにする分類
Skill はお金・個人情報・権限・データ削除・外部連携・検収数値に関わる曖昧さを、必ずブロッキングな確認事項にするよう定める SHALL。

Source: REQ-028

#### Scenario: 6 つの分類が列挙されている
- **WHEN** Skill テンプレートを読む
- **THEN** お金・個人情報・権限・データ削除・外部連携・検収数値の 6 つが、仮定にしてはいけないものとして列挙されている

### Requirement: change への分割と分割案の提示
Skill は要件書をリリース・検収単位の change に分割し、分割案を人に示してから書き出すよう定める SHALL。

Source: REQ-029

#### Scenario: 分割の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 1 change をリリース・検収の単位とすること、分割案を人に示して合意を取ることが指示されている

### Requirement: Requirement の書式
Skill は、各 Requirement に SHALL または MUST の規範文、`Source:` 行、1 つ以上の Scenario を含めるよう定める SHALL。

Source: REQ-030

#### Scenario: 書式の指示と雛形がある
- **WHEN** Skill テンプレートの書式の参照ファイルを読む
- **THEN** 規範文・`Source:` 行・`#### Scenario:` を含む雛形があり、SKILL.md が 3 つを必須とする

### Requirement: 範囲外の扱い
Skill は範囲外の要件を Requirement にせず、proposal.md の Non-goals に書くよう定める SHALL。

Source: REQ-031

#### Scenario: Non-goals への指示
- **WHEN** Skill テンプレートを読む
- **THEN** 範囲外の要件は Requirement にせず proposal.md の Non-goals に書くと指示されている

### Requirement: 作業完了時の報告
Skill は、作業の最後に、change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定を報告するよう定める SHALL。

Source: REQ-032

#### Scenario: 報告の 4 項目
- **WHEN** Skill テンプレートの報告の節を読む
- **THEN** change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定の 4 項目が含まれる

### Requirement: 顧客に送れる確認事項の文面
Skill はブロッキング確認事項を顧客にそのまま送れる文面で出力するよう定める SHALL。

Source: REQ-033

#### Scenario: 文面の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** ブロッキング確認事項を顧客にそのまま送れる文面で出すことが指示されている

### Requirement: テキスト抽出をコードに持たない
テキスト抽出（pandoc・pdftotext など）は、Skill の中で AI が行う作業として指示し、`@loomake/kit` のコードには組み込まない SHALL。

Source: REQ-059

#### Scenario: kit のコードに抽出処理が無い
- **WHEN** `packages/kit/src/` を走査する
- **THEN** `pandoc`・`pdftotext` を呼び出すコードが含まれない

### Requirement: Skill の日本語提供
Skill は日本語で提供される SHALL。

Source: REQ-055

#### Scenario: 日本語で書かれている
- **WHEN** Skill テンプレートの SKILL.md を読む
- **THEN** 見出しと指示文が日本語である
