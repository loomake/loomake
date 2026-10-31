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

台帳の反映済は差分仕様への記載を示し、実装・監査・人の具体的承認の完了を示さない。新しい要件IDと仮定は作らない。

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
- 新たな人の判断：tests/kit-assets.test.ts:251の具体的な旧→新 expect だけ。全文は同じ資料に提示し、個別承認は未済。
- 実働の一式への適用・実装後の試験・Scenario監査・doneは未実施。251行の期待値の承認待ちなのでtask1.2を未完了とする。R06の既承認と、この期待値の個別承認を区別する。

## 設計の補正

監査用のcanonical hashはRequirement本文とScenario本文を含む（scripts/scenario-audit.mjs）。元ScenarioとSourceのバイト保持と、旧canonical hashの据置きは別である。管理役はこの事実確認を採用した。元ScenarioのIDは同じだが、新契約のhashは再計算し、旧hashを新契約の監査済みの根拠に流用しない。静的な計算候補は proposed/scenario-plan.json に planned として記録し、実働の監査結果は変更しない。
