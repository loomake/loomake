# agents-rules Specification

## Purpose
`@loomake/kit` が配布する AGENTS.md のテンプレートに書く内容を定める。仕様の正、作業の流れ、完了の定義、禁止事項、報告の形の各節と、人の承認なしにテストを弱めたり設定を緩めたりしない決まり、プロジェクトごとに書き換える末尾の欄、日本語で書くことを含む。

## Requirements

### Requirement: AGENTS.md の必須の節
AGENTS.md のテンプレートは仕様の正、作業の流れ、完了の定義、禁止事項、報告の形を定める SHALL。

Source: REQ-043

#### Scenario: 5 つの節がある
- **WHEN** AGENTS.md のテンプレートを読む
- **THEN** 仕様の正・作業の流れ・完了の定義・禁止事項・報告の形のそれぞれに対応する見出しがある

### Requirement: テストと設定を緩める変更の禁止
AGENTS.md のテンプレートはテストを弱める・skip する・設定を緩める変更を、人の承認なしに行うことを禁止する SHALL。

Source: REQ-044

#### Scenario: 禁止事項が明記されている
- **WHEN** AGENTS.md のテンプレートの禁止事項を読む
- **THEN** テストを弱める・skip する変更と、`loomake.config.json` や lint・型・テストの設定を緩める変更が、人の承認なしには行えないと書かれている

### Requirement: プロジェクト固有の欄
AGENTS.md のテンプレートは、末尾に、プロジェクトごとに書き換える欄を設ける SHALL。

Source: REQ-045

#### Scenario: 末尾に固有欄がある
- **WHEN** AGENTS.md のテンプレートの最後の節を読む
- **THEN** 技術スタック・パッケージマネージャ・主なディレクトリ・コーディング規約を書く欄がある

### Requirement: AGENTS.md の日本語提供
AGENTS.md は日本語で提供される SHALL。

Source: REQ-055

#### Scenario: 日本語で書かれている
- **WHEN** AGENTS.md のテンプレートを読む
- **THEN** 見出しと本文が日本語である

### Requirement: AGENTS.md の作業記録の決まり
AGENTS.md のテンプレートは、報告の形の節で、報告した内容を作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に記録するよう定める SHALL。ブランチ名の `/` は `-` に置き換え、同じ日・同じブランチのファイルがあれば末尾に追記するよう定める SHALL。作業記録はその作業の PR に含め、作業記録だけの PR は作らないこと、PR のマージ後に記録を足すときは次の作業のブランチのファイルに書いてその PR に含めることを定める SHALL。日付ごとのファイル `docs/worklog/<作業した日>.md` に記録する決まりは書かない MUST NOT。

Source: REQ-288

#### Scenario: ブランチごとのファイルに記録する
- **WHEN** AGENTS.md のテンプレートの報告の形の節を読む
- **THEN** 報告した内容を `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に記録すること、ブランチ名の `/` を `-` に置き換えること、同じ日・同じブランチのファイルがあれば末尾に追記することが書かれている。`docs/worklog/<作業した日>.md` に記録する決まりは書かれていない

#### Scenario: 作業記録だけの PR を作らない
- **WHEN** AGENTS.md のテンプレートの報告の形の節を読む
- **THEN** 作業記録をその作業の PR に含め、作業記録だけの PR は作らないこと、PR のマージ後に記録を足すときは次の作業のブランチのファイルに書いてその PR に含めることが書かれている
