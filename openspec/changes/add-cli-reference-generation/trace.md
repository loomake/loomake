# Trace: add-cli-reference-generation

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/wbs/baseline-v1.4.md W6-8・W6-6 | 固定v1.4、main 684abf0 | 2026-10-29確認 |
| Issue #104のCLIコマンド/オプション生成と再生成一致 | [Issue #104](https://github.com/loomake/loomake/issues/104) | 2026-10-29 |
| openspec/specs/cli/spec.md REQ-041・135・192・194・195、trace-agreement/spec.md REQ-202・203 | main 684abf0 | 2026-10-29確認 |
| packages/cli/src/args.ts・main.tsとtest/arguments・cli・usage-errors・trace-agreement・doctor・verify-boundaries・startup-zod | 現行の受理名・usage・help・検証、main 684abf0 | 2026-10-29 |
| packages/trace/src/agreement.ts、packages/runner/src/run/prepare.ts・engine.ts | 必須値・ローカル日付・engine既定値と環境条件、main 684abf0 | 2026-10-29 |
| add-quality-reference-generationのproposal・specs/reference-docs/spec.md・design | 別担当の計画を読み取り参照、REQ-320〜322 | 2026-10-29 |
| AGENTS.md、docs/adr/0005-keep-dev-mechanics-out-of-specs.md、docs/guide/index.md、tests/doc-links.test.ts、vitest.config.ts、scripts/ci-gate.mjs | 仕様境界・導線・既存CI経路、main 684abf0 | 2026-10-29確認 |
| main CIのmacOS shard 2の失敗 | [CI40844515674・job123348619751](https://github.com/loomake/loomake/actions/runs/40844515674/job/123348619751) | 2026-10-29確認 |
| CLIの固定head 6b8a390の起動再現 | [ローカル再現結果](/workspaces/loomake/.claude/scratch/cli-symlink-evidence-6b8a390/results.json)、[作業記録](../../../docs/worklog/2026-10-29/feat-cli-reference-generation.md) | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-323 | WBS W6-8・Issue104、現行CLI/handler | 機能 | 現行全コマンド・操作・オプション・必須条件・既定値・共通操作を共通定義から列挙し、未確定のv2を含めない | 反映済 | specs/reference-docs/spec.md |
| REQ-324 | WBS W6-8のCLIとの一致、REQ-041・135・192・194・195・202・203、現行main/args | 互換 | 共通定義へ集約し、受理構文・usage/help全文・各順序・条件・既定値・診断と公開契約を保持する | 反映済 | specs/reference-docs/spec.md |
| REQ-325 | WBS W6-6/8・Issue104、現行guideとquality先行計画 | 品質 | 決定的な生成・読み取り専用check・CI不一致検出と安全な表示・導線を提供する | 反映済 | specs/reference-docs/spec.md |

REQ-320〜322はquality、REQ-308〜319はC-001のため再使用しない。本changeはREQ-323〜325だけを使用する。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

現行CLIの整理と列挙に未回答の製品仕様はない。C-001の未決項目には回答せず、現行にないv2出力・scope・証拠採否を生成しない。人の新しい承認が必要な振る舞いの変更は計画していない。

入口の修正はREQ-325の既存契約を満たすための技術対応で、未確定の製品仕様ではない。未回答のM144-01はPR #144のマージ承認であり、仕様ゲートのブロッキング確認事項へは追加しない。修正後のheadと検証結果を管理役が人へ提示するまで、マージ・仕様反映・archiveとIssue #104の完了判断は行わない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で埋めない。ページ名、ビルド済み定義を読む開発用入口、source定義とのCI一致照合、usageの現行文字列維持はdesignに根拠を記した技術判断である。

## 依存と技術確認

| 対象 | 扱い・根拠 |
|---|---|
| planningからの引き継ぎ | 旧planning担当は停止済み、commit 9db6f64の未push作業は本branchへcherry-pick済み。main 8d2d7ceからfeat/cli-reference-generationを作り、既存delivery指示でapplyへ移る |
| quality先行と共有capability | [PR142](https://github.com/loomake/loomake/pull/142)のdone・全7tasks・CI40814920276成功と、[PR143](https://github.com/loomake/loomake/pull/143)の通常verify・CI40815827958成功を管理役が確認し受入済み。main 8d2d7ceで主仕様反映を確認し依存解消。Purpose・REQ-320〜322は保つ |
| 担当の境界 | CLI担当は本changeのみ。quality側の生成器・共通helper・indexを同時に編集しない。guide入口と共通手順は先行受入後に追記する |
| 表示と解析の差 | trace answerの--answerはparser候補順で最後、helpでは--byより前。runのengine表示もusageとhelpで異なる。現行を保つ |
| 条件と既定値 | main.tsに加えrunAgreementとrunner prepareを根拠にする。記述の注記を新しい必須チェックへ転用せず、診断優先と下位処理を回帰試験で確認する |
| CLIのpatch | args.ts/main.tsは配布コードのためloomakeのpatch changesetを計画する。新動作の追加とは記さず、公開exports・依存は増やさない |
| Issue104の完了 | quality先行だけでは閉じない。両方の生成範囲を受け入れ、再生成一致のCI根拠を確認して判断する |
| 入口の契約回復 | 上記CIと固定headの実測を受け、タスク2.4を追加し3.1を未完了へ戻す。詳細は作業記録へ残す。CLI側だけを直し、main側のfix-reference-entrypoint-pathsとは分ける |
| AIレビューとマージ判断 | [PR144のbot記録](https://github.com/loomake/loomake/pull/144#issuecomment-6488291614)と独立レビューで既存AI2回を消化済み。追加AIレビューは依頼しない。[Issue121のM144-01](https://github.com/loomake/loomake/issues/121)は回答待ちで、人の承認を記録していない |
