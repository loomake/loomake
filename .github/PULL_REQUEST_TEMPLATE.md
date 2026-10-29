<!-- 対象の change-id を書く。コードを変えるのに change がないときは none と書く（CI の gate ジョブが読む） -->
loomake-change: <change-id>

## 変える問題と結果

## 公開契約と移行

<!-- 書き方は docs/dev/compatibility-changes.md を参照。該当しない項目にはその旨を書く。 -->

- 変更理由・影響する公開契約と利用側：
- パッケージと形式のバージョン・changeset：
- 利用側の移行方法・旧形式を読む範囲と再利用する範囲：
- 維持する旧fixture・追加する新fixture・対応を外す場合の根拠：
- 契約テスト・配布物の検証結果と未確認の範囲：

## 実行したゲートとテスト

- [ ] `pnpm -s verify --change <change-id> --done` が exit 0
- [ ] `pnpm lint`・`pnpm typecheck`・`pnpm test`

## 未確認の環境と、残る確認事項
