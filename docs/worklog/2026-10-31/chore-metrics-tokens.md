# トークン使用量の計測をリポジトリに移す（L2）

AGENTS.md 5 章の 4 項目で記録する。

1. やったこと：[PR #223](https://github.com/loomake/loomake/pull/223) で、施策 F として `scripts/metrics-tokens.py`（`--out`・`--since`・決定的な行順・モデル名と数値の検査）、`scripts/metrics-tokens-push.sh`、`docs/metrics/README.md` を足した。独立 Opus レビューの重大 1（CSV の PR が gate で L2 と判定されて落ちる）を受けて、CSV は PR にせず、データ専用ブランチ `metrics-data` に直接 push する形に変え、中 2・軽微 5 にも対応した。再レビューの軽微 3・情報 2 を受けて、`git ls-remote` の失敗と `--no-generate` の見出しの誤りで止めるようにし、README に公開で読めることを書いた。
2. verify：lint・typecheck・test は exit 0、README の yomiyasu の lint は error 0・warn 0。push.sh は使い捨ての bare リポジトリで、dry-run・orphan での初回 push・同じ内容での何もしない終了・2 回目の push・push の失敗と再実行・origin に届かないときの exit 1・見出しの誤りでの exit 2 を確かめ、手元にブランチと worktree が残らないことも確かめた。change はないので `verify --done` は対象外。
3. 残る事項：受け入れ条件から外し、CSV は main に入れない。手元のログの読み取りが自動モードで拒否されたため、初回の CSV は利用者が開発機で `bash scripts/metrics-tokens-push.sh` を実行して `metrics-data` に入れる（設計は管理役）。
4. 次：必須 5 チェックの結果を待ち、マージは管理役が判断する。SessionStart hook（計画のタスク 5）は利用者が入れる。dashboard の routine が `metrics-data` を読むよう、指示文の更新は Fable が行う。
