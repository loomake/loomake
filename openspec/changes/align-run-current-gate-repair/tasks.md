# Tasks

## 1. 規範と原文の照合

- [x] 1.1 正規parserでREQ-100のSource込み493文字・500以下・Source1行・既存全5 Scenarioのbyte一致を確認し、`openspec validate align-run-current-gate-repair --strict` と `pnpm -s verify --change align-run-current-gate-repair --spec-only` を通す（REQ-100）。
- [x] 1.2 designの全条件を基準mainの規範/src/既存試験に照合し、原W/E3/S1・C00114原文/PIN・旧it/assert/期待/期限/設定の差分0を確認する。未成立条件があれば新コードを足さず停止する（REQ-100・205・317・331）。

## 2. 既存の実run回帰

- [x] 2.1 designの既存3試験ファイルを変更せず実行し、再修正/local/CI/要判断/aborted/変更なしと5 Scenarioの成功・失敗を実結果で記録する。通常の品質検査と必要レビュー/CIを受入条件として残す（REQ-100・205・317・331）。
- [x] 2.2 本子の判断と実結果を既存日別worklog末尾に記録し、#259のT子・F前確定・E3未完の残義務が削られていないことを確認する（REQ-100）。

## 3. 完了ゲート

- [x] 3.1 `pnpm -s verify --change align-run-current-gate-repair --done --scope local` を通す。実行時のtasks入力・実exit・品質結果を保存し、成功後だけ完了として確定する（REQ-100）。 <!-- loomake:gate=done -->

## 4. 独立レビューM-1の修正

- [x] 4.1 新Tcに「変更があるとき」を明示して短文化/guardの全条件同値をdesign/traceへ記録する。正規parserでSource込み493文字・500以下・全5Scenario/Source100と元W/E3/S1/PIN/src/旧試験/期待/設定不変を照合し、strict/spec-onlyを通す（REQ-100・205・317・331、#346）。
- [ ] 4.2 修正した新入力で通常 `pnpm -s verify --change align-run-current-gate-repair --done --scope local` を1回通し、実head/入力/JSON/exitを保持する。成功後だけ最終tasksと結果記録を確定し、別担当確認・独立Opus再レビューへ返す（REQ-100）。 <!-- loomake:gate=done -->

## Workflow follow-up

- local完了後も、必須CI・Codexレビュー・独立Opus重大0と必要な3 OSを満たすまで受入済みと報告しない。マージは管理役が行う。
- sync/archive時は他の内容を保持するmergeと全文照合を行う。E3既存条件を落とさず、C001既存archive順を変えない。
- #259は2子の親として未完。T（旧497文字案・6 Scenario、未採用・字数再調整）はF前の正式change確定、Q-259-R1とE3本体/#185の未完を維持する。
