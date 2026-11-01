## 提案パッチのファイル名整理

1. 新しい change と実装タスクは対象外とし、`classify-unchanged-archive-metadata` の提案パッチを内容不変で `proposed/AGENTS.patch.md` へ移し、proposal の現行参照を更新した。PR は未作成で、旧パスを含む差分は L2 として扱う。
2. change 指定の verify は対象外で、lint と文書リンク試験43件が成功した。パッチの完全 blob ID と R100、metadata と保護対象ファイルの同一性を確認した。
3. 新たな確認事項と仮定はない。提案時点の記録と利用者の承認出典にある旧パス、tasks と元の実装の受入を保持し、新しい承認を記録していない。
4. 管理役へ引き継ぎ、`loomake-change: none`・`loomake-tier: L2` の PR で通常 CI と独立 Opus レビューを通す。そのあとで archive 候補を取り込み直して確認する。
