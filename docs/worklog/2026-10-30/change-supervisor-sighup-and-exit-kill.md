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

## 包括承認による仕様の確定

1. やったこと：stop-command-group-on-sighup のタスク1.2の前提として、ADR0006に基づきQ04のおすすめAと管理役によるA02〜05の仮定承認を記録した。REQ334をSIGKILL未送信条件へ変え、先頭exit後の猶予中と再送禁止のScenarioを追加し、関連計画をそろえた。
2. verifyの結果：spec-only exit0。製品コードは未変更。
3. 残っている確認事項・仮定：未回答なし。Opus設計6fe32a2bを再利用し、設計評価1回・残り最終評価1回を維持する。
4. 次にやること：既存再現をこのworktreeのビルドで取り直し、タスク1.1の4件の回帰試験をRed/Greenで確認する。

## 修正前後の再現

1. やったこと：タスク1.1・1.2をコミットし、1.3の元の再現をこのworktreeのHEADビルドで取り直した。古いroot distはUsageErrorと孤児を示したが、修正前HEADではREQ250の親が子を止め、監視役異常終了の理由つきProcessLimitErrorを返した。修正後は理由のない中断で返し、子も停止した。
2. verifyの結果：REQ333の新規4件は全件Red→Green。関連103試験成功・既存8skip。REQ334は旧コードでEPIPE・先頭exit後例外がRed、!exited案でも猶予中の孫残存がRed、!killed案で19試験成功。
3. 残っている確認事項・仮定：A03のLinux実プロセス検証は成功。macOSを含む全OS CIと独立Opus最終レビューは未実施。
4. 次にやること：復旧文書とScenario対応・changesetを記録し、完了ゲートと全OS CIを実行する。

## 文書と完了ゲートの準備

1. やったこと：タスク2.1でグループ全体の信号とCLIだけへの信号を復旧文書で区別し、yomiyasuで検査した。タスク2.2のkit patch changesetと6 Scenarioレビューを追加。変更した試験の既存assertionと51選択条件を確認して既存レビューのハッシュを更新した。helper修正を含むmainを統合した。
2. verifyの結果：文書リンク42件成功。spec-only成功。初回doneはlint・型・要件対応が成功し、未追跡のchangesetをchangeset statusが検出しないためREQ056の1件だけ失敗した。changesetをコミット後に再実行し、最終結果とScenario監査はPRへ記録する。
3. 残っている確認事項・仮定：未回答なし。独立Opus最終評価1枠、全OS CI、自動Codexレビューの最終head確認は残る。
4. 次にやること：完了ゲートとScenario監査を通し、最終headをpushして独立Opus・自動Codex・全OS CIを確認する。実装担当はCodex、実行ツールはCodexのツール環境、版と実際のモデル識別子は不明。
