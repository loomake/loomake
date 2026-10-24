# TDD実行記録

## 1.1 サブパスを持つ参照

サブパスつきの参照・短い SHA・タグ・記録のないリポジトリと SHA を照合するテストを足し、照合の関数がないので失敗することを確かめた。照合を scripts/action-pins.mjs の関数にして、既存のワークフローの検査もこの関数を使うようにし、release-security の 11 件が成功した。既存の `owner/repo@sha` の検査は同じ条件で残る。

## 1.2 CodeQL のワークフロー

CodeQL のワークフローの起動条件・解析する言語・権限・SHA の固定を求めるテストを足し、ワークフローがないので失敗することを確かめた。codeql.yml と github/codeql-action の v4 のコミットの記録を足して、release-security とワークフローの 16 件が成功した。

## 2.1 版を上げる PR

版の上げ下げだけの変更・scripts も変えた変更・ほかのファイルの変更・version の変わらない変更を見分けるテストを足し、判定の関数がないので失敗することを確かめた。scripts/changeset-check.mjs に判定を足し、REQ-056 のテストは `changeset status` が失敗したときだけこの判定で合否を決めるようにして、monorepo の 27 件が成功した。一時的な worktree で `pnpm changeset version` をかけた状態を HEAD と比べ、49 ファイルの差分が版の上げ下げだけと判定されることも確かめた。

## 3.1 文書

publishing.md に版を上げる PR の扱いとサブパスつきの参照を、security.md に CodeQL の節を足した。利用者が編集中の release.md にも版を上げる PR の扱いを足した（コミットはしていない）。配布するパッケージは変えないので、空の changeset を足した。

## 完了ゲート

`pnpm -s verify --change add-codeql-and-version-pr --done` は exit 0。lint・型検査・723 件のテストと全 REQ の対応が成功した。
