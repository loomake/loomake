# SIGHUP で監視役が終わるときも対象を止める change の作成

1. やったこと：change `stop-command-group-on-sighup` を作った（proposal・specs・design・tasks・trace）。要件は REQ-333〜334（335 は予備） で、設計は Opus（`claude-opus-5-5`、session `180efb22-b5d7-4cbe-80e1-ffb9ce6fad69`、.agents/skills/delivery/scripts/ask-opus.mjs 経由、対象 `d5aa30d`）が書き、Claude Code（Fable 5.1）が OpenSpec の形に写した。確認事項は、利用者の 2026-10-30 の「おすすめで進めて」の指示に基づき、設計のおすすめ案を回答として記入した。製品コード・試験・設定は変えていない。
2. verify の結果：`pnpm -s verify --change stop-command-group-on-sighup --spec-only` は exit 0（警告は仮定の未承認だけ）。`openspec validate stop-command-group-on-sighup --strict` も exit 0。コミットは `0d30c00`。
3. 残っている確認事項・仮定：設計工程は補助スクリプトが ok:false（modelUsage に `claude-haiku-5-5` の補助呼び出しが含まれたため）を返し、規約上は未実施。最小の依頼でも同じ結果になるため、この環境では Opus 工程を実施済みにできない。Opus 本体の回答を設計として採るか、補助の判定を直すかは人の判断待ち。仮定の承認欄は空。当初記録では gh が未認証で PR と Issue は未作成だった。現在は [PR #158](https://github.com/loomake/loomake/pull/158) を作成済み。
4. 次にやること：人の判断を受けたら、design.md を Codex に渡して tasks の順に実装し、完了ゲートを通し、別の Opus セッションで最終レビューを行う。


## 計画の補正と Q-04 の追加

1. やったこと：change `stop-command-group-on-sighup`（タスク 1.1〜2.2 は未着手、[PR #158](https://github.com/loomake/loomake/pull/158)）。再設計の要点と実施済みの証跡を design へ転記し、CLI の品質コマンドの経路、出典、E2E、Scenario の再レビュー手順、作業記録の名前を補正した。旧レビューを AI 評価 1 回と数え、残り 1 回は最終レビュー用に残す。製品コードと差分仕様は変更していない。
2. verify の結果：`pnpm -s verify --change stop-command-group-on-sighup --spec-only` は exit 1。未回答のブロッキング Q-04 だけで不合格。要件モデル、trace、差分仕様、openspec validate は成功。仮定 A-02〜A-05 は未承認の警告。
3. 残っている確認事項・仮定：Q-04（REQ-334 の exit 時の送信条件を !exited から !killed へ変えるか）。A をすすめる。既承認 Q-01〜Q-03 は本会話と引き継ぎの記録を残し、同じ承認を求め直さない。
4. 次にやること：PR 本文用の確認案を管理役へ渡し、人の Q-04 の回答を記録する。仕様ゲートが通るまでこの change の製品実装を止める。回答後は tasks の順に実装し、完了ゲートと別セッションの Opus 最終レビューへ進む。
