# Opus への依頼を Codex の自動承認審査が通すための許可を AGENTS.md に書く

1. Codex の自動承認審査（approvals_reviewer = auto_review）が、ask-opus.mjs の実行を「非公開リポジトリの差分を外部宛先へ送る操作で、この内容と宛先への明示許可がない」として毎回拒否し、利用者に承認を求めていた。審査は利用者の発言・AGENTS.md・request_user_input の回答だけを許可の根拠にするため、AGENTS.md に 6 節「Opus への依頼に対する利用者の恒久的な許可」を足した。操作・送る内容・宛先・根拠を書き、GitHub への投稿や公開には及ばないことも明記した。change はない（規則の文書、L2）。
2. verify は対象外（change なし）。yomiyasu_lint を AGENTS.md に実行し、新しい節への警告はなかった。
3. 確認事項なし。許可文の内容は 2026-10-31 の利用者の指示（Codex からの承認依頼をなくす）に基づく。
4. マージ後、Codex の各 worktree が main を取り込めば審査が許可文を読める。拒否が続く場合は、審査の rationale を見て許可文の範囲を直す。
