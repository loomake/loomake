# change/runner-git-reads-batch（2026-10-31）

1. やったこと：change runner-git-reads-batch のタスク 1.1〜3.3（設計メモ design-b1-runner-tests の G1）。`git.ts` に、HEAD の SHA・ブランチ名と、要るときは設定ファイルとフックの場所を 1 回の `git rev-parse` で読む `readHead` を足し、`headState`・エンジンの前の読み取り（`engineBaseline`）をそれで読むようにした。エンジンの前後は `rev-parse` と `config --list` が 1 回ずつ、完了ゲートの検証の前後は `rev-parse` が 1 回ずつになる。境目をまたいで値は使い回さない。HEAD のコミットがないときや出力の形が合わないときは今と同じ別々の呼び出しに戻り、期限・出力の上限・中断の例外は戻らずにそのまま渡す。
2. verify の結果：`verify --spec-only` と `verify --done` は exit 0（`--done` は全 21 項目が通過、command は lint・typecheck・test）。最初の `--done` は REQ ID の重複検査で落ちた。2 つの Requirement に REQ-348 を付けていたためで、失敗の扱いの Requirement を REQ-349 に分けて直した。runner と trace の試験は 43 ファイル 555 件が通過。既存の試験の期待値・上限・skip は変えていない（`git diff b5fc010f -- packages/*/test tests` は 2 ファイルへの追加だけ）。
3. 確認事項・仮定：Q-01〜Q-03 はおすすめ（A）で、A-01〜A-04 とあわせて管理役が承認した（2026-10-31、利用者の「おすすめで進めて」に基づく）。A-04 は 3.1 の実測に置き換えた。秒数の効果は PR の CI（`ci:all-os`）で確かめる。REQ-348・REQ-349 は origin/main とほかのブランチで使われていないことを PR の前に確かめた。
4. 次にやること：管理役が独立 Opus レビューと 3 OS の CI を確かめる。マージ後に archive で run-guards に REQ-348・REQ-349 を反映する。
5. セルフレビュー：別の Opus サブエージェントが重大 0・軽微 1・情報 3。軽微（この記録の次にやることに REQ-349 が抜けていた）は直した。情報の 3 件（`gitPlaces` が行の数を確かめない、検証中の HEAD の変化で止まることは既存の publication-retry.test.ts:274 が確かめる、Scenario「エンジンがコミットする」は既存の [REQ-126] の試験が確かめる）は変更しない。

操作の数（`LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` の `supervisor-entry`。後の guards.test.ts は、この change で足した 2 件の 96 回を除く）：

| ファイル | 前 | 後 | 減った数 | 割合 | 見込みの減る数 |
|---|---|---|---|---|---|
| run.test.ts | 1,580 | 1,275 | 305 | −19.3% | 305 |
| guards.test.ts | 1,175 | 955 | 220 | −18.7% | 220 |
| publication-retry.test.ts | 1,120 | 922 | 198 | −17.7% | 198 |
| pr.test.ts | 385 | 311 | 74 | −19.2% | 74 |
| external-budget.test.ts | 392 | 322 | 70 | −17.9% | 70 |
| 合計 | 4,652 | 3,785 | 867 | −18.6% | 867 |

publication-retry.test.ts の前の数は、見込みの表の 1,597 回と 30% ずれた。見込みの表が PR #218 より前の設計メモの値を使っていたためで、理由を design.md の「実測」に書いた。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#235](https://github.com/loomake/loomake/pull/235) | 未測定（change の作成と設計は同じ担当が行い、設計依頼の時刻を記録していない。管理役の確定を受けて 17:17 JST に実装に進んだ） | 23 分（17:17 JST の着手から、17:40 JST の完了ゲートの成功まで） | 進行中 | 0 | 未実施 |
