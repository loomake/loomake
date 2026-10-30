# SIGHUP で監視役が終わるときも対象を止める change の作成

訂正：以下の作成時の旧設計 session180efb22 は権限拒否1のため未実施だった。実施済みの設計は再設計 session6fe32a2b（claude-opus-5-5、ok:true・権限拒否0）であり、design.mdの工程記録を正本とする。旧評価上限の記述は当時の履歴で、最新の利用者指示により現在は上限を設けず、最新headのOpus最終レビューで指摘ゼロになるまで修正を続ける。

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

## 完了ゲートの結果

1. やったこと：stop-command-group-on-sighupの全5タスクを実装した。変更した既存試験のassertionは維持し、新しいScenario6件と既存51セレクタを再確認した。
2. verifyの結果：changesetコミット後のdoneはexit0。lint・型・全体1450試験成功、既存8skip。新しい6 Scenarioは確認済み、main比較で既存対応の悪化なし。Scenario監査全体はmainからの未整備が残るため不合格であり、全件合格とは扱わない。
3. 残っている確認事項・仮定：未回答なし。全OS CI・自動Codex・独立Opus最終評価を最終headで確認する。
4. 次にやること：PR #158へ検証と決定を反映し、最終レビュー・CIの結果を管理役へ引き継ぐ。

## 最新指示による最終レビュー修正

1. やったこと：タスク3.1としてLOW01〜05のfixture・記録を修正。grace配送を試験内で対象exitまで保留し、SIGKILL直後のnextTick例外とready前cleanupの回帰を追加した。空行を除き、旧設計sessionの未実施と最新設計を先頭に訂正した。INFO01は既存仕様のPID再利用の保証範囲を保持し、追加保証を実装しない。
2. verifyの結果：関連78試験・lint成功。!exitedの再送mutationとready依存cleanupのmutationは各1件でRed、正実装はGreen。初回の新しい例外fixtureはkill内catchに吸収されたため、期待値を変えずnextTickの未処理例外に修正した。doneと新headの最終レビューはこれから実施する。
3. 残っている確認事項・仮定：利用者の最新指示でOpus最終回数の上限は撤廃。旧head273851aの全OS CI・自動Codex・Opus重大なしは履歴として保持するが、軽微指摘があるため受入に使わない。同一指摘が3回続いたらIssue記録し往復を継続する。
4. 次にやること：新headでdone・全OS CI・自動Codexを確認し、freshsessionのOpus最終レビューで指摘ゼロまで進める。

## review3とmacOSのfixture競合の修正

1. やったこと：タスク3.2でreview3の軽微2・情報2を修正した。smoke finallyのESRCHを許容し、fixture専用試験の誤REQタグを外した。製品のID付き試験とassertionは維持。完了印と最終レビューゼロの受入を分離し、Scenario理由へgrace配送制御を明記した。
2. verifyの結果：旧head1da9616のdoneは1452成功8skipだったが、全OS CI40992720498のmacOS2/2はpack REQ333のreadyファイルが空の間にJSON.parseし失敗（874成功8skip）。完全なPID配列の読取をready条件にし、空→50ms後JSONの回帰を追加。通常/分割readyと直接fixtureの4ケース成功。旧exists-only読取のmutationの結果と新head doneはPRへ記録する。
3. 残っている確認事項・仮定：Opus review3はsession7feab1fc、claude-opus-5-5、権限拒否0、重大0・軽微2・情報2。旧6指摘は解消または既存限界記録として妥当と評価された。新指摘はESRCH・誤REQタグ・task完了印・Scenario理由が各連続1回で、3連続の同一指摘はない。
4. 次にやること：新しいheadでdone・全OS CI・自動Codexを確認し、freshsessionのOpus最終レビューで指摘ゼロまで往復を続ける。今回も製品250ms・外側2秒・既存期限と期待値を維持する。

## review4前のlint修正

1. やったこと：タスク3.2のESRCH対応でfinallyから例外を投げ直す文がlintに拒否されたため、予想外の停止失敗はstderrと終了コード1で表し、元の失敗と後続cleanupを保つ形へ直した。設定は変えていない。
2. verifyの結果：head68e69efのdoneは型・全体試験・要件対応が成功し、no-unsafe-finallyのlint1件だけ失敗した。新headで再実行する。
3. 残っている確認事項・仮定：Opus review4は未起動。旧68eの結果を新headの結果とは扱わない。
4. 次にやること：lintとdoneを確認し、新headで独立最終レビューとCIを進める。
