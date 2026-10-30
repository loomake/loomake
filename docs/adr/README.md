# 設計判断の記録（ADR）

Loomake 自身の開発で決めたことのうち、続けて守る例外と重要な設計の判断を、ここに 1 件 1 ファイルで残す（アーキテクチャ 0.6）。PR の説明だけで済む一時的な例外は、ここに置かない。

## ファイルの名前と書き方

- ファイル名は `NNNN-<題>.md` とする。`NNNN` は 4 桁の連番で、既存の最大の番号の次を使う。`<題>` は決めたことを英小文字とハイフンで短く書く
- [template.md](template.md) を写して書く。見出しは「決定」「検討した選択肢」「理由」「適用範囲」「見直す条件」の 5 つで、順番を変えない
- 決めたことを変えるときは、既存の ADR を書き換えずに新しい ADR を足し、古い ADR の「状態」に、置き換えた ADR の番号を書く
- 仕様（`openspec/specs/`）を変える必要がある判断は、ADR を書いたうえで change を作る。ADR だけでは仕様を変えない

旧名の `0006-autonomous-delivery-authorization.md` は2026-10-30 のファイル名整合で残した移動案内であり、ADR の本文や新しい番号を追加するものではない。

## 一覧

| 番号 | 題 | 状態 |
|---|---|---|
| [0001](0001-versioning-with-changesets.md) | パッケージの版管理に changesets を使う | 採用 |
| [0002](0002-breaking-changes-in-0x.md) | `0.x` の間は破壊的変更を minor で出す | 採用 |
| [0003](0003-zod-as-core-runtime-dependency.md) | core の実行時依存に Zod を採る | 採用 |
| [0004](0004-keep-development-stack.md) | 開発の技術スタックをいまのリポジトリのまま維持する | 採用 |
| [0005](0005-keep-dev-mechanics-out-of-specs.md) | 開発の仕組みを製品の仕様から外す | 採用 |
| [0006](0006-standing-approval-for-autonomous-delivery.md) | 自律配布の包括承認 | 採用 |
