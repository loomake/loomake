# TDD実行記録

## 1.1 依存の向き

kit の実行の基盤が runtime/ にあり、node:・@loomake/core・runtime/ だけを import すること、verify・init・doctor が自分のディレクトリ・runtime/・verify/config.ts だけを import することを確かめるテストを 4 件足し、runtime/ がないので 4 件とも失敗することを確かめた。process・input・errors・change-files を runtime/ に移し、import のパスと監視役のスクリプトの場所を直して、4 件が成功した。テストの中の kit の src のパス（process.test.ts・doctor-diagnostics.test.ts・external-budget.test.ts・publication-crash.test.ts）も新しい場所に合わせた。ビルドした配布物から監視役が起動することも確かめた。

## 2.1 文書

architecture.md に kit と runner の中の分け方を書き、依存の図の kit の説明を直した。changeset を足した。

## 完了ゲート

`pnpm -s verify --change layer-kit-modules --done` は exit 0。lint・型検査・842 件のテストと全 REQ の対応が成功した。
