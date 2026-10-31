# gate の 3 段階化と worktree 自動削除

1. やったこと：change `tier-ci-gate` のタスク 1.1〜5.1 を実施した。`scripts/ci-tier.mjs` を足して段階 L1・L2・L3 を変更パスと spec の差分から決め、`ci-gate.mjs` を段階で分け、`ci-docs-only.mjs` の docs_only を段階 L1 にそろえた。`scripts/clean-merged-worktrees.sh` と `scripts/delivery-metrics.sh` を足し、PR テンプレートと delivery スキルの証跡ブロックに `tier:` の行を足した。PR #187 のマージ後の AGENTS.md に合わせ、規則の文書を L2 に、change を持つ PR は L1 でも `--done` を通す形にした。`clean-merged-worktrees.sh --dry-run` を 1 回流し、登録済み 12 件はすべて「残す」（未マージ 10・管理役の main 1・dirty 1）、未登録 5 件は触らない判定だった。
2. verify の結果：仕様ゲートと `pnpm -s verify --change tier-ci-gate --done` は exit 0。lint・typecheck・全体の test が成功し、REQ-342・REQ-343・REQ-270 の試験は `tests/ci-tier.test.ts`・`tests/ci-gate-process.test.ts`・`tests/ci-docs-only.test.ts` にある。
3. 残っている確認事項・仮定：Q-01〜Q-03 は設計メモ 7 章の採否を記録した。仮定 A-01（RFC 語の行で Requirement の変更を近似）・A-02（archive の PR は L1）・A-03（quality は本文の `loomake-tier:` を読まない）・A-04（L1 でも change があれば `--done`）を trace に書いた。`ci:all-os` の強制は 3 OS の時間切れが直るまで入れない。
4. 次にやること：CI と Codex の自動レビュー、独立 Opus の最終レビューを管理役が確かめてマージする。archive は管理役。手順 5 の完了後に `ci:all-os` の強制を別 PR で足す。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/tier-ci-gate | 未測定（設計メモは着手前に受領） | 約 20 分（最初のコミット 08:48 JST から完了ゲート成功 09:05 JST まで。change の起草は含まない） | 未 | 未 | 未 |
