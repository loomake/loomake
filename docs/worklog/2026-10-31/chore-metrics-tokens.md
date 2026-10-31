# トークン使用量の計測をリポジトリに移す（L2）

AGENTS.md 5 章の 4 項目で記録する。

1. やったこと：[PR #223](https://github.com/loomake/loomake/pull/223) で、施策 F のタスク 1〜4・6〜8 として `scripts/metrics-tokens.py`（`--out`・`--since`・決定的な行順・モデル名の検査）、`scripts/metrics-tokens-pr.sh`（差分があるときだけ L1 の PR を出す。`--dry-run`・`--no-generate`）、`docs/metrics/README.md` を足した。
2. verify：lint・typecheck・test（1874 件成功・既存の skip 8 件）は exit 0、README の yomiyasu の lint は error 0・warn 0。`metrics-tokens-pr.sh --dry-run --no-generate` は、origin/main に CSV が無い初回の分岐も含めて、ブランチも PR も作らずに終わった。change はないので `verify --done` は対象外。
3. 残る事項：受け入れ条件から外し、`docs/metrics/tokens.csv` はこの PR に入れない。手元のログの読み取りが自動モードで拒否されたため、初回の CSV は利用者が開発機で `bash scripts/metrics-tokens-pr.sh` を実行して別の L1 PR で入れる（管理役の判断、案 3）。
4. 次：必須 5 チェックと独立 Opus レビューを待ち、マージは管理役が判断する。SessionStart hook（タスク 5）は利用者が入れる。
