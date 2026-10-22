## 1. 実装
- [x] 1.1 `pnpm-workspace.yaml`（`packages/*`）とルート `package.json` を整える。scripts に lint・typecheck・test、`engines.node >=20.19.0`、`license: MIT` を入れる（REQ-048, REQ-057, REQ-060）
- [x] 1.2 `packages/core`（`@loomake/core`）・`packages/kit`（`@loomake/kit`）・`packages/cli`（`loomake`）の雛形を作る（REQ-001, REQ-002, REQ-003）
- [x] 1.3 TypeScript・vitest・ESLint を devDependency として導入し、`pnpm lint`・`pnpm typecheck`・`pnpm test` を動かす（REQ-010。A-01 の承認後）
- [x] 1.4 `.devcontainer/devcontainer.json` に読み取り用ツール（pandoc・poppler-utils・xlsx2csv）を追加し、Node 24 のイメージと OpenSpec CLI の導入を確認する（REQ-004, REQ-061）
- [x] 1.5 `.changeset/` を設定する（REQ-056）
- [ ] 1.6 `LICENSE`（MIT）を置く（REQ-057）
- [ ] 1.7 `.github/workflows/ci.yml` を作る。3 OS で品質コマンドを実行し、PR のブランチ名が change-id のときは `verify --done` も実行する（REQ-010, REQ-049, REQ-054）
- [ ] 1.8 `loomake.config.json` の `tests.dirs` に `packages` を追加する（AGENTS.md 4章により人の承認が必要。A-04）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを `tests/` に書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `node scripts/verify.mjs --change setup-monorepo --done` を通す
