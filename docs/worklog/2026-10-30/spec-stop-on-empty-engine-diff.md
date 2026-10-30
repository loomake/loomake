# エンジンが差分を残さずに終えたら止まる change の作成

1. やったこと：change `stop-on-empty-engine-diff` を作った（proposal・specs・design・tasks・trace）。要件は REQ-330〜332 で、設計は Opus（`claude-opus-5-5`、session `c9f6a4c0-7acf-4533-a132-1b6d6fec06dc`、.agents/skills/delivery/scripts/ask-opus.mjs 経由、対象 `d5aa30d`）が書き、Claude Code（Fable 5.1）が OpenSpec の形に写した。確認事項は、利用者の 2026-10-30 の「おすすめで進めて」の指示に基づき、設計のおすすめ案を回答として記入した。製品コード・試験・設定は変えていない。
2. verify の結果：`pnpm -s verify --change stop-on-empty-engine-diff --spec-only` は exit 0（警告は仮定の未承認だけ）。`openspec validate stop-on-empty-engine-diff --strict` も exit 0。コミットは `af7aacf`。
3. 残っている確認事項・仮定：設計工程は補助スクリプトが ok:false（modelUsage に `claude-haiku-5-5` の補助呼び出しが含まれたため）を返し、規約上は未実施。最小の依頼でも同じ結果になるため、この環境では Opus 工程を実施済みにできない。Opus 本体の回答を設計として採るか、補助の判定を直すかは人の判断待ち。仮定の承認欄は空。gh が未認証のため PR と Issue は作っていない。
4. 次にやること：人の判断を受けたら、design.md を Codex に渡して tasks の順に実装し、完了ゲートを通し、別の Opus セッションで最終レビューを行う。
