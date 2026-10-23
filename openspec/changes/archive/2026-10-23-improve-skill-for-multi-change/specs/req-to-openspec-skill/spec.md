## MODIFIED Requirements

### Requirement: 台帳づくりの手順
Skill は要件書の要求文を 1 文ずつ REQ-001 から採番し、出典（文書名・章と行）つきで要件台帳に載せる手順を定める SHALL。REQ・Q・A の番号は要件書 1 冊の中で通し番号にし、change をまたいでも同じ番号を使うよう定める SHALL。

Source: REQ-026

#### Scenario: 採番と出典の指示がある
- **WHEN** kit の Skill テンプレート（SKILL.md）を読む
- **THEN** `REQ-001` からの採番、1 文ずつ載せること、出典に文書名・章と行を書くことが指示されている

#### Scenario: 通し番号の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** REQ・Q・A を要件書 1 冊の中で通し番号にし、change をまたいでも同じ番号を使うことが指示されている

### Requirement: 曖昧さチェックリストの適用
Skill は曖昧さチェックリストを全要件にあて、確認事項（Q）または仮定（A）として記録する手順を定め、チェックリスト自体を同梱する SHALL。要件書に未決事項の章や表があるときは、その項目をすべて確認事項にし、質問に要件書側の ID を書くよう定める SHALL。関係する要件がすべて後のフェーズの未決事項は、ブロッキングにしないよう定める SHALL。

Source: REQ-027

#### Scenario: チェックリストが同梱されている
- **WHEN** Skill テンプレートのディレクトリを読む
- **THEN** 曖昧さチェックリストのファイルがあり、SKILL.md が全要件に適用して Q または A に記録するよう指示している

#### Scenario: 未決事項の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 要件書の未決事項をすべて確認事項にすること、質問に要件書側の ID を書くこと、関係する要件がすべて後のフェーズならブロッキングにしないことが指示されている

### Requirement: change への分割と分割案の提示
Skill は要件書をリリース・検収単位の change に分割し、分割案を人に示してから書き出すよう定める SHALL。複数の change にかかわる要件と確認事項は、かかわる change それぞれの trace.md に、同じ番号・同じ内容の行で載せるよう定める SHALL。

Source: REQ-029

#### Scenario: 分割の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 1 change をリリース・検収の単位とすること、分割案を人に示して合意を取ることが指示されている

#### Scenario: 複数の change にかかわる行の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 複数の change にかかわる要件と確認事項を、かかわる change それぞれの trace.md に同じ番号・同じ内容で載せることが指示されている

### Requirement: 範囲外の扱い
Skill は範囲外の要件を Requirement にせず、proposal.md の Non-goals に書くよう定める SHALL。後のフェーズで作る要件は、種別と状態を「範囲外」にして要約の末尾に「（フェーズ：〇〇）」と書き、Non-goals ではそれ以外の範囲外の要件と分けて書くよう定める SHALL。

Source: REQ-031

#### Scenario: Non-goals への指示
- **WHEN** Skill テンプレートを読む
- **THEN** 範囲外の要件は Requirement にせず proposal.md の Non-goals に書くと指示されている

#### Scenario: 後のフェーズの要件の指示
- **WHEN** Skill テンプレートを読む
- **THEN** 後のフェーズの要件を「範囲外」にし、要約の末尾に「（フェーズ：〇〇）」と書き、Non-goals で分けて書くことが指示されている
