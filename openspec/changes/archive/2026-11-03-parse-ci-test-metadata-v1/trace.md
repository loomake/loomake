# Trace: parse-ci-test-metadata-v1

[REQ予約](https://github.com/loomake/loomake/issues/62#issuecomment-6590479666)。形式Aと変換規則は本人回答済み。metadata子の受入前に組の実装へ進まない。

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| docs/wbs/baseline-v1.4.md:115・207 | v1.4、main dbca87dd52bc2304923e39574bfd7fc3650c4704 | 2026-10-26 |
| [本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6590095928)・Opus補足704c57db §3〜6 | 回答日を原記録どおり保持 | 2026-11-02 |
| [変換規則の本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591173812) | 利用者rrr-www、Claude転記 | 2026-11-03 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-391 | W1-3・C003入口A・補足§3 | 機能 | CI診断metadata v1を合否判定せず公開型へ変換する。必須型・版・列挙・安全整数を検査し未知項目を出力しない | 反映済 | specs/core-parsers/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-C003-01 | REQ-391・REQ-392 | 最初の公開入力形式はどれか | A: metadata v1とreport本文または不在の組 / B: coverage / C: 保留 | A。CI成果物の対象版・環境を扱い、既存report parserを使える | yes | A。[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6590095928) | 利用者（rrr-www、Claude転記） | 2026-11-02 |
| Q-C003-02 | REQ-391・REQ-392 | metadataの欠落・不正・未知項目をどの規則で変換するか | A: spec案の必須型・版・列挙・安全整数を検査し、未知項目は出力しない / B: JSON objectをそのまま保持し型の判定を後続へ送る | A。既知の形を公開型で扱え、未知の値や不正な集計を既知の値へ変換しない。writerの事実から採用済みとはしない | yes | A。[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591173812) | 利用者（rrr-www、Claude転記） | 2026-11-03 |

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

Q-C003-02/03は本人回答Aを採用した。親#62/C003・C001・S1は未完。実装・正式受入・公開許可を表さない。
