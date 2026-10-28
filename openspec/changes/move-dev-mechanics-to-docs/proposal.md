# Proposal: move-dev-mechanics-to-docs

## Why

`openspec/specs/monorepo/spec.md` には Requirement が 24 個ある。その中には、devcontainer、PR の古い CI 実行の取り消し、OS によらないテストの前提、外部操作の期限の試験の偽の CLI のように、利用者（Loomake を導入する人）にも配布物にも届かない開発の仕組みが入っている。仕様にあるので、CI やテストの書き方を少し直すだけでも、change・要件 ID・テスト・trace が要る。たとえば change shorten-ci-wall-clock の trace.md は 14KB ある。

仕様には製品の約束だけを残し、開発の仕組みは `docs/dev/` の説明と ADR に移す。そうすれば、開発の仕組みは change を通さずに直せる。

## What Changes

- monorepo の 24 個の Requirement を、仕様に残すものと外すものに分ける（分けた表は trace.md）。今回は 4 個を REMOVED にする：devcontainer、PR の古い CI 実行の取り消し、OS によらないテストの前提、外部操作の期限の試験の偽の CLI
- 外した内容を `docs/dev/` に移す。`docs/dev/README.md`（置き場の説明）、`docs/dev/devcontainer.md`、`docs/dev/ci.md`、`docs/dev/testing-across-os.md` を足す
- 分け方の基準を ADR 0005 に残す
- 外した要件 ID（REQ-004・REQ-061・REQ-215・REQ-236・REQ-240）を名前に入れていた試験は、消さずに残し、名前からその要件 ID だけを外す。期待値と処理は変えない
- AGENTS.md の 1 章に、「仕様に書かれていない振る舞いは実装しない」が `docs/dev/` の開発の仕組みには当てはまらないことを 1 文足す

「3 つの OS での CI」（REQ-049）と「CI のテストの分割」（REQ-214）も外す候補だが、進行中の change が MODIFIED にしているので、今回は扱わない（trace.md の確認事項）。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 開発の仕組みの Requirement を 4 個外す。

## Impact

`openspec/specs/monorepo/spec.md`（archive で反映）、`docs/dev/`、`docs/adr/`、AGENTS.md、試験の名前（tests/ と packages/runner/test/ の 17 か所）、`.github/workflows/ci.yml` と試験の補助関数のコメントを変える。製品のコード、公開 API、設定、依存、配布物は変えない。配布するパッケージを変えないので、changeset は空にする。
