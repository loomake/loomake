# harden-init-and-trace-check

## Why
2026-10-23 の全体レビュー（docs/review.md）で、次の 2 件を再現した。どちらも既存の要件（REQ-020・REQ-034）が守ろうとしているものを破る。

- `loomake init` がシンボリックリンクをたどり、承諾なしにプロジェクトの外へファイルを作る。外のファイルの中身を差分に出す
- trace.md の節名が崩れていると、core が解析エラーを返しても verify はそれを捨て、未回答のブロッキング確認事項を見落として合格する

## What Changes
- `init` は、置き先がプロジェクトの外を指すとき、または置き先がリンク先の無いシンボリックリンクのとき、何も読み書きせずに中止し、終了コード 1 を返す
- 仕様ゲートは trace.md と差分仕様（spec.md）の解析エラーを不合格にする

## Non-goals
- プロジェクトの中を指すシンボリックリンクの扱いは変えない（このリポジトリの `.claude/skills/` のような構成を壊さない）
- 文書の CI 例の修正（docs/usage.md）は文書だけの修正なので、この change に含めない

## Impact
- 影響する capability：init、verify（どちらも Requirement の変更）
- 影響するコード：`packages/kit/src/init/init.ts`、`packages/kit/src/verify/run.ts`
