# AI コスト削減の設定（L2）

AGENTS.md 5 章の 4 項目で記録する。

1. やったこと：[PR #211](https://github.com/loomake/loomake/pull/211) で、`autoCompactWindow: 200000`・statusLine・`.codex/config.toml` を入れ、AGENTS.md 2 章 5 にサブエージェントの長さと新しいセッションへの切り替えの運用を足した。独立 Opus レビューの軽微 2・情報 3 にも対応した。
2. verify：lint・typecheck・test（1858 件成功・既存の skip 8 件）は exit 0、yomiyasu の lint は error 0。change はないので `verify --done` は対象外。
3. 残る事項：statusLine の command は相対パスなので、作業ディレクトリがリポジトリのルートであることを前提にしている。実画面での表示と Codex の読み込みは確かめていない。
4. 次：必須 5 チェックの完了を待ち、マージは管理役が判断する。
