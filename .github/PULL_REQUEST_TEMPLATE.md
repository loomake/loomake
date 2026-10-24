<!-- 対象の change-id を書く。コードを変えるのに change がないときは none と書く（CI の gate ジョブが読む） -->
loomake-change: <change-id>

## 変える問題と結果

## 実行したゲートとテスト

- [ ] `pnpm -s verify --change <change-id> --done` が exit 0
- [ ] `pnpm lint`・`pnpm typecheck`・`pnpm test`

## 未確認の環境と、残る確認事項
