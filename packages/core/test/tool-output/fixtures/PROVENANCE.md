# Fixture の出典

このディレクトリの入力はすべて固定版の一次資料を基にした合成データである。実ツールの出力を収集した記録ではなく、将来の版との互換性は保証しない。

## gh.json

gh v2.103.0 の [aggregate.go](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/aggregate.go#L12-L22) と [bucket の写し方](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/aggregate.go#L72-L88) を参照した。空の workflow・link はそのまま残す。

実 CLI の check 0 件は [checks.go:302–304](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/checks.go#L302-L304) で exporter より前に失敗し、stdout が空になる。parser の `[]` 受理とは区別する。

## claude.json

Claude Code 2.1.308 で観測したのは stream-json の result メッセージの欄の型だけであり、`--output-format json` の実 fixture は未観測である。この fixture はその型と、版を固定していない [公式の JSON 出力の説明](https://code.claude.com/docs/en/headless) を基に合成した。版・内容・全体形式の実観測を主張しない。

参照した欄は type・subtype・is_error・result・session_id・num_turns。errors の任意配列と未知 subtype の分類は、最終補足設計 §3.4 で定めた受理契約である。

## codex.jsonl

Codex rust-v0.166.0 の [exec_events.rs](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/exec/src/exec_events.rs#L8-L141) の event と payload の型を基に合成した。usage の欄は object であることだけを検査し、値は返さない。最後の turn の text と errors だけを残す契約は最終補足設計 §3.5 に従う。

## biome.json

Biome 2.6.5 の [json.rs](https://github.com/biomejs/biome/blob/%40biomejs%2Fbiome%402.6.5/crates/biome_cli/src/reporter/json.rs#L15-L228) と [summary](https://github.com/biomejs/biome/blob/%40biomejs%2Fbiome%402.6.5/crates/biome_cli/src/reporter/mod.rs#L36-L131) を基に合成した。duration は debug build で省略されるため必須にしない。位置の 0/0 はファイル単位の診断で、通常の位置は 1 始まりである（json.rs:306–307、345–351）。

診断は severity と verbose で絞られる（json.rs:280–290）。JSON reporter への max-diagnostics 適用と、GitHub Actions 上の ci mode の stdout が JSON だけになるかは未確認である。summary.diagnosticsNotPrinted は値をそのまま残し、全件取得を保証しない。

## playwright.json

Playwright v1.64.1 の [testReporter.d.ts:267–350](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright/types/testReporter.d.ts#L267-L350) と [json.ts:164–247](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright/src/reporters/json.ts#L164-L247) を基に合成した。root suite の title は fullName に含めない。最終補足設計 §3.6 の優先順位に従い、flaky と期待した失敗は passed にしない。

[base.ts:663–677](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright/src/reporters/base.ts#L663-L677) の 3 つの env は collector が子への複製から除く。config の outputFile は変更せず、stdout が空なら unreadable とする。
