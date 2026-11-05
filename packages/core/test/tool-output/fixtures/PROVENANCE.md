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
