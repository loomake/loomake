# Changesets

パッケージ（`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner`・`loomake`）を変更したら、`pnpm changeset` で変更内容と版の上げ方を記録する。版はパッケージごとに独立して上がる。

公開は `.github/workflows/release.yml` を GitHub 上から手動で実行する。ワークフローは lint・typecheck・test が通ってから公開する。初回の公開と、2 回目以降の認証の手順は [docs/release.md](../docs/release.md) の 4 にある。
