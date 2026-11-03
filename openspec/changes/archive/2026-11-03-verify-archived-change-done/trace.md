# Trace: verify-archived-change-done

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [S2](https://github.com/loomake/loomake/issues/121#issuecomment-6591336244)・[CI修理例外](https://github.com/loomake/loomake/issues/121#issuecomment-6591563998)・[受入基準](https://github.com/loomake/loomake/issues/121#issuecomment-6591793918)・[ID予約](https://github.com/loomake/loomake/issues/62#issuecomment-6592346706) | 本人回答・本会話技術方針・Opus9bbe6b57（設計0c5aaec2/計画aaa07e27） | 2026-11-03 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-394 | S2・必要CI修理 | 機能 | archive実対象に元repoの通常doneを行い、外部strictだけ必要入力を隔離複写する | 反映済 | specs/verify/spec.md |
| REQ-132 | 同上・現行仕様 | 機能 | 本文明示idの唯一archiveを選び、暗黙選択と既存Scenarioを保持する | 反映済 | specs/monorepo/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-ARC-01 | REQ-394 | 同期後4種でも同じstrictを実行できるか | 同版で観測/未確認 | 実CLIで技術確認 | yes | CI1.14.3/local1.15.0の同期前後16組が対照/隔離とも0。原物は.loomake/archive-done-ci-design/sync-probe/results.json。通常doneの証明ではない | 管理役Codex（技術判断） | 2026-11-03 |
| Q-ARC-02 | REQ-394・REQ-132 | archiveをどの規則で解決するか | A: active実path優先・唯一datedのみ・複数失敗の無flag自動/B: 新flag | A。既存activeを変えない必要修理 | yes | A。本会話管理役の技術方針。一般finderの最新選択は変えない | 管理役Codex（技術判断） | 2026-11-03 |
| Q-ARC-03 | REQ-394 | 新archiveの非標準openspecDirをどうするか | A: 不合格/B: 不足 | A。標準rootの初期修理に限定 | yes | A。本会話管理役の技術方針。既存activeは不変 | 管理役Codex（技術判断） | 2026-11-03 |

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
