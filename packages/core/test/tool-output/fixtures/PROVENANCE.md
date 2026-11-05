# Fixture の出典

このディレクトリの入力はすべて固定版の一次資料を基にした合成データである。実ツールの出力を収集した記録ではなく、将来の版との互換性は保証しない。

## gh.json

gh v2.103.0 の [aggregate.go](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/aggregate.go#L12-L22) と [bucket の写し方](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/aggregate.go#L72-L88) を参照した。空の workflow・link はそのまま残す。

実 CLI の check 0 件は [checks.go:302–304](https://github.com/cli/cli/blob/v2.103.0/pkg/cmd/pr/checks/checks.go#L302-L304) で exporter より前に失敗し、stdout が空になる。parser の `[]` 受理とは区別する。
