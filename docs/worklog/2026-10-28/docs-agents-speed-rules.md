# 2026-10-28 の作業記録（docs/agents-speed-rules）

## 開発の待ちと手戻りを減らす決まりを AGENTS.md に足す

- やったこと：change なし。AGENTS.md 2 章に「並行して進めるときの決まり」（担当・PR の大きさ・trace.md の書き方・AI のレビューの回数・人の判断の提示）を足し、6 章の作業記録の形と yomiyasu で推敲する対象を直した。根拠と調査の結果は、このブランチの PR の本文に書いた。
- verify の結果：change がないので実行していない。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。
- 残っている確認事項・仮定：承認の範囲、数値、yomiyasu の対象を外すことを利用者に確かめてもらう。テンプレートの AGENTS.md に同じ決まりを入れるかは後続の候補とする。
- 次にやること：CI の結果と利用者の確認を待つ。
