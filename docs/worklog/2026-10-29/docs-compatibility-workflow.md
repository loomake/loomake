# 互換性変更のPR手順（Issue #101の先行範囲）

[PR #135](https://github.com/loomake/loomake/pull/135)

- 実施：changeなし（開発手順の例外、`loomake-change: none`）。既存0.x規則を参照する手順、PR記載欄、開発文書一覧、公開対象なしの空changesetを追加した。製品・現行guide・旧fixtureは変更していない。親Issue全体と1.0準備の完了は宣言しない。
- 検証：相対リンクと見出しanchor、PRテンプレートの既存全行保持、`git diff --check`が成功。利用者向け3文書のyomiyasu実行と最終稿hash照合を完了。changeがないためspec-only/doneは対象外。独立レビュー1回目は重大指摘なし。依存リンク不足による既存コードの型解決エラーを記録し、worktree専用の依存リンクを用意した後の`pnpm lint`はexit 0。設定・lockfileは変更していない。PRの品質CIは作成後に確認する。
- 未決：この文書変更にブロッキング事項なし。C001の製品判断3点は管理役へ別途引き継いだ。
- 次：独立レビューとPR作成を終え、対象headの必須CI確認を進める。Refs #101。
