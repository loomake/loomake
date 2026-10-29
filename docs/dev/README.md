# 開発の仕組み

このディレクトリには Loomake のリポジトリを開発する人だけに効く仕組みを書く。利用者（Loomake を導入する人）にも配布物にも届かないので、製品の仕様（`openspec/specs/`）には入れない。分け方の基準は [ADR 0005](../adr/0005-keep-dev-mechanics-out-of-specs.md) にある。

## 仕様との違い

- ここに書いた仕組みは change を作らずに直せる。要件 ID も trace.md も要らない
- 仕組みを守る試験は残す。試験の名前には要件 ID を入れない
- AGENTS.md の「仕様に書かれていない振る舞いは実装しない」は、ここの仕組みには当てはまらない。ただし、製品の振る舞い（CLI の出力、配布物の中身、公開の手順など）を変えるときは、これまでどおり change を通す

## 一覧

| ファイル | 内容 | 守る試験 |
|---|---|---|
| [deliveryスキル](../../.agents/skills/delivery/SKILL.md) | `$delivery` からGoalとIssueを進める手順 | スキル形式・文書リンクを確認 |
| [devcontainer.md](devcontainer.md) | このリポジトリの devcontainer | `tests/monorepo.test.ts` の「devcontainer」 |
| [ci.md](ci.md) | CI のワークフローの組み方（PR の古い実行の取り消し） | `tests/monorepo.test.ts` の「CI」 |
| [compatibility-changes.md](compatibility-changes.md) | 公開契約の変更理由、移行方法、旧fixtureをPRへ記録する手順 | 文書リンクと既存のPRテンプレートの契約を確認 |
| [reference-generation.md](reference-generation.md) | quality.yamlリファレンスの生成と読み取り専用check | `tests/quality-reference.test.ts` と既存のスキーマ一致・文書リンク試験 |
| [testing-across-os.md](testing-across-os.md) | 3 つの OS で同じ期待値を使うためのテストの前提と、外部操作の期限の試験の偽の CLI | 各ファイルに書いた試験 |

3 つの OS での CI（REQ-049）と CI のテストの分割（REQ-214）は、いまは仕様にある。進行中の change が終わってから、ここに移す候補にしている（change move-dev-mechanics-to-docs の trace.md の Q-01）。
