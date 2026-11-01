# Trace: verify-v2-dod

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親verify-v2-c001 tasks1.2・5.1、trace R05 A・R06 A・R08 B | main 77aabfb9 | 2026-11-01 |
| 現行req-to-openspec-skill REQ-136、関連13要件45Scenarioの設計資料 | main 77aabfb9 | 2026-11-01 |
| 採用Opus設計と管理役の採用記録 | 5b | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-136 | 現行req-to-openspec-skill「完了ゲートのタスクの印」、親tasks1.2・5.1、R-C001-06 A | 既存変更 | 印のタスクを明示localの完了とし、最終ciの合格と必須CIを別の注記に示す。元ScenarioとSourceを保持し、新Scenarioを2件加える | 反映済 | specs/req-to-openspec-skill/spec.md |

台帳の反映済は差分仕様への記載を示し、実装・監査の完了を示さない。新しい要件IDと仮定は作らない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-06 | REQ-100・136・311・312・315・319、AGENTS DoD | done既定ciに対してローカルDoDをどう満たすか | A: ローカルは --done --scope local の0、最終受入は --done --scope ci の0と必須CIを要求するようREADME・CONTRIBUTING・delivery Skillを含む規約/guideを移行し、REQ-136を明示localへMODIFIEDして両req-to-openspec雛形を同期。kit-assets期待値変更は具体差分の個別承認後に行う / B: ローカルでもci証拠を取得し既定done 0を要求し、REQ-136本文と雛形の既定ciコマンドを保持 | A。ローカル完了と最終合格を区別し、CI証拠不足でローカル作業が恒久停止しない。AGENTS・配布規約・PRテンプレートも同時に修正する | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| DOD-Q1 | REQ-136 | 最終CIの注記をどこへ置くか | A: tasks雛形のfence内末尾の非checkbox / B: fence外 | A。生成tasksにも最終条件を残せる | no | A。管理役が記入。fence内末尾の非checkbox注記とする | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| DOD-Q2 | REQ-136 | 元Scenarioをどう扱うか | A: Sourceと元Scenarioを保持し2件追加 / B: 元Scenarioを書き換える | A。元Scenario本文の照合を保って条件を追加できる | no | A。管理役が記入。元Source・Scenarioをバイト単位で保持し2件追加する | 利用者（ADR 0006 の包括承認） | 2026-11-01 |

R05 A・R08 Bも親traceと同じ[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)を保持し、再質問しない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

## 既承認と個別承認の区別

- 規則移行：R-C001-06 Aで承認済み。上表の承認元を保持し、AGENTS・README・CONTRIBUTING・delivery・guide・両雛形・REQ-136の移行を再承認待ちにしない。具体的な旧→新全文は proposed/approval-request.md と implementation.patch に照合資料として残す。
- 新たな人の判断：tests/kit-assets.test.ts:251の具体的な旧→新 expect だけ。利用者は本会話で「この1行の変更を承認する（おすすめ）」と回答した。[管理役の記録](https://github.com/loomake/loomake/pull/269#issuecomment-6549049371)を承認元として保持する。回答日は2026-11-01 JST（管理役確認2026-10-31 20:57:48 UTC／2026-11-01 05:57:48 JST）。
- 承認対象は proposed/implementation.patch の元251行の期待値1行だけである。patchは36732 bytes、sha256 `258a599353e3afa43b20409b20db0396d7dad3b200b88c08cf4415aae80dc275`。適用前の26ファイルの前像と凍結17範囲を照合した。R06の既承認と、この期待値の個別承認を区別し、別の既存期待値の変更・試験の緩和へ広げない。実働への適用・実装後の試験・Scenario監査・doneは、task1.2後に実施する。

## 設計の補正

監査用のcanonical hashはRequirement本文とScenario本文を含む（scripts/scenario-audit.mjs）。元ScenarioとSourceのバイト保持と、旧canonical hashの据置きは別である。管理役はこの事実確認を採用した。元ScenarioのIDは同じだが、新契約のhashは再計算し、旧hashを新契約の監査済みの根拠に流用しない。静的な計算候補は proposed/scenario-plan.json に planned として記録し、実働の監査結果は変更しない。

## 実装時の監査区分

正規repository監査は進行中のdeltaをpendingに分類するため、管理役は主仕様canonical pathとdelta全文を正規関数へ渡す子側の実監査を採用した。audit/ に旧1件と新2件の実対応を記録し、主仕様への適用とは区別する。主仕様の旧Scenarioは旧契約hashのまま内容を再レビューし、既存itの試験ブロックと理由だけを更新する。本番同期後のrepository適用・全体再監査は親6/6後に残す。設定・完成条件・範囲は変更しない。

## ローカルの検証結果

承認済みpatchを適用し、全後像26件と凍結17範囲、元SourceとScenarioの301 bytesを照合した。既存のテストブロックは承認した期待値1行を除いて保持し、実init・実tarball・lint・型検査・CLI参照の一致を確認した。全体試験は478 suiteが成功し、2093件成功・既存pending8件・失敗0件だった。

local doneの初回はtask4.1の未チェック行だけでexit 1となった。正規runnerが行う一時完了印と失敗時の復元に合わせて再実行し、schemaVersion 2.0.0・scope local・run.status completed・errors空・全21チェックPASS・decision.required false・exit 0を確認した。最終scope ci・必須5チェック・3 OS・Opus最終レビューは別に必要であり、この結果で免除しない。

管理役が旧主仕様1件と子delta3件の対応を独立に読み、正規関数による再照合の成功を確認した。全体試験後の子監査も3件reviewed・invalid 0であるが、repository監査は392件reviewed・240件unreviewed・71件invalidで、進行中の子delta3件もpendingに残る。主仕様への本番適用・全体再監査と親の残受入を完了扱いにしない。

main aeee取り込み後にも、a72d5a53で開始し親移管注記3行の訂正後の0c0a024bで終了した実検証で485 suite・2134件成功・既存pending8件・local done exit 0と、同じレポートでの子3件の監査成功を確認した。

## CRLF修理後の検証

[Issue #281](https://github.com/loomake/loomake/issues/281) のWindows失敗に対し、kit-assets・実init・package-smokeの抽出入力でCRLFをLFへ正規化した。実配布formatの改行だけを変える回帰は、修理前に新1件だけnull assertionで失敗し、修理後は同じ期待する全文・印1件・ci checkbox不在・末尾注記で成功した。旧87テストブロック・凍結17範囲・元SourceとScenario301 bytes、旧主仕様1件のScenario hashと試験hashを保持した。

修理後の対象79件と、別のfresh consumerによるLF・CRLFの実tarball検証は成功した。同じconsumerを再利用した検証は既存証拠の未commitで終盤に失敗したため履歴に残し、成功へ読み替えていない。全体試験は487 suite・2190件成功・既存pending8件・失敗0件で、実local doneは2.0.0・local・completed・errors空・全21チェックPASS・decision.required false・exit 0だった。同じ成功レポートで子3件を再監査し、reviewed 3・invalid 0を確認した。

Opus初回の軽微2件について、main取り込み後の先行成功をworklog・この節・audit READMEへ記録し、tasksの最終注記の文法を直した。初回レビューを修理後headへ流用せず、最終CI・3 OS・独立再レビューと本番同期後のrepository監査は別に必要である。
