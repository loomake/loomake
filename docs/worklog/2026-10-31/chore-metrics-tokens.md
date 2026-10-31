# トークン使用量の計測をリポジトリに移す（L2）

AGENTS.md 5 章の 4 項目で記録する。

1. やったこと：施策 F のタスク 1〜4・6〜8 として、`scripts/metrics-tokens.py`（`--out`・`--since`・決定的な行順・モデル名の検査）、`scripts/metrics-tokens-pr.sh`（差分があるときだけ L1 の PR を出す。`--dry-run`・`--no-generate`）、`docs/metrics/README.md` を足した。PR はまだ出していない。
2. verify：lint・typecheck・test（1874 件成功・既存の skip 8 件）は exit 0、README の yomiyasu の lint は error 0・warn 0。`metrics-tokens-pr.sh --dry-run --no-generate` は試験用の CSV で、ブランチも PR も作らずに終わった。change はないので `verify --done` は対象外。
3. 残る事項：初回の `docs/metrics/tokens.csv` は、`~/.claude` のログを読む実行が権限で止められたので作っていない。利用者が手元で `python3 -I scripts/metrics-tokens.py --out docs/metrics/tokens.csv` を実行して入れる必要がある。
4. 次：CSV を入れてから push し、L2 の PR を出す。
