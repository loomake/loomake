# 0001 パッケージの版管理に changesets を使う

- 状態：採用
- 決めた日：2026-10-26（ADR として記録した日。changesets はそれより前に仕様 REQ-056 で採用済み）
- 決めた人：既存の仕様（`openspec/specs/monorepo/spec.md` の「changesets による公開準備」、REQ-056）。この ADR は、要件定義 11 章の O15 への答えとして記録する
- 出典：WBS の W0-6、要件定義 v0.11.1 の O15、change `record-stack-and-versioning-decisions`（REQ-226）

## 決定

5 つのパッケージ（`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner`・`loomake`）の版は changesets で管理する。版はパッケージごとに独立して上げ、`fixed` と `linked` は使わない。利用者に影響する変更には changeset を足し、文書や開発用の道具だけの変更には空の changeset を足して、公開対象がないことを示す。

## 検討した選択肢

- **changesets**：変更ごとに `.changeset/*.md` で版の上げ方と説明を残し、`pnpm changeset version` でまとめて版と CHANGELOG を更新する。利点は、PR ごとに版の上げ方をレビューでき、パッケージごとに独立した版を扱えること、pnpm workspaces の内部依存の版を一緒に上げられること。欠点は、開発時の依存が 1 つ増えること、空の changeset を足す手間がかかること
- **`npm version`**：公開するときに、パッケージごとに手で版を上げる。利点は、追加の道具が要らないこと。欠点は、5 つのパッケージの内部依存の版を手でそろえる必要があること、版を上げる理由が PR に残らないこと、公開する人が変更の中身を見直して版の上げ方を決める必要があること

## 理由

- リポジトリはすでに changesets で動いている。`.changeset/config.json` があり、CI の REQ-056 の検査と release ワークフロー（`docs/release.md`）が `pnpm changeset status`・`version`・`publish` を使っている
- 5 つのパッケージは内部で依存し合っていて、1 つの PR で複数のパッケージを変えることが多い。版の上げ方を変更と同じ PR に残せる方が、公開のときに見落としが少ない
- `npm version` に替える利点は、開発時の依存が 1 つ減ることだけで、配布物の実行時依存は変わらない

## 適用範囲

- 対象は、npm に公開する 5 つのパッケージの版と CHANGELOG
- 形式の版（verify の JSON の `schemaVersion`、quality.yaml の `version`）は、パッケージの版とは別に扱う。扱いは [0002](0002-breaking-changes-in-0x.md) に書く
- 公開の手順と認証は `docs/release.md` に従う。この ADR は手順を決めない

## 見直す条件

- changesets が pnpm の新しい版や、npm の公開の仕組み（OIDC の Trusted Publishers など）に対応せず、公開できなくなったとき
- パッケージを別のリポジトリに分けたとき（アーキテクチャ 5 章の「分けるタイミング」）
