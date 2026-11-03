# Trace: run-draft-pr

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [#80](https://github.com/loomake/loomake/issues/80)・WBS v1.4 W3-2 | Draft PR完了条件 | 2026-11-03 |
| [本人施策2/5](https://github.com/loomake/loomake/issues/121#issuecomment-6591563998)・[枠C](https://github.com/loomake/loomake/issues/121#issuecomment-6591671700) | 自身条件テストmain+CI、DoD維持、並行 | 2026-11-03 |
| verify-v2-shape/trace.md R-F12=A | 新規だけDraft・既存は状態不変再利用。原回答者は利用者（ADR0006包括承認）、PR180 | 2026-10-31 |
| Opus458b3bffと管理役assessment | 新規Draft最小案のみ採用。未観測やarchive阻害を保持 | 2026-11-03 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-116 | #80/W3-2・既存run-pr | 既存変更 | 新規PRへ--draft、失敗経路と認証を保持 | 反映済 | specs/run-pr/spec.md |
| REQ-165 | R-F12=A・既存run | 既存変更 | 既存PRの状態を変えず再利用 | 反映済 | specs/run/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新たな仮定は置かない。規範配置と既存失敗経路の維持は管理役の技術判断。実GitHub/実engine成功は未観測で、コード受入と区別する。親C001・#80全受入は未完。
