## RENAMED Requirements

- FROM: `### Requirement: 顧客に送れる確認事項の文面`
- TO: `### Requirement: 要件を出した人に送れる確認事項の文面`

## MODIFIED Requirements

### Requirement: 必ずブロッキングにする分類
Skill はお金・個人情報・権限・データ削除・外部連携・受け入れの数値に関わる曖昧さを、必ずブロッキングな確認事項にするよう定める SHALL。

Source: REQ-028

#### Scenario: 6 つの分類が列挙されている
- **WHEN** Skill テンプレートを読む
- **THEN** お金・個人情報・権限・データ削除・外部連携・受け入れの数値の 6 つが、仮定にしてはいけないものとして列挙されている

### Requirement: change への分割と分割案の提示
Skill は要件書をリリースの単位の change に分割し、分割案を人に示してから書き出すよう定める SHALL。複数の change にかかわる要件と確認事項は、かかわる change それぞれの trace.md に、同じ番号・同じ内容の行で載せるよう定める SHALL。

Source: REQ-029

#### Scenario: 分割の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 1 change をリリースの単位とすること、分割案を人に示して合意を取ることが指示されている

#### Scenario: 複数の change にかかわる行の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 複数の change にかかわる要件と確認事項を、かかわる change それぞれの trace.md に同じ番号・同じ内容で載せることが指示されている

### Requirement: 要件を出した人に送れる確認事項の文面
Skill はブロッキング確認事項を、要件を出した人にそのまま送れる文面で出力するよう定める SHALL。

Source: REQ-033

#### Scenario: 文面の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** ブロッキング確認事項を要件を出した人にそのまま送れる文面で出すことが指示されている
