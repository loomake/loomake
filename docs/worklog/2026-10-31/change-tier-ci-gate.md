# gate の 3 段階化と worktree 自動削除

1. やったこと：change `tier-ci-gate` のタスク 1.1〜5.1 を実施した。`scripts/ci-tier.mjs` を足して段階 L1・L2・L3 を変更パスと spec の差分から決め、`ci-gate.mjs` を段階で分け、`ci-docs-only.mjs` の docs_only を段階 L1 にそろえた。`scripts/clean-merged-worktrees.sh` と `scripts/delivery-metrics.sh` を足し、PR テンプレートと delivery スキルの証跡ブロックに `tier:` の行を足した。PR #187 のマージ後の AGENTS.md に合わせ、規則の文書を L2 に、change を持つ PR は L1 でも `--done` を通す形にした。`clean-merged-worktrees.sh --dry-run` を 1 回流し、登録済み 12 件はすべて「残す」（未マージ 10・管理役の main 1・dirty 1）、未登録 5 件は触らない判定だった。
2. verify の結果：仕様ゲートと `pnpm -s verify --change tier-ci-gate --done` は exit 0。lint・typecheck・全体の test が成功し、REQ-342・REQ-343・REQ-270 の試験は `tests/ci-tier.test.ts`・`tests/ci-gate-process.test.ts`・`tests/ci-docs-only.test.ts` にある。
3. 残っている確認事項・仮定：Q-01〜Q-03 は設計メモ 7 章の採否を記録した。仮定 A-01（RFC 語の行で Requirement の変更を近似）・A-02（archive の PR は L1）・A-03（quality は本文の `loomake-tier:` を読まない）・A-04（L1 でも change があれば `--done`）を trace に書いた。`ci:all-os` の強制は 3 OS の時間切れが直るまで入れない。
4. 次にやること：CI と Codex の自動レビュー、独立 Opus の最終レビューを管理役が確かめてマージする。archive は管理役。手順 5 の完了後に `ci:all-os` の強制を別 PR で足す。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/tier-ci-gate | 未測定（設計メモは着手前に受領） | 約 20 分（最初のコミット 08:48 JST から完了ゲート成功 09:05 JST まで。change の起草は含まない） | 未 | 2 | 未 |

## 独立 Opus レビュー（初回）への対応

1. やったこと：head 2ee33f3 の独立 Opus レビュー（claude-opus-5-5）の重大 1・軽微 5・情報 4 を管理役の決定どおり直した。`clean-merged-worktrees.sh` は origin/main の祖先かではなく、ブランチを head にした PR が GitHub で merged かで判定し（gh を使えなければ何も消さない）、detached HEAD と `.loomake/`・`node_modules/`・`dist/`・`coverage/` 以外の無視ファイルがあるものを残す。Requirement の変更は RFC 語の近似をやめ、変更行が属する節で判定する（仮定 A-01 を書き換え）。archive の例外は A か R で archive の下に足したときだけ。tasks.md に完了した印がない change は `--spec-only` で検査する（A-05）。`tier_line` は heredoc 形式で書く。`delivery-metrics.sh` は一時ディレクトリに書いてから移し、段階は `ci-tier.mjs` の `classifyPath` で決める。あわせて main で重複していた REQ-273 を解消し、agents-rules の「作業記録の決まり」を REQ-288 に振り直した（Q-04）。`clean-merged-worktrees.sh --dry-run` を再度 1 回流し、`delivery-manager-main-20261030` と `c001-report2-design-20261030` は「残す（detached）」、PR のないブランチ 2 件は「PR なし」、`.yomiyasu/` や `__pycache__/` の無視ファイルがある 7 件は「無視ファイルあり」、いまいる worktree 1 件、未登録 5 件は触らない判定だった（消す予定は 0 件）。
2. verify の結果：仕様ゲートと `pnpm -s verify --change tier-ci-gate --done` は exit 0。追加した試験は節の判定（箇条書きの変更 → L3、Scenario に MUST → L1、読めなければ安全側）、archive の M だけ → L3、提案だけの change → `--spec-only`、GITHUB_OUTPUT の heredoc。
3. 残っている確認事項・仮定：A-01 は「節で判定」に書き換え、A-05 と Q-04 を足した。PR #187 の worktree（rules-consolidation-20261031）は `__pycache__/` の無視ファイルで「残す」になるので、消すときは手で無視ファイルを消してから流す。
4. 次にやること：修正後の head の CI・Codex・独立 Opus の再レビュー（往復 1 回目）を管理役が確かめてマージする。

## 独立 Opus 再レビュー（2 回目）への対応

1. やったこと：head 5675f8f の再レビュー（重大 1・軽微 2）を管理役の決定どおり直した。`--spec-only` への切り替えは段階 L1 で完了した印がない change だけにし、L2・L3 は常に `--done`（A-05 を更新）。消した行の節判定はベースと HEAD の merge-base のファイルで読む。worktree の削除はマージ済み PR の head と同じか origin/main に含まれる HEAD だけにし、進んだ HEAD は「残す」と表示する。`delivery-metrics.sh` に時間切れ Issue の flaky.csv を戻し、1 回実行して 6 つの CSV ができることを確かめた。`docs/quality/scenarios.json` の `tests/kit-assets.test.ts` の sha256（25 件）を今回のファイルに更新した。
2. verify の結果：仕様ゲートと `pnpm -s verify --change tier-ci-gate --done` は exit 0。追加した試験は「L1 ＋ 印なし → --spec-only」「L2・L3 ＋ 印なし → --done」。`clean-merged-worktrees.sh --dry-run` の結果は前回と同じ（消す予定 0 件、detached 2 件は残す）。
3. 残っている確認事項・仮定：なし。以降の差分は指摘の修正だけで、3 回目は差分だけの確認（管理役の例外）。
4. 次にやること：管理役が CI と差分の確認を終えてマージし、archive する。
