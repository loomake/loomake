# TDD実行記録

## 1.1 依存の向き

kit の実行の基盤が runtime/ にあり、node:・@loomake/core・runtime/ だけを import すること、verify・init・doctor が自分のディレクトリ・runtime/・verify/config.ts だけを import することを確かめるテストを 4 件足し、runtime/ がないので 4 件とも失敗することを確かめた。process・input・errors・change-files を runtime/ に移し、import のパスと監視役のスクリプトの場所を直して、4 件が成功した。テストの中の kit の src のパス（process.test.ts・doctor-diagnostics.test.ts・external-budget.test.ts・publication-crash.test.ts）も新しい場所に合わせた。ビルドした配布物から監視役が起動することも確かめた。

## 2.1 文書

architecture.md に kit と runner の中の分け方を書き、依存の図の kit の説明を直した。changeset を足した。

## 完了ゲート

`pnpm -s verify --change layer-kit-modules --done` は exit 0。lint・型検査・842 件のテストと全 REQ の対応が成功した。

## レビューの指摘への対応

PR #56 のレビューで、import の検査が単一引用符の `from '...'` の形しか拾わず、二重引用符や副作用の import で runtime/ から verify/ への依存を足しても通ることが指摘された。検査を TypeScript の構文解析（`ts.preProcessFile`）で import を取り出す形に直し、二重引用符・副作用の import・export from・動的な import・型だけの import と、機能どうしの import を見つける回帰テストを 6 件足した。runtime/errors.ts に `import "../verify/run.js";` を足すと検査が失敗し、戻すと 10 件すべてが成功することを確かめた。
