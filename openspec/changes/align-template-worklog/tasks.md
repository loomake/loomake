# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-273）を書き、仕様ゲートを通す

## 2. 実装

- [x] 2.1 `tests/kit-assets.test.ts` に試験を足す。テンプレートの報告の形の節に、ブランチごとのファイルへの記録と、作業記録だけの PR を作らないことが書いてあるかを確かめる。いまのテンプレートで失敗することを確かめる（REQ-273）
- [x] 2.2 `packages/kit/templates/AGENTS.md` の 6 章の作業記録の決まりを、このリポジトリの AGENTS.md 6 章に合わせる。日付ごとの古いファイルを残す文は入れない（REQ-273）
- [ ] 2.3 `@loomake/kit` と `loomake` の patch の changeset を足す
- [ ] 2.4 この change の Scenario のレビューを、change 側の ID で `docs/quality/scenarios.json` に足す。`tests/kit-assets.test.ts` を根拠にする既存のレビューは、試験を読み直してハッシュを更新する。`node scripts/scenario-audit.mjs` で、この change の Scenario が reviewed になることを確かめる（REQ-273）

## 3. 確認

- [ ] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 3.2 `pnpm -s verify --change align-template-worklog --done` を通す <!-- loomake:gate=done -->
