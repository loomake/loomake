# Proposal: align-template-worklog

## Why

`loomake init` が配る AGENTS.md のテンプレート（`packages/kit/templates/AGENTS.md`）は、6 章で、作業記録を日付ごとのファイル `docs/worklog/<作業した日>.md` に書くよう定めている。複数のエージェントが同じ日に作業すると、同じファイルに追記した PR どうしが競合する。

このリポジトリの AGENTS.md 6 章は、PR #39（worklog-per-branch）で、ブランチごとのファイルに書く決まりに変わった。[Issue #41](https://github.com/loomake/loomake/issues/41) で、配るテンプレートも合わせるかを検討した。リポジトリの持ち主は 2026-10-28 に、テンプレートも合わせると決めた。

## What Changes

- テンプレートの 6 章の作業記録の決まりを、このリポジトリの AGENTS.md 6 章に合わせる。
  - 記録は、作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に書く
  - ブランチ名の `/` は `-` に置き換える
  - 同じ日・同じブランチのファイルがあれば、末尾に追記する
  - 作業記録はその作業の PR に含め、作業記録だけの PR は作らない
  - PR のマージ後に記録を足すときは、次の作業のブランチのファイルに書き、その PR に含める
- このリポジトリの AGENTS.md にある「2026-10-27 までの日付ごとのファイルは、移さずにそのまま残す」という文は、テンプレートに入れない。このリポジトリが移行するための文であり、init で始める利用者のリポジトリには日付ごとの古いファイルがないため。
- `tests/kit-assets.test.ts` に、テンプレートの報告の形の節に上の決まりが書いてあることを確かめる試験を足す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `agents-rules`: AGENTS.md のテンプレートの作業記録の決まりの要件（REQ-273）を足す。既存の要件（REQ-043〜045・REQ-055）は変えない。

## Impact

`packages/kit/templates/AGENTS.md`（配布物）と `tests/kit-assets.test.ts` を変える。`docs/quality/scenarios.json` には、この change の Scenario のレビューを足す。`tests/kit-assets.test.ts` を根拠にする既存のレビューは、試験を読み直してハッシュを更新する。`@loomake/kit` の配布物が変わるので、`@loomake/kit` と `loomake` の patch の changeset を足す。コード、公開 API、設定、依存は変えない。

init でテンプレートをすでに置いた利用者の AGENTS.md は、init をもう一度実行して置き換えを承諾しない限り変わらない（既存ファイルの保護の要件のとおり）。

archive する PR では、この change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/agents-rules/spec.md` 側の ID に移す。
