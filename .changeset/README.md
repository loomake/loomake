# Changesets

パッケージ（`@loomake/core`・`@loomake/kit`・`loomake`）を変更したら、`pnpm changeset` で変更内容と版の上げ方を記録する。版はパッケージごとに独立して上がる。

公開は `.github/workflows/release.yml` を GitHub 上から手動で実行する（最初の公開は人が行う）。
